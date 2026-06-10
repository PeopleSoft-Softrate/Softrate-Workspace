const mongoose = require('mongoose');

const GoalDefinitionSchema = new mongoose.Schema({
  perspective: { type: String, required: true },
  kpiName: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  weight: { type: Number, required: true }
});

const PerformanceTemplateSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  roleName: { type: String, required: true }, // matches Intern.role
  category: { type: String, required: true },
  goals: [GoalDefinitionSchema],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Ensure uniqueness per company, role, and category
PerformanceTemplateSchema.index({ companyId: 1, roleName: 1, category: 1 }, { unique: true });

PerformanceTemplateSchema.pre('save', async function() {
  this.updatedAt = Date.now();
});

// Multi-Tenant Proxy Wrapper
// Target MUST be a function for the construct trap to work with new Model()
function _PerformanceTemplateProxyTarget() {}

function _getPerformanceTemplateModel() {
  const { getTenantConnection } = require('../db');
  const { getModelsForConnection } = require('../utilities/modelLoader');
  const { tenantLocalStorage } = require('../utilities/tenantContext');
  const store = tenantLocalStorage ? tenantLocalStorage.getStore() : null;
  const dbName = store && store.dbName ? store.dbName : 'hrdb';
  const connection = getTenantConnection(dbName);
  const models = getModelsForConnection(connection);
  return models["PerformanceTemplate"];
}

module.exports = new Proxy(_PerformanceTemplateProxyTarget, {
  get(target, prop) {
    if (prop === 'name') return "PerformanceTemplate";
    if (prop === 'schema') return PerformanceTemplateSchema;
    if (prop === '_name') return "PerformanceTemplate";
    if (prop === '_schema') return PerformanceTemplateSchema;
    const actualModel = _getPerformanceTemplateModel();
    if (!actualModel) throw new Error("Model PerformanceTemplate not found for current tenant");
    if (typeof actualModel[prop] === 'function') return actualModel[prop].bind(actualModel);
    return actualModel[prop];
  },
  construct(target, args) {
    const actualModel = _getPerformanceTemplateModel();
    if (!actualModel) throw new Error("Model PerformanceTemplate not found for current tenant");
    return new actualModel(...args);
  }
});
