const mongoose = require("mongoose");

const resignationSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    fullName: { type: String, required: true },
    userId: { type: String, required: true },
    userType: { type: String, enum: ["intern", "employee"], default: "intern" },
    department: { type: String, required: true },

    lastWorkingDay: { type: String, required: true },

    exitType: { type: String, required: true }, // Resignation
    exitReason: { type: String, required: true }, // Selected / Other reason

    assetReturnStatus: { type: String, required: true },
    status: { type: String, enum: ["pending_manager", "pending_hr", "accepted", "rejected"], default: "pending_manager" },

    managerId: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", default: null },
    managerStatus: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    managerRemarks: { type: String, default: "" },

    hrStatus: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    hrRemarks: { type: String, default: "" },

    createdAt: { type: Date, default: Date.now },

  },
  { collection: "resignation_records" }
);

// Multi-Tenant Proxy Wrapper
// Target MUST be a function for the construct trap to work with new Model()
function _resignationProxyTarget() {}

function _getresignationModel() {
  const { getTenantConnection } = require('../db');
  const { getModelsForConnection } = require('../utilities/modelLoader');
  const { tenantLocalStorage } = require('../utilities/tenantContext');
  const store = tenantLocalStorage ? tenantLocalStorage.getStore() : null;
  const dbName = store && store.dbName ? store.dbName : 'hrdb';
  const connection = getTenantConnection(dbName);
  const models = getModelsForConnection(connection);
  return models["resignation"];
}

module.exports = new Proxy(_resignationProxyTarget, {
  get(target, prop) {
    if (prop === 'name') return "resignation";
    if (prop === 'schema') return resignationSchema;
    if (prop === '_name') return "resignation";
    if (prop === '_schema') return resignationSchema;
    const actualModel = _getresignationModel();
    if (!actualModel) throw new Error("Model resignation not found for current tenant");
    if (typeof actualModel[prop] === 'function') return actualModel[prop].bind(actualModel);
    return actualModel[prop];
  },
  construct(target, args) {
    const actualModel = _getresignationModel();
    if (!actualModel) throw new Error("Model resignation not found for current tenant");
    return new actualModel(...args);
  }
});
