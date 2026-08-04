const mongoose = require('mongoose');
const User = require('../../models/User');
const Lead = require('../../models/Lead');
const CallLog = require('../../models/CallLog');
const CallDetail = require('../../models/CallDetail');
const Bookmark = require('../../models/Bookmark');
const BreakLog = require('../../models/BreakLog');
const Quotation = require('../../models/Quotation');
const Invoice = require('../../models/Invoice');
const History = require('../../models/History');
const Client = require('../../models/Client');
const Counter = require('../../models/Counter');
const { verifyToken } = require('./jwtHelper');

// Cache of tenant connections: companyCode → mongoose.Connection
const tenantConnections = new Map();

/**
 * Get or create a Mongoose connection for a given tenant DB name.
 */
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
  conn.model('Lead', Lead.schema);
  conn.model('CallLog', CallLog.schema);
  conn.model('CallDetail', CallDetail.schema);
  conn.model('Bookmark', Bookmark.schema);
  conn.model('BreakLog', BreakLog.schema);
  conn.model('Quotation', Quotation.schema);
  conn.model('Invoice', Invoice.schema);
  conn.model('History', History.schema);
  conn.model('Client', Client.schema);
  conn.model('Counter', Counter.schema);

  conn.on('connected', () => console.log(`[Tenant DB] Connected: ${dbName}`));
  conn.on('error', (err) => console.error(`[Tenant DB] Error (${dbName}):`, err.message));

  return conn;
}

/**
 * Middleware: verifies JWT from Authorization header.
 * Attaches req.employee and req.db (tenant Mongoose connection) to the request.
 *
 * For admin routes, also accepts ?companyCode=XXX query param with a valid admin JWT.
 */
async function tenantMiddleware(req, res, next) {
  try {
    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return res.status(401).json({ success: false, message: 'Authorization token required.' });
    }

    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (err) {
      return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
    }

    const { employeeId, companyCode, role } = decoded;
    if (!companyCode) {
      return res.status(401).json({ success: false, message: 'Token missing companyCode.' });
    }

    // Resolve tenant DB from master User collection for the native company
    const nativeCompany = await User.findOne({ companyCode }).lean();
    if (!nativeCompany) {
      return res.status(404).json({ success: false, message: 'Native company not found.' });
    }

    let activeCompanyCode = companyCode;
    let activeCompany = nativeCompany;
    const requestedCompanyCode = req.headers['x-active-company-code'];

    if (requestedCompanyCode && requestedCompanyCode !== companyCode) {
      if (role === 'admin') {
        // Admins check User.collaboratingCompanies
        const allowed = nativeCompany.collaboratingCompanies && nativeCompany.collaboratingCompanies.includes(requestedCompanyCode);
        if (!allowed) {
          return res.status(403).json({ success: false, message: 'Collaboration access denied for this company.' });
        }
      } else {
        // Employees check their Employee record in the native DB
        const nativeDbName = `salesdb_${companyCode.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
        const nativeDb = getTenantConnection(nativeDbName);
        const EmployeeNativeModel = nativeDb.model('Employee');
        const employeeRecord = await EmployeeNativeModel.findById(employeeId).lean();
        if (!employeeRecord || !employeeRecord.allowedCompanies || !employeeRecord.allowedCompanies.includes(requestedCompanyCode)) {
          return res.status(403).json({ success: false, message: 'Employee not authorized for this company.' });
        }
      }

      // Load active company
      activeCompany = await User.findOne({ companyCode: requestedCompanyCode }).lean();
      if (!activeCompany) {
        return res.status(404).json({ success: false, message: 'Active company not found.' });
      }
      activeCompanyCode = requestedCompanyCode;
    }

    // Derive DB name for the active company
    const dbName = `salesdb_${activeCompanyCode.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    const db = getTenantConnection(dbName);

    req.tenant = { companyCode: activeCompanyCode, company: activeCompany, dbName };
    req.db = db;
    // req.employee always holds the native companyCode and ID
    req.employee = { id: employeeId, companyCode, role };
    req.models = {
      Lead: db.model('Lead'),
      CallLog: db.model('CallLog'),
      CallDetail: db.model('CallDetail'),
      Bookmark: db.model('Bookmark'),
      BreakLog: db.model('BreakLog'),
      Quotation: db.model('Quotation'),
      Invoice: db.model('Invoice'),
      History: db.model('History'),
      Client: db.model('Client'),
      Counter: db.model('Counter'),
    };

    next();
  } catch (err) {
    console.error('[tenantMiddleware]', err);
    return res.status(500).json({ success: false, message: 'Server error in tenant middleware.' });
  }
}

/**
 * Lighter middleware for admin routes that authenticate via email/password (User model).
 * Skips employee JWT check — handled separately by settings.routes.js.
 */
function adminOnly(req, res, next) {
  if (req.employee?.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Admin access required.' });
  }
  next();
}

/**
 * Middleware that resolves the tenant DB purely from `companyCode` in query or body.
 * No JWT required. Attaches req.db and req.models.
 */
function companyMiddleware(req, res, next) {
  const companyCode = req.query.companyCode || req.body?.companyCode;
  if (!companyCode) {
    return next(); // let route handler return 400 if it needs companyCode
  }
  const dbName = `salesdb_${companyCode.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
  const db = getTenantConnection(dbName);
  req.db = db;
  req.models = {
    Lead: db.model('Lead'),
    CallLog: db.model('CallLog'),
    CallDetail: db.model('CallDetail'),
    Bookmark: db.model('Bookmark'),
    BreakLog: db.model('BreakLog'),
    Quotation: db.model('Quotation'),
    Invoice: db.model('Invoice'),
    History: db.model('History'),
    Client: db.model('Client'),
    Counter: db.model('Counter'),
  };
  next();
}

module.exports = { tenantMiddleware, adminOnly, getTenantConnection, companyMiddleware };
