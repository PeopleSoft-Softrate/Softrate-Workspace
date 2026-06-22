const mongoose = require("mongoose");

const leaveCounterSchema = new mongoose.Schema({
  
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },employeeId: {
    type: String,
    required: true,
    index: true
  },

  leaveType: {
    type: String,
    required: true
  },

  totalAllowed: {
    type: Number,
    required: true
  },

  used: {
    type: Number,
    default: 0
  },

  balance: {
    type: Number,
    required: true
  },

  cycleStartDate: {
    type: Date,
    required: true
  },

  nextResetDate: {
    type: Date,
    required: true
  },

  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Unique per tenant: same employee+leaveType can exist in different company DBs
leaveCounterSchema.index(
  { companyId: 1, employeeId: 1, leaveType: 1 },
  { unique: true }
);

// Multi-Tenant Proxy Wrapper
// Target MUST be a function for the construct trap to work with new Model()
function _leaveCounterProxyTarget() {}

function _getleaveCounterModel() {
  const { getTenantConnection } = require('../db');
  const { getModelsForConnection } = require('../utilities/modelLoader');
  const { tenantLocalStorage } = require('../utilities/tenantContext');
  const store = tenantLocalStorage ? tenantLocalStorage.getStore() : null;
  const dbName = store && store.dbName ? store.dbName : 'hrdb';
  const connection = getTenantConnection(dbName);
  const models = getModelsForConnection(connection);
  return models["LeaveCounter"];
}

module.exports = new Proxy(_leaveCounterProxyTarget, {
  get(target, prop) {
    if (prop === 'name') return "LeaveCounter";
    if (prop === 'schema') return leaveCounterSchema;
    if (prop === '_name') return "LeaveCounter";
    if (prop === '_schema') return leaveCounterSchema;
    const actualModel = _getleaveCounterModel();
    if (!actualModel) throw new Error("Model LeaveCounter not found for current tenant");
    if (typeof actualModel[prop] === 'function') return actualModel[prop].bind(actualModel);
    return actualModel[prop];
  },
  construct(target, args) {
    const actualModel = _getleaveCounterModel();
    if (!actualModel) throw new Error("Model leaveCounter not found for current tenant");
    return new actualModel(...args);
  }
});
