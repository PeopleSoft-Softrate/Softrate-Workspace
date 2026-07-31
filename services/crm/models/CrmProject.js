const mongoose = require('mongoose');

const crmProjectSchema = new mongoose.Schema(
  {
    companyCode: { type: String, trim: true, default: '' },
    clientId: { type: String, trim: true, default: '' },
    clientCompanyName: { type: String, required: true, trim: true },
    clientStatus: { type: String, trim: true, default: 'Onboarded' },
    projectManagerName: { type: String, trim: true, default: '' },
    projectManagerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    projectManagerEmail: { type: String, trim: true, default: '' },
    projectManagerRole: { type: String, trim: true, default: 'project_manager' },
    status: {
      type: String,
      enum: ['Assigned', 'In Progress', 'On Hold', 'Completed'],
      default: 'Assigned',
    },
    notes: { type: String, trim: true, default: '' },
    mappedBy: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

crmProjectSchema.index({ companyCode: 1, clientCompanyName: 1 }, { unique: true });
crmProjectSchema.index(
  { companyCode: 1, clientId: 1 },
  { unique: true, partialFilterExpression: { clientId: { $type: 'string' } } }
);
crmProjectSchema.index({ companyCode: 1, projectManagerId: 1 });
crmProjectSchema.index({ companyCode: 1, status: 1 });

module.exports = mongoose.models.CrmProject || mongoose.model('CrmProject', crmProjectSchema);
