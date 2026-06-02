const mongoose = require("mongoose");

const EmployeeLeaveSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    employeeId: { type: String, required: true },
    employeeName: { type: String, required: true },

    leaveType: { type: String, required: true },

    fromDate: { type: Date, required: true },
    toDate: { type: Date, required: true },

    numberOfDays: { type: Number, required: true },

    reason: { type: String, required: true },

    managerStatus: {
      type: String,
      enum: ["pending", "accepted", "rejected"],
      default: "pending",
    },
    hrStatus: {
      type: String,
      enum: ["pending", "accepted", "rejected"],
      default: "pending",
    },
    managerId: { type: String }, // To filter leaves for a specific manager
    rejectionReason: { type: String, default: "" },

    // example: { "2025-01-10": "half", "2025-01-11": "full" }
    perDayDurations: {
      type: Object,
      default: {},
    },
  },
  { timestamps: true }
);

// Multi-Tenant Proxy Wrapper
// Target MUST be a function for the construct trap to work with new Model()
function _EmployeeLeaveProxyTarget() {}

function _getEmployeeLeaveModel() {
  const { getTenantConnection } = require('../db');
  const { getModelsForConnection } = require('../utilities/modelLoader');
  const { tenantLocalStorage } = require('../utilities/tenantContext');
  const store = tenantLocalStorage ? tenantLocalStorage.getStore() : null;
  const dbName = store && store.dbName ? store.dbName : 'hrdb';
  const connection = getTenantConnection(dbName);
  const models = getModelsForConnection(connection);
  return models["EmployeeLeave"];
}

module.exports = new Proxy(_EmployeeLeaveProxyTarget, {
  get(target, prop) {
    if (prop === 'name') return "EmployeeLeave";
    if (prop === 'schema') return EmployeeLeaveSchema;
    if (prop === '_name') return "EmployeeLeave";
    if (prop === '_schema') return EmployeeLeaveSchema;
    const actualModel = _getEmployeeLeaveModel();
    if (!actualModel) throw new Error("Model EmployeeLeave not found for current tenant");
    if (typeof actualModel[prop] === 'function') return actualModel[prop].bind(actualModel);
    return actualModel[prop];
  },
  construct(target, args) {
    const actualModel = _getEmployeeLeaveModel();
    if (!actualModel) throw new Error("Model EmployeeLeave not found for current tenant");
    return new actualModel(...args);
  }
});
