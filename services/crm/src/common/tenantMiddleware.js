const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

// Import CRM Models
const User = require('../../models/User');
const Client = require('../../models/Client');
const CrmAmc = require('../../models/CrmAmc');
const CrmContract = require('../../models/CrmContract');
const CrmDocumentTemplate = require('../../models/CrmDocumentTemplate');
const CrmPayment = require('../../models/CrmPayment');
const CrmProject = require('../../models/CrmProject');
const CrmTicket = require('../../models/CrmTicket');
const Lead = require('../../models/Lead');

const tenantConnections = new Map();

function getTenantConnection(dbName) {
  if (tenantConnections.has(dbName)) {
    return tenantConnections.get(dbName);
  }

  const masterUri = process.env.MONGO_URI || '';
  const parsedUri = new URL(masterUri);
  parsedUri.pathname = `/${dbName}`;
  const tenantUri = parsedUri.toString();

  const conn = mongoose.createConnection(tenantUri);
  tenantConnections.set(dbName, conn);

  // Register tenant schemas
  conn.model('Client', Client.schema);
  conn.model('CrmAmc', CrmAmc.schema);
  conn.model('CrmContract', CrmContract.schema);
  conn.model('CrmDocumentTemplate', CrmDocumentTemplate.schema);
  conn.model('CrmPayment', CrmPayment.schema);
  conn.model('CrmProject', CrmProject.schema);
  conn.model('CrmTicket', CrmTicket.schema);
  conn.model('Lead', Lead.schema);

  conn.on('connected', () => console.log(`[CRM Tenant DB] Connected: ${dbName}`));
  conn.on('error', (err) => console.error(`[CRM Tenant DB] Error (${dbName}):`, err.message));

  return conn;
}

async function tenantMiddleware(req, res, next) {
  try {
    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return res.status(401).json({ success: false, message: 'CRM Authorization token required.' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ success: false, message: 'Invalid or expired CRM token.' });
    }

    const { companyCode, role } = decoded;
    if (!companyCode) {
      return res.status(401).json({ success: false, message: 'Token missing companyCode.' });
    }
    
    if (role !== 'crm_admin') {
      return res.status(403).json({ success: false, message: 'CRM admin role required.' });
    }

    // Resolve tenant DB from master User collection
    const company = await User.findOne({ companyCode }).lean();
    if (!company) {
      return res.status(404).json({ success: false, message: 'Company not found.' });
    }

    const dbName = `salesdb_${companyCode.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    const db = getTenantConnection(dbName);

    req.tenant = { companyCode, company, dbName };
    req.db = db;
    req.crmUser = decoded;
    req.models = {
      Client: db.model('Client'),
      CrmAmc: db.model('CrmAmc'),
      CrmContract: db.model('CrmContract'),
      CrmDocumentTemplate: db.model('CrmDocumentTemplate'),
      CrmPayment: db.model('CrmPayment'),
      CrmProject: db.model('CrmProject'),
      CrmTicket: db.model('CrmTicket'),
      Lead: db.model('Lead'),
    };

    next();
  } catch (err) {
    console.error('[CRM tenantMiddleware]', err);
    return res.status(500).json({ success: false, message: 'Server error in CRM tenant middleware.' });
  }
}

module.exports = { tenantMiddleware, getTenantConnection };
