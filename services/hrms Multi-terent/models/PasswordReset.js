const mongoose = require("mongoose");

const PasswordResetSchema = new mongoose.Schema({
  
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },email: { type: String, required: true },
  userType: { type: String, enum: ['intern', 'employee', 'hr'], required: true },
  token: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now }
});

// Automatically delete expired tokens after 5 minutes (using TTL index)
PasswordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Multi-Tenant Proxy Wrapper
// Target MUST be a function for the construct trap to work with new Model()
function _PasswordResetProxyTarget() {}

function _getPasswordResetModel() {
  const { getTenantConnection } = require('../db');
  const { getModelsForConnection } = require('../utilities/modelLoader');
  const { tenantLocalStorage } = require('../utilities/tenantContext');
  const store = tenantLocalStorage ? tenantLocalStorage.getStore() : null;
  const dbName = store && store.dbName ? store.dbName : 'hrdb';
  const connection = getTenantConnection(dbName);
  const models = getModelsForConnection(connection);
  return models["PasswordReset"];
}

module.exports = new Proxy(_PasswordResetProxyTarget, {
  get(target, prop) {
    if (prop === 'name') return "PasswordReset";
    if (prop === 'schema') return PasswordResetSchema;
    if (prop === '_name') return "PasswordReset";
    if (prop === '_schema') return PasswordResetSchema;
    const actualModel = _getPasswordResetModel();
    if (!actualModel) throw new Error("Model PasswordReset not found for current tenant");
    if (typeof actualModel[prop] === 'function') return actualModel[prop].bind(actualModel);
    return actualModel[prop];
  },
  construct(target, args) {
    const actualModel = _getPasswordResetModel();
    if (!actualModel) throw new Error("Model PasswordReset not found for current tenant");
    return new actualModel(...args);
  }
});
