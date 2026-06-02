const mongoose = require("mongoose");

const DeviceChangeRequestSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  userModel: { type: String, enum: ["Intern", "Employee", "User"], required: true },
  oldDeviceId: { type: String, required: true },
  newDeviceId: { type: String, required: true },
  reason: { type: String, required: true },
  
  // Approval Flow
  managerApprovalStatus: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
  managerId: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", default: null }, // Optional, tracked when approved
  managerRemarks: { type: String, default: "" },

  hrApprovalStatus: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
  hrId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }, // Optional, tracked when approved
  hrRemarks: { type: String, default: "" },

  status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Update timestamp on save
DeviceChangeRequestSchema.pre('save', async function() {
  this.updatedAt = Date.now();
});

// Multi-Tenant Proxy Wrapper
// Target MUST be a function for the construct trap to work with new Model()
function _DeviceChangeRequestProxyTarget() {}

function _getDeviceChangeRequestModel() {
  const { getTenantConnection } = require('../db');
  const { getModelsForConnection } = require('../utilities/modelLoader');
  const { tenantLocalStorage } = require('../utilities/tenantContext');
  const store = tenantLocalStorage ? tenantLocalStorage.getStore() : null;
  const dbName = store && store.dbName ? store.dbName : 'hrdb';
  const connection = getTenantConnection(dbName);
  const models = getModelsForConnection(connection);
  return models["DeviceChangeRequest"];
}

module.exports = new Proxy(_DeviceChangeRequestProxyTarget, {
  get(target, prop) {
    if (prop === 'name') return "DeviceChangeRequest";
    if (prop === 'schema') return DeviceChangeRequestSchema;
    if (prop === '_name') return "DeviceChangeRequest";
    if (prop === '_schema') return DeviceChangeRequestSchema;
    const actualModel = _getDeviceChangeRequestModel();
    if (!actualModel) throw new Error("Model DeviceChangeRequest not found for current tenant");
    if (typeof actualModel[prop] === 'function') return actualModel[prop].bind(actualModel);
    return actualModel[prop];
  },
  construct(target, args) {
    const actualModel = _getDeviceChangeRequestModel();
    if (!actualModel) throw new Error("Model DeviceChangeRequest not found for current tenant");
    return new actualModel(...args);
  }
});
