const mongoose = require('mongoose');

const BranchSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  name: { type: String, required: true },
  location: { type: String }, // e.g., 'New York', 'HQ'
  timezone: { type: String, default: 'UTC' },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Update timestamp on save
BranchSchema.pre('save', async function() {
  this.updatedAt = Date.now();
});

// Multi-Tenant Proxy Wrapper
// Target MUST be a function for the construct trap to work with new Model()
function _BranchProxyTarget() {}

function _getBranchModel() {
  const { getTenantConnection } = require('../db');
  const { getModelsForConnection } = require('../utilities/modelLoader');
  const { tenantLocalStorage } = require('../utilities/tenantContext');
  const store = tenantLocalStorage ? tenantLocalStorage.getStore() : null;
  const dbName = store && store.dbName ? store.dbName : 'hrdb';
  const connection = getTenantConnection(dbName);
  const models = getModelsForConnection(connection);
  return models["Branch"];
}

module.exports = new Proxy(_BranchProxyTarget, {
  get(target, prop) {
    if (prop === 'name') return "Branch";
    if (prop === 'schema') return BranchSchema;
    if (prop === '_name') return "Branch";
    if (prop === '_schema') return BranchSchema;
    const actualModel = _getBranchModel();
    if (!actualModel) throw new Error("Model Branch not found for current tenant");
    if (typeof actualModel[prop] === 'function') return actualModel[prop].bind(actualModel);
    return actualModel[prop];
  },
  construct(target, args) {
    const actualModel = _getBranchModel();
    if (!actualModel) throw new Error("Model Branch not found for current tenant");
    return new actualModel(...args);
  }
});
