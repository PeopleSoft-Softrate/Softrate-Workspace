const mongoose = require('mongoose');

const RoleSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  name: { type: String, required: true }, // e.g., 'HR_ADMIN', 'EMPLOYEE', 'MANAGER'
  description: { type: String },
  permissions: [{ type: String }], // Array of permission strings like 'CREATE_USER', 'APPROVE_LEAVE', '*'
  isSystemDefined: { type: Boolean, default: false }, // Prevent deletion of core roles
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Compound index to ensure role names are unique per company
RoleSchema.index({ companyId: 1, name: 1 }, { unique: true });

// Update timestamp on save
RoleSchema.pre('save', async function() {
  this.updatedAt = Date.now();
});

// Multi-Tenant Proxy Wrapper
// Target MUST be a function for the construct trap to work with new Model()
function _RoleProxyTarget() {}

function _getRoleModel() {
  const { getTenantConnection } = require('../db');
  const { getModelsForConnection } = require('../utilities/modelLoader');
  const { tenantLocalStorage } = require('../utilities/tenantContext');
  const store = tenantLocalStorage ? tenantLocalStorage.getStore() : null;
  const dbName = store && store.dbName ? store.dbName : 'hrdb';
  const connection = getTenantConnection(dbName);
  const models = getModelsForConnection(connection);
  return models["Role"];
}

module.exports = new Proxy(_RoleProxyTarget, {
  get(target, prop) {
    if (prop === 'name') return "Role";
    if (prop === 'schema') return RoleSchema;
    if (prop === '_name') return "Role";
    if (prop === '_schema') return RoleSchema;
    const actualModel = _getRoleModel();
    if (!actualModel) throw new Error("Model Role not found for current tenant");
    if (typeof actualModel[prop] === 'function') return actualModel[prop].bind(actualModel);
    return actualModel[prop];
  },
  construct(target, args) {
    const actualModel = _getRoleModel();
    if (!actualModel) throw new Error("Model Role not found for current tenant");
    return new actualModel(...args);
  }
});
