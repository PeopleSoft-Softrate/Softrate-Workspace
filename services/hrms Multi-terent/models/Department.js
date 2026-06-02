const mongoose = require('mongoose');

const DepartmentSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' }, // Optional, can be global to company
  name: { type: String, required: true },
  managerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Head of Department
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Update timestamp on save
DepartmentSchema.pre('save', async function() {
  this.updatedAt = Date.now();
});

// Multi-Tenant Proxy Wrapper
// Target MUST be a function for the construct trap to work with new Model()
function _DepartmentProxyTarget() {}

function _getDepartmentModel() {
  const { getTenantConnection } = require('../db');
  const { getModelsForConnection } = require('../utilities/modelLoader');
  const { tenantLocalStorage } = require('../utilities/tenantContext');
  const store = tenantLocalStorage ? tenantLocalStorage.getStore() : null;
  const dbName = store && store.dbName ? store.dbName : 'hrdb';
  const connection = getTenantConnection(dbName);
  const models = getModelsForConnection(connection);
  return models["Department"];
}

module.exports = new Proxy(_DepartmentProxyTarget, {
  get(target, prop) {
    if (prop === 'name') return "Department";
    if (prop === 'schema') return DepartmentSchema;
    if (prop === '_name') return "Department";
    if (prop === '_schema') return DepartmentSchema;
    const actualModel = _getDepartmentModel();
    if (!actualModel) throw new Error("Model Department not found for current tenant");
    if (typeof actualModel[prop] === 'function') return actualModel[prop].bind(actualModel);
    return actualModel[prop];
  },
  construct(target, args) {
    const actualModel = _getDepartmentModel();
    if (!actualModel) throw new Error("Model Department not found for current tenant");
    return new actualModel(...args);
  }
});
