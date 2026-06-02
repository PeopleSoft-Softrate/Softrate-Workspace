const mongoose = require("mongoose");

const policySchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    policy_name: { type: String, required: true },
    policy_view_by: {
      type: [String],
      enum: ["employee", "intern"],
      required: true,
    },
    policy_url: { type: String, required: true },
  },
  { timestamps: true }
);

// Multi-Tenant Proxy Wrapper
// Target MUST be a function for the construct trap to work with new Model()
function _policyProxyTarget() {}

function _getpolicyModel() {
  const { getTenantConnection } = require('../db');
  const { getModelsForConnection } = require('../utilities/modelLoader');
  const { tenantLocalStorage } = require('../utilities/tenantContext');
  const store = tenantLocalStorage ? tenantLocalStorage.getStore() : null;
  const dbName = store && store.dbName ? store.dbName : 'hrdb';
  const connection = getTenantConnection(dbName);
  const models = getModelsForConnection(connection);
  return models["policy"];
}

module.exports = new Proxy(_policyProxyTarget, {
  get(target, prop) {
    if (prop === 'name') return "policy";
    if (prop === 'schema') return policySchema;
    if (prop === '_name') return "policy";
    if (prop === '_schema') return policySchema;
    const actualModel = _getpolicyModel();
    if (!actualModel) throw new Error("Model policy not found for current tenant");
    if (typeof actualModel[prop] === 'function') return actualModel[prop].bind(actualModel);
    return actualModel[prop];
  },
  construct(target, args) {
    const actualModel = _getpolicyModel();
    if (!actualModel) throw new Error("Model policy not found for current tenant");
    return new actualModel(...args);
  }
});
