const mongoose = require('mongoose');

const dealSchema = new mongoose.Schema({
  companyCode: { type: String, required: true, index: true },
  leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', required: true, index: true },
  assignedEmployeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null, index: true },
  
  leadCompanyName: { type: String, required: true },
  contactName: { type: String, default: '' },
  contactNumber: { type: String, default: '' },
  directorEmailAddress: { type: String, default: '' },
  
  dealName: { type: String, required: true },
  amount: { type: Number, default: 0 },
  closingDate: { type: Date, default: null },
  description: { type: String, default: '' },
  
  pipelineStage: { type: String, default: 'NEW' }, // NEW|QUALIFICATION|NEEDS_ANALYSIS|VALUE_PROPOSITION|PROPOSAL_QUOTE|NEGOTIATION_REVIEW|CLOSED_WON|CLOSED_LOST
  connectionOutcome: { type: String, default: '' }, // NOT_CONNECTED|DNR|BUSY|NOT_REACHABLE
  qualificationOutcome: { type: String, default: '' }, // QUALIFIED|NOT_QUALIFIED
  qualificationReason: { type: String, default: '' }, // NOT_INTERESTED|INVALID
  lostReason: { type: String, default: '' }, // PRICE|WRONG_TIME|COMPETITION
  stageChangedAt: { type: Date, default: Date.now },
  
  createdByRole: { type: String, enum: ['employee', 'admin'], default: 'employee' },
  createdByName: { type: String, default: '' },
  createdById: { type: mongoose.Schema.Types.ObjectId, default: null },
}, { timestamps: true });

// Normalize and prepare text
dealSchema.pre('save', async function normalizeDeal() {
  this.companyCode = String(this.companyCode ?? '').trim();
  this.leadCompanyName = String(this.leadCompanyName ?? '').trim();
  this.contactName = String(this.contactName ?? '').trim();
  this.dealName = String(this.dealName ?? '').trim();
});

// Indexes for typical queries (Board view and Lead mapping)
dealSchema.index({ companyCode: 1, pipelineStage: 1, stageChangedAt: -1, updatedAt: -1, _id: -1 });
dealSchema.index({ companyCode: 1, assignedEmployeeId: 1, pipelineStage: 1 });
dealSchema.index({ companyCode: 1, leadId: 1 });
dealSchema.index({ companyCode: 1, qualificationOutcome: 1 });

module.exports = mongoose.model('Deal', dealSchema);
