const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },title: { type: String, required: true },
  client: { type: String },
  description: { type: String },
  startDate: { type: Date, default: Date.now },
  deadline: { type: Date },
  managerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  teamMembers: [{
    memberId: { type: mongoose.Schema.Types.ObjectId, required: true },
    memberType: { type: String, enum: ['intern', 'employee'], required: true },
    fullName: String
  }],
  checklist: [{
    task: { type: String, required: true },
    isCompleted: { type: Boolean, default: false },
    completedBy: { type: mongoose.Schema.Types.ObjectId, default: null }, // ID of the person who checked it
    completedAt: { type: Date }
  }],
  status: { type: String, enum: ['In Progress', 'Completed', 'On Hold'], default: 'In Progress' },
  progress: { type: Number, default: 0 } // Percentage 0-100
}, { timestamps: true });

// Pre-save middleware to calculate progress
projectSchema.pre('save', function() {
  if (this.checklist && this.checklist.length > 0) {
    const completedCount = this.checklist.filter(item => item.isCompleted).length;
    this.progress = Math.round((completedCount / this.checklist.length) * 100);
  } else {
    this.progress = 0;
  }
});

// Multi-Tenant Proxy Wrapper
// Target MUST be a function for the construct trap to work with new Model()
function _projectProxyTarget() {}

function _getprojectModel() {
  const { getTenantConnection } = require('../db');
  const { getModelsForConnection } = require('../utilities/modelLoader');
  const { tenantLocalStorage } = require('../utilities/tenantContext');
  const store = tenantLocalStorage ? tenantLocalStorage.getStore() : null;
  const dbName = store && store.dbName ? store.dbName : 'hrdb';
  const connection = getTenantConnection(dbName);
  const models = getModelsForConnection(connection);
  return models["project"];
}

module.exports = new Proxy(_projectProxyTarget, {
  get(target, prop) {
    if (prop === 'name') return "project";
    if (prop === 'schema') return projectSchema;
    if (prop === '_name') return "project";
    if (prop === '_schema') return projectSchema;
    const actualModel = _getprojectModel();
    if (!actualModel) throw new Error("Model project not found for current tenant");
    if (typeof actualModel[prop] === 'function') return actualModel[prop].bind(actualModel);
    return actualModel[prop];
  },
  construct(target, args) {
    const actualModel = _getprojectModel();
    if (!actualModel) throw new Error("Model project not found for current tenant");
    return new actualModel(...args);
  }
});
