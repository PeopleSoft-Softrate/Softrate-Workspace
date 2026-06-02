const mongoose = require("mongoose");

const hrSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  hr_policy_url: {
    type: String,
    default: null
  },
  policy_updated_at: {
    type: Date,
    default: null
  }
});

// Multi-Tenant Proxy Wrapper
// Target MUST be a function for the construct trap to work with new Model()
function _hrProxyTarget() {}

function _gethrModel() {
  const { getTenantConnection } = require('../db');
  const { getModelsForConnection } = require('../utilities/modelLoader');
  const { tenantLocalStorage } = require('../utilities/tenantContext');
  const store = tenantLocalStorage ? tenantLocalStorage.getStore() : null;
  const dbName = store && store.dbName ? store.dbName : 'hrdb';
  const connection = getTenantConnection(dbName);
  const models = getModelsForConnection(connection);
  return models["hr"];
}

module.exports = new Proxy(_hrProxyTarget, {
  get(target, prop) {
    if (prop === 'name') return "hr";
    if (prop === 'schema') return hrSchema;
    if (prop === '_name') return "hr";
    if (prop === '_schema') return hrSchema;
    const actualModel = _gethrModel();
    if (!actualModel) throw new Error("Model hr not found for current tenant");
    if (typeof actualModel[prop] === 'function') return actualModel[prop].bind(actualModel);
    return actualModel[prop];
  },
  construct(target, args) {
    const actualModel = _gethrModel();
    if (!actualModel) throw new Error("Model hr not found for current tenant");
    return new actualModel(...args);
  }
});
