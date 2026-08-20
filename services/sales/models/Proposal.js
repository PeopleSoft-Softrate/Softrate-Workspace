const mongoose = require('mongoose');

const proposalSchema = new mongoose.Schema({
  companyCode: { type: String, required: true, index: true },
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null, index: true },
  employeeName: { type: String, default: '' },
  clientId: { type: String, default: '', index: true },
  leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', default: null, index: true },
  leadCode: { type: String, default: '', index: true },
  leadCompanyName: { type: String, required: true },
  contactName: { type: String, default: '' },
  contactNumber: { type: String, default: '' },
  directorEmailAddress: { type: String, default: '' },
  proposalNumber: { type: String, required: true, index: true },
  versionNo: { type: Number, default: 1 },
  templateId: { type: String, default: '' },
  templateName: { type: String, default: '' },
  valuesSnapshot: { type: mongoose.Schema.Types.Mixed, default: {} },
  pagesSnapshot: { type: mongoose.Schema.Types.Mixed, default: [] },
  proposalDate: { type: Date, default: Date.now, index: true },
  status: { type: String, enum: ['draft', 'generated', 'sent', 'accepted', 'declined'], default: 'generated' },
  createdByRole: { type: String, enum: ['employee', 'admin'], default: 'employee' },
  createdByName: { type: String, default: '' },
  createdById: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null },
  companySnapshot: {
    name: { type: String, default: '' },
    logo: { type: String, default: '' },
    registeredAddress: { type: String, default: '' },
    phone: { type: String, default: '' },
    email: { type: String, default: '' },
    website: { type: String, default: '' },
    gstNumber: { type: String, default: '' },
    footer: { type: String, default: '' },
  },
}, { timestamps: true });

proposalSchema.index({ companyCode: 1, leadId: 1, versionNo: -1 });
proposalSchema.index({ companyCode: 1, proposalDate: -1 });

module.exports = mongoose.model('Proposal', proposalSchema);
