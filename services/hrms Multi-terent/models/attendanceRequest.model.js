const mongoose = require("mongoose");

const AttendanceRequestSchema = new mongoose.Schema({
  
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },internId: { type: String, required: true }, // The readable ID (e.g., 2025001)
  internMongoId: { type: mongoose.Schema.Types.ObjectId, ref: "Intern", required: true },
  internName: { type: String, required: true },
  managerMongoId: { type: mongoose.Schema.Types.ObjectId, ref: "Employee" },
  date: { type: Date, required: true },
  requestedPunchIn: { type: String, default: null }, // ISO string or time string
  requestedPunchOut: { type: String, default: null },
  reason: { type: String, required: true },
  
  // Manager Approval
  managerApprovalStatus: { 
    type: String, 
    enum: ["pending", "approved", "rejected"], 
    default: "pending" 
  },
  managerRemarks: { type: String, default: "" },
  managerActionDate: { type: Date },

  // HR Approval
  hrApprovalStatus: { 
    type: String, 
    enum: ["pending", "approved", "rejected"], 
    default: "pending" 
  },
  hrRemarks: { type: String, default: "" },
  hrActionDate: { type: Date },

  createdAt: { type: Date, default: Date.now },
});

// Multi-Tenant Proxy Wrapper
// Target MUST be a function for the construct trap to work with new Model()
function _AttendanceRequestProxyTarget() {}

function _getAttendanceRequestModel() {
  const { getTenantConnection } = require('../db');
  const { getModelsForConnection } = require('../utilities/modelLoader');
  const { tenantLocalStorage } = require('../utilities/tenantContext');
  const store = tenantLocalStorage ? tenantLocalStorage.getStore() : null;
  const dbName = store && store.dbName ? store.dbName : 'hrdb';
  const connection = getTenantConnection(dbName);
  const models = getModelsForConnection(connection);
  return models["AttendanceRequest"];
}

module.exports = new Proxy(_AttendanceRequestProxyTarget, {
  get(target, prop) {
    if (prop === 'name') return "AttendanceRequest";
    if (prop === 'schema') return AttendanceRequestSchema;
    if (prop === '_name') return "AttendanceRequest";
    if (prop === '_schema') return AttendanceRequestSchema;
    const actualModel = _getAttendanceRequestModel();
    if (!actualModel) throw new Error("Model AttendanceRequest not found for current tenant");
    if (typeof actualModel[prop] === 'function') return actualModel[prop].bind(actualModel);
    return actualModel[prop];
  },
  construct(target, args) {
    const actualModel = _getAttendanceRequestModel();
    if (!actualModel) throw new Error("Model AttendanceRequest not found for current tenant");
    return new actualModel(...args);
  }
});
