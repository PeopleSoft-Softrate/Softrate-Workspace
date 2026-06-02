const mongoose = require("mongoose");

const LeaveSchema = new mongoose.Schema({
  
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },internId: { type: String, required: true },
  internName: { type: String, required: true },
  leaveType: { type: String, required: true },
  fromDate: { type: Date, required: true },
  toDate: { type: Date, required: true },
  numberOfDays: { type: Number, required: true },
  reason: { type: String, required: true },
  status: { type: String, default: "pending" },
  rejectionReason: { type: String, default: "" },
  perDayDurations: { type: Map, of: String, default: {} },
  perDayDurations: {
  type: Object,
  default: {},
},

});

// Multi-Tenant Proxy Wrapper
// Target MUST be a function for the construct trap to work with new Model()
function _LeaveProxyTarget() {}

function _getLeaveModel() {
  const { getTenantConnection } = require('../db');
  const { getModelsForConnection } = require('../utilities/modelLoader');
  const { tenantLocalStorage } = require('../utilities/tenantContext');
  const store = tenantLocalStorage ? tenantLocalStorage.getStore() : null;
  const dbName = store && store.dbName ? store.dbName : 'hrdb';
  const connection = getTenantConnection(dbName);
  const models = getModelsForConnection(connection);
  return models["Leave"];
}

module.exports = new Proxy(_LeaveProxyTarget, {
  get(target, prop) {
    if (prop === 'name') return "Leave";
    if (prop === 'schema') return LeaveSchema;
    if (prop === '_name') return "Leave";
    if (prop === '_schema') return LeaveSchema;
    const actualModel = _getLeaveModel();
    if (!actualModel) throw new Error("Model Leave not found for current tenant");
    if (typeof actualModel[prop] === 'function') return actualModel[prop].bind(actualModel);
    return actualModel[prop];
  },
  construct(target, args) {
    const actualModel = _getLeaveModel();
    if (!actualModel) throw new Error("Model Leave not found for current tenant");
    return new actualModel(...args);
  }
});
