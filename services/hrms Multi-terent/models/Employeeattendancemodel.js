const mongoose = require("mongoose");

const EmployeeAttendanceSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    employeeId: {
      type: String,
      required: true,
    },

    date: {
      type: String,
      required: true,
    },

    punchInTime: {
      type: Date,
      default: null,
    },

    punchOutTime: {
      type: Date,
      default: null,
    },

    duration: {
      type: String,
      default: "00:00",
    },

    punchInLocation: {
      type: String,
      default: "",
    },

    punchOutLocation: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

// Multi-Tenant Proxy Wrapper
// Target MUST be a function for the construct trap to work with new Model()
function _EmployeeAttendanceProxyTarget() {}

function _getEmployeeAttendanceModel() {
  const { getTenantConnection } = require('../db');
  const { getModelsForConnection } = require('../utilities/modelLoader');
  const { tenantLocalStorage } = require('../utilities/tenantContext');
  const store = tenantLocalStorage ? tenantLocalStorage.getStore() : null;
  const dbName = store && store.dbName ? store.dbName : 'hrdb';
  const connection = getTenantConnection(dbName);
  const models = getModelsForConnection(connection);
  return models["EmployeeAttendance"];
}

module.exports = new Proxy(_EmployeeAttendanceProxyTarget, {
  get(target, prop) {
    if (prop === 'name') return "EmployeeAttendance";
    if (prop === 'schema') return EmployeeAttendanceSchema;
    if (prop === '_name') return "EmployeeAttendance";
    if (prop === '_schema') return EmployeeAttendanceSchema;
    const actualModel = _getEmployeeAttendanceModel();
    if (!actualModel) throw new Error("Model EmployeeAttendance not found for current tenant");
    if (typeof actualModel[prop] === 'function') return actualModel[prop].bind(actualModel);
    return actualModel[prop];
  },
  construct(target, args) {
    const actualModel = _getEmployeeAttendanceModel();
    if (!actualModel) throw new Error("Model EmployeeAttendance not found for current tenant");
    return new actualModel(...args);
  }
});
