const mongoose = require("mongoose");

const employeeResignationSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    employeeId: {
      type: String,
      required: true,
      index: true,
    },
    fullName: {
      type: String,
      required: true,
    },
    department: {
      type: String,
      required: true,
    },
    designation: {
      type: String,
      required: true,
    },
    applyDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    noticePeriodMonths: {
      type: Number,
      required: true,
      default: 2,
    },
    lastWorkingDay: {
      type: Date,
      required: true,
    },
    reason: {
      type: String,
      required: true,
    },
    additionalComments: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      required: true,
    },
    rejectionReason: {
      type: String,
      default: "",
    },
    createdBy: {
      // optional: link to employee user _id if you have users collection
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
    },
  },
  { timestamps: true }
);

// Multi-Tenant Proxy Wrapper
// Target MUST be a function for the construct trap to work with new Model()
function _employeeResignationProxyTarget() {}

function _getemployeeResignationModel() {
  const { getTenantConnection } = require('../db');
  const { getModelsForConnection } = require('../utilities/modelLoader');
  const { tenantLocalStorage } = require('../utilities/tenantContext');
  const store = tenantLocalStorage ? tenantLocalStorage.getStore() : null;
  const dbName = store && store.dbName ? store.dbName : 'hrdb';
  const connection = getTenantConnection(dbName);
  const models = getModelsForConnection(connection);
  return models["employeeResignation"];
}

module.exports = new Proxy(_employeeResignationProxyTarget, {
  get(target, prop) {
    if (prop === 'name') return "employeeResignation";
    if (prop === 'schema') return employeeResignationSchema;
    if (prop === '_name') return "employeeResignation";
    if (prop === '_schema') return employeeResignationSchema;
    const actualModel = _getemployeeResignationModel();
    if (!actualModel) throw new Error("Model employeeResignation not found for current tenant");
    if (typeof actualModel[prop] === 'function') return actualModel[prop].bind(actualModel);
    return actualModel[prop];
  },
  construct(target, args) {
    const actualModel = _getemployeeResignationModel();
    if (!actualModel) throw new Error("Model employeeResignation not found for current tenant");
    return new actualModel(...args);
  }
});
