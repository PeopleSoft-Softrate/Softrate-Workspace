const jwt = require('jsonwebtoken');
const { getMasterConnection, getTenantConnection } = require('../db');
const { getModelsForConnection } = require('../utilities/modelLoader');
// We load Company schema from the master connection manually for auth/middleware lookups
const CompanyModelExport = require('../models/CompanyModel');

// ── Company Cache ────────────────────────────────────────────────────────────
// Avoids a master DB round-trip on every authenticated request.
// Entries expire after 5 minutes.
const _companyCache = new Map();
const COMPANY_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function _getCachedCompany(companyId) {
  const entry = _companyCache.get(companyId);
  if (entry && entry.expiresAt > Date.now()) return entry.data;
  _companyCache.delete(companyId); // expired
  return null;
}

function _setCachedCompany(companyId, data) {
  _companyCache.set(companyId, { data, expiresAt: Date.now() + COMPANY_CACHE_TTL });
}
// ─────────────────────────────────────────────────────────────────────────────

const verifyTenant = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ msg: 'No token, authorization denied' });
    }

    const token = authHeader.replace('Bearer ', '');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded.user) {
      return res.status(403).json({ message: 'Invalid token structure' });
    }

    const isDemoMode = req.header('X-Demo-Mode') === 'true';

    // Determine target DB name. Fallback to 'hrdb' for older mobile app users.
    let dbName = decoded.user.dbName || 'hrdb';
    if (isDemoMode) {
      dbName = 'demo_db';
    }
    console.log(`[Tenant] URL: ${req.url} | User: ${decoded.user.id} | dbName from token: ${decoded.user.dbName} | Final DB: ${dbName}`);
    
    // Connect to specific tenant DB and attach models
    const tenantDbConnection = getTenantConnection(dbName);
    req.models = getModelsForConnection(tenantDbConnection);

    // Verify company exists in Master DB if companyId is present
    // Uses in-memory cache to avoid DB round-trip on every request
    let companyData = null;
    let targetCompanyId = decoded.user.companyId;
    
    if (isDemoMode) {
      // Find or cache the Demo company
      const cacheKey = 'DEMO_COMPANY';
      companyData = _getCachedCompany(cacheKey);
      if (!companyData) {
        const masterDbConnection = getMasterConnection();
        const MasterCompany = masterDbConnection.models.Company || masterDbConnection.model('Company', CompanyModelExport.schema);
        companyData = await MasterCompany.findOne({ companyCode: 'demo' });
        if (companyData) _setCachedCompany(cacheKey, companyData);
      }
      targetCompanyId = companyData ? companyData._id : decoded.user.companyId;
    } else if (targetCompanyId) {
      const cacheKey = targetCompanyId.toString();
      companyData = _getCachedCompany(cacheKey);

      if (!companyData) {
        const masterDbConnection = getMasterConnection();
        const MasterCompany = masterDbConnection.models.Company || masterDbConnection.model('Company', CompanyModelExport.schema);
        companyData = await MasterCompany.findById(targetCompanyId);
        if (companyData) _setCachedCompany(cacheKey, companyData);
      }
      
      if (!companyData && dbName !== 'hrdb') {
         return res.status(404).json({ message: 'Tenant/Company not found' });
      }
    }

    req.tenant = {
      companyId: companyData ? companyData._id : targetCompanyId,
      companyCode: companyData ? companyData.companyCode : 'softrate',
      receivingEmail: companyData?.settings?.receivingEmail || process.env.RECIVER_EMAIL_USER,
      logo: companyData?.settings?.communication?.emailLogoUrl || null,
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

