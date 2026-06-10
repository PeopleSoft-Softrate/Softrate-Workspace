const { getMasterConnection, getTenantConnection, waitForConnection } = require('../db');
const CompanyModelExport = require('../models/CompanyModel');
const { getModelsForConnection } = require('../utilities/modelLoader');
const { runWithTenant } = require('../utilities/tenantContext');

/**
 * Middleware to identify a tenant based on a companyCode or companyId in the body/query
 * Used for public routes like registration/onboarding where no JWT exists.
 */
const verifyPublicTenant = async (req, res, next) => {
  try {
    const { companyCode, companyId } = req.body || req.query;

    if (!companyCode && !companyId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Tenant identification required (companyCode or companyId)' 
      });
    }

    // Load Company from master DB
    const masterDb = getMasterConnection();
    await waitForConnection(masterDb);
    const Company = masterDb.models.Company || masterDb.model('Company', CompanyModelExport.schema);

    let company;
    if (companyId) {
      company = await Company.findById(companyId);
    } else {
      // Escape special regex chars (dots etc.) before building regex
      const escapedCode = companyCode.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      company = await Company.findOne({ companyCode: { $regex: new RegExp(`^${escapedCode}$`, 'i') } });
    }

    if (!company) {
      return res.status(404).json({ 
        success: false, 
        message: 'Company not found with the provided identifier' 
      });
    }

    // Use stored dbName (pre-computed at registration time, no dots)
    const dbName = company.dbName || `hrdb_${company.companyCode.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}`;
    const tenantDb = getTenantConnection(dbName);
    await waitForConnection(tenantDb);

    // Attach models and tenant context to request
    req.models = getModelsForConnection(tenantDb);
    req.tenant = {
      companyId: company._id,
      companyCode: company.companyCode,
      dbName: dbName,
      receivingEmail: company.settings?.receivingEmail || process.env.RECIVER_EMAIL_USER,
      defaultPassword: company.settings?.defaultPassword || ""
    };

    runWithTenant({ companyId: company._id, dbName }, () => {
      next();
    });
  } catch (err) {
    console.error("Public Tenant Verification Error:", err.message);
    res.status(500).json({ success: false, message: 'Server error during tenant verification' });
  }
};

module.exports = verifyPublicTenant;
