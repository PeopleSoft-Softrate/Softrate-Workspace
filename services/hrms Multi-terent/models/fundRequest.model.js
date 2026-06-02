const mongoose = require("mongoose");

const FundRequestSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },

    requesterType: {
      type: String,
      enum: ["employee", "intern"],
      required: true,
    },
    requesterId: { type: String, required: true, index: true },
    requesterMongoId: { type: mongoose.Schema.Types.ObjectId },
    requesterName: { type: String, required: true },
    department: { type: String, default: "" },

    category: { type: String, required: true },
    amount: { type: Number, required: true, min: 1 },
    expenseDate: { type: Date, required: true },
    description: { type: String, required: true },

    managerId: { type: String, default: null, index: true },
    managerStatus: {
      type: String,
      enum: ["pending", "accepted", "rejected"],
      default: "pending",
    },
    managerRemarks: { type: String, default: "" },
    managerActionDate: { type: Date },

    hrStatus: {
      type: String,
      enum: ["pending", "accepted", "rejected"],
      default: "pending",
    },
    hrRemarks: { type: String, default: "" },
    hrActionDate: { type: Date },

    // Phase 2 finance handoff. HR approval does not mark this true yet.
    isFinanceTeamApprove: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Multi-Tenant Proxy Wrapper
// Target MUST be a function for the construct trap to work with new Model()
function _FundRequestProxyTarget() {}

function _getFundRequestModel() {
  const { getTenantConnection } = require('../db');
  const { getModelsForConnection } = require('../utilities/modelLoader');
  const { tenantLocalStorage } = require('../utilities/tenantContext');
  const store = tenantLocalStorage ? tenantLocalStorage.getStore() : null;
  const dbName = store && store.dbName ? store.dbName : 'hrdb';
  const connection = getTenantConnection(dbName);
  const models = getModelsForConnection(connection);
  return models["FundRequest"];
}

module.exports = new Proxy(_FundRequestProxyTarget, {
  get(target, prop) {
    if (prop === 'name') return "FundRequest";
    if (prop === 'schema') return FundRequestSchema;
    if (prop === '_name') return "FundRequest";
    if (prop === '_schema') return FundRequestSchema;
    const actualModel = _getFundRequestModel();
    if (!actualModel) throw new Error("Model FundRequest not found for current tenant");
    if (typeof actualModel[prop] === 'function') return actualModel[prop].bind(actualModel);
    return actualModel[prop];
  },
  construct(target, args) {
    const actualModel = _getFundRequestModel();
    if (!actualModel) throw new Error("Model FundRequest not found for current tenant");
    return new actualModel(...args);
  }
});
