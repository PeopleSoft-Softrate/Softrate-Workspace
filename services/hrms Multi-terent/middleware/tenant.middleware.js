const jwt = require('jsonwebtoken');
const { getMasterConnection, getTenantConnection } = require('../db');
const { getModelsForConnection } = require('../utilities/modelLoader');
// We load Company schema from the master connection manually for auth/middleware lookups
const CompanyModelExport = require('../models/CompanyModel');

const verifyTenant = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ msg: 'No token, authorization denied' });
    }

    const token = authHeader.replace('Bearer ', '');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret_key');

    if (!decoded.user) {
      return res.status(403).json({ message: 'Invalid token structure' });
    }

    // Determine target DB name. Fallback to 'hrdb' for older mobile app users.
    const dbName = decoded.user.dbName || 'hrdb';
    
    // Connect to specific tenant DB and attach models
    const tenantDbConnection = getTenantConnection(dbName);
    req.models = getModelsForConnection(tenantDbConnection);

    // Verify company exists in Master DB if companyId is present
    let companyData = null;
    if (decoded.user.companyId) {
      const masterDbConnection = getMasterConnection();
      const MasterCompany = masterDbConnection.models.Company || masterDbConnection.model('Company', CompanyModelExport.schema);
      companyData = await MasterCompany.findById(decoded.user.companyId);
      
      if (!companyData && dbName !== 'hrdb') {
         return res.status(404).json({ message: 'Tenant/Company not found' });
      }
    }

    req.tenant = {
      companyId: companyData ? companyData._id : decoded.user.companyId,
      companyCode: companyData ? companyData.companyCode : 'softrate',
      receivingEmail: companyData?.settings?.receivingEmail || process.env.RECIVER_EMAIL_USER,
      dbName: dbName
    };
    
    // We only need to run the next middleware/controller inside the tenant context
    const { runWithTenant } = require('../utilities/tenantContext');
    runWithTenant({ companyId: req.tenant.companyId, dbName: dbName }, () => {
      req.user = decoded.user;
      next();
    });
  } catch (err) {
    console.error("JWT Verification Error:", err.message);
    res.status(401).json({ message: 'Token is not valid: ' + err.message });
  }
};

module.exports = verifyTenant;
