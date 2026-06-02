const mongoose = require('mongoose');

const employeeTerminationSchema = new mongoose.Schema({
  
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },employeeId: {
    type: String,
    required: true,
    index: true
  },
  employeeName: {
    type: String,
    required: true
  },
  department: {
    type: String,
    required: true
  },
  designation: {
    type: String,
    required: true
  },
  terminationDate: {
    type: Date,
    required: true
  },
  lastWorkingDay: {
    type: Date,
    required: true
  },
  reason: {
    type: String,
    required: true,
    enum: [
      'Termination During Probation',
      'Termination Due to Performance Issues',
      'Termination Due to Attendance / Absenteeism',
      'Termination Due to Misconduct',
      'Termination Due to Policy Violation',
      'Role Redundancy / Business Decision',
      'Violation of Confidentiality / NDA',
      'Fraud / Integrity Concern',
      'Other'
    ]
  },
  otherReason: {
    type: String,
    maxlength: 500
  },
  showCauseNotice: {
    type: Boolean,
    default: false
  },
  showCauseNoticeDoc: {
    type: String, // File name or URL
    maxlength: 500
  },
  performanceLogs: {
    type: String, // File name or URL
    maxlength: 500,
    default: ''
  },
  status: {
    type: String,
    enum: ['terminated', 'cancelled'],
    default: 'terminated'
  },
  terminatedAt: {
    type: Date,
    default: Date.now
  },
  terminatedBy: {
    type: String,
    default: 'HR'
  },
  cancelledAt: {
    type: Date
  },
  cancelledBy: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for efficient querying
employeeTerminationSchema.index({ employeeId: 1, status: 1 });
employeeTerminationSchema.index({ terminationDate: -1 });
employeeTerminationSchema.index({ status: 1, terminatedAt: -1 });

// Multi-Tenant Proxy Wrapper
// Target MUST be a function for the construct trap to work with new Model()
function _employeeTerminationProxyTarget() {}

function _getemployeeTerminationModel() {
  const { getTenantConnection } = require('../db');
  const { getModelsForConnection } = require('../utilities/modelLoader');
  const { tenantLocalStorage } = require('../utilities/tenantContext');
  const store = tenantLocalStorage ? tenantLocalStorage.getStore() : null;
  const dbName = store && store.dbName ? store.dbName : 'hrdb';
  const connection = getTenantConnection(dbName);
  const models = getModelsForConnection(connection);
  return models["employeeTermination"];
}

module.exports = new Proxy(_employeeTerminationProxyTarget, {
  get(target, prop) {
    if (prop === 'name') return "employeeTermination";
    if (prop === 'schema') return employeeTerminationSchema;
    if (prop === '_name') return "employeeTermination";
    if (prop === '_schema') return employeeTerminationSchema;
    const actualModel = _getemployeeTerminationModel();
    if (!actualModel) throw new Error("Model employeeTermination not found for current tenant");
    if (typeof actualModel[prop] === 'function') return actualModel[prop].bind(actualModel);
    return actualModel[prop];
  },
  construct(target, args) {
    const actualModel = _getemployeeTerminationModel();
    if (!actualModel) throw new Error("Model employeeTermination not found for current tenant");
    return new actualModel(...args);
  }
});
