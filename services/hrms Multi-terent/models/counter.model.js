const mongoose = require("mongoose");

const CounterSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
  type: { type: String, required: true }, // e.g., 'employee', 'intern'
  year: { type: String, default: null },  // e.g., '25' for 2025 — allows per-year reset
  seq: { type: Number, default: 0 },
});

// Ensure uniqueness per company, type and year
CounterSchema.index({ companyId: 1, type: 1, year: 1 }, { unique: true });

// Multi-Tenant Proxy Wrapper
// Target MUST be a function for the construct trap to work with new Model()
function _CounterProxyTarget() {}

function _getCounterModel() {
  const { getTenantConnection } = require('../db');
  const { getModelsForConnection } = require('../utilities/modelLoader');
  const { tenantLocalStorage } = require('../utilities/tenantContext');
  const store = tenantLocalStorage ? tenantLocalStorage.getStore() : null;
  const dbName = store && store.dbName ? store.dbName : 'hrdb';
  const connection = getTenantConnection(dbName);
  const models = getModelsForConnection(connection);
  return models["Counter"];
}

module.exports = new Proxy(_CounterProxyTarget, {
  get(target, prop) {
    if (prop === 'name') return "Counter";
    if (prop === 'schema') return CounterSchema;
    if (prop === '_name') return "Counter";
    if (prop === '_schema') return CounterSchema;
    const actualModel = _getCounterModel();
    if (!actualModel) throw new Error("Model Counter not found for current tenant");
    if (typeof actualModel[prop] === 'function') return actualModel[prop].bind(actualModel);
    return actualModel[prop];
  },
  construct(target, args) {
    const actualModel = _getCounterModel();
    if (!actualModel) throw new Error("Model Counter not found for current tenant");
    return new actualModel(...args);
  }
});
