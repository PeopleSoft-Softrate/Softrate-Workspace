const mongoose = require('mongoose');

const holidaySchema = new mongoose.Schema({
  
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },type: {
    type: String,
    enum: ['weekly', 'special'],
    required: true
  },
  day: {
    type: String, // Mon, Tue, etc.
    required: function() { return this.type === 'weekly' }
  },
  weeks: [{
    type: Number // 1,2,3,4,5
  }],
  fromDate: {
    type: Date,
    required: function() { return this.type === 'special' }
  },
  toDate: {
    type: Date,
    required: function() { return this.type === 'special' }
  },
  reason: {
    type: String,
    required: function() { return this.type === 'special' }
  }
}, {
  timestamps: true
});

// ✅ NO UNIQUE INDEXES - Multiple same dates allowed!

// Multi-Tenant Proxy Wrapper
// Target MUST be a function for the construct trap to work with new Model()
function _holidayProxyTarget() {}

function _getholidayModel() {
  const { getTenantConnection } = require('../db');
  const { getModelsForConnection } = require('../utilities/modelLoader');
  const { tenantLocalStorage } = require('../utilities/tenantContext');
  const store = tenantLocalStorage ? tenantLocalStorage.getStore() : null;
  const dbName = store && store.dbName ? store.dbName : 'hrdb';
  const connection = getTenantConnection(dbName);
  const models = getModelsForConnection(connection);
  return models["holiday"];
}

module.exports = new Proxy(_holidayProxyTarget, {
  get(target, prop) {
    if (prop === 'name') return "holiday";
    if (prop === 'schema') return holidaySchema;
    if (prop === '_name') return "holiday";
    if (prop === '_schema') return holidaySchema;
    const actualModel = _getholidayModel();
    if (!actualModel) throw new Error("Model holiday not found for current tenant");
    if (typeof actualModel[prop] === 'function') return actualModel[prop].bind(actualModel);
    return actualModel[prop];
  },
  construct(target, args) {
    const actualModel = _getholidayModel();
    if (!actualModel) throw new Error("Model holiday not found for current tenant");
    return new actualModel(...args);
  }
});
