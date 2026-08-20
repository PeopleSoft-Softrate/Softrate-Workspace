const mongoose = require('mongoose');
const {
  formatCode,
  formatCompanyName,
  formatDescription,
  formatEmail,
  formatLocation,
  formatPersonName,
  normalizePhone,
  normalizeRemarks,
  normalizeText,
  toTitleCase,
} = require('../services/leadNormalization');

const leadSchema = new mongoose.Schema({
  companyCode:         { type: String, required: true },
  leadId:              { type: String, default: '', index: true },
  assignedEmployeeId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  leadCompanyName:     { type: String, required: true },
  contactName:         { type: String, default: '' },
  contactNumber:       { type: String, required: true },
  status:              { type: String, default: 'New' },
  setLabel:            { type: String, default: '' },
  companyDescription:  { type: String, default: '' },
  mainDivisionDescription: { type: String, default: '' },
  directorEmailAddress: { type: String, default: '' },
  remarks:             { type: [String], default: [] },
  isStarred:           { type: Boolean, default: false },
  isFavourite:         { type: Boolean, default: false },
  sheetOrder:          { type: Number, default: 0 },
  contactNumberNormalized: { type: String, default: '' },
  leadCompanyNameLower: { type: String, default: '' },
  contactNameLower:    { type: String, default: '' },
  directorEmailLower:  { type: String, default: '' },
  setLabelLower:       { type: String, default: '' },
  isArchived:          { type: Boolean, default: false, index: true },
  importBatchId:       { type: mongoose.Schema.Types.ObjectId, ref: 'LeadImportBatch', default: null },
  
  // New Fields
  cin: { type: String, default: '' },
  dateOfIncorporation: { type: String, default: '' },
  companyEmail: { type: String, default: '' },
  authorisedCapital: { type: String, default: '' },
  paidUpCapital: { type: String, default: '' },
  totalObligationOfContribution: { type: String, default: '' },
  
  addressType: { type: String, default: '' },
  streetAddressLine1: { type: String, default: '' },
  streetAddressLine2: { type: String, default: '' },
  city: { type: String, default: '' },
  state: { type: String, default: '' },
  postalCode: { type: String, default: '' },
  
  directorDin: { type: String, default: '' },
  directorFirstName: { type: String, default: '' },
  directorLastName: { type: String, default: '' },
  directorMobileNumber: { type: String, default: '' },
  
  directorPermanentAddressLine1: { type: String, default: '' },
  directorPermanentAddressLine2: { type: String, default: '' },
  directorPermanentCity: { type: String, default: '' },
  directorPermanentState: { type: String, default: '' },
  directorPermanentPincode: { type: String, default: '' },
  
  directorPresentAddressLine1: { type: String, default: '' },
  directorPresentAddressLine2: { type: String, default: '' },
  directorPresentCity: { type: String, default: '' },
  directorPresentState: { type: String, default: '' },
  directorPresentPincode: { type: String, default: '' },
  
  mainDivisionNo: { type: String, default: '' },
  companyType: { type: String, default: '' },
  classOfCompany: { type: String, default: '' },
  companyCategory: { type: String, default: '' },
  companySubcategory: { type: String, default: '' },
  registrationNumber: { type: String, default: '' },
  companyOrigin: { type: String, default: '' },
  roc: { type: String, default: '' },

  // ── Pipeline fields (added for Sales Pipeline Kanban) ──────────
  // pipelineStage defaults to null; backfill script maps from existing status
  pipelineStage:        { type: String, default: null },   // NEW|CONNECTED|QUALIFICATION|NEEDS_ANALYSIS|VALUE_PROPOSITION|PROPOSAL_QUOTE|NEGOTIATION_REVIEW|CLOSED_WON|CLOSED_LOST
  connectionOutcome:    { type: String, default: '' },     // NOT_CONNECTED|DNR|BUSY|NOT_REACHABLE
  qualificationOutcome: { type: String, default: '' },     // QUALIFIED|NOT_QUALIFIED
  qualificationReason:  { type: String, default: '' },     // NOT_INTERESTED|INVALID
  lostReason:           { type: String, default: '' },     // PRICE|WRONG_TIME|COMPETITION
  stageChangedAt:       { type: Date,   default: null },   // timestamp of last pipelineStage change
}, { timestamps: true });

leadSchema.pre('save', async function normalizeLead() {
  this.leadId = String(this.leadId ?? '').trim().toUpperCase();
  this.companyCode = String(this.companyCode ?? '').trim().toUpperCase();
  this.leadCompanyName = formatCompanyName(this.leadCompanyName);
  this.contactName = formatPersonName(this.contactName);
  this.contactNumber = String(this.contactNumber ?? '').trim();
  this.status = this.status ? toTitleCase(this.status) : 'New';
  this.setLabel = toTitleCase(this.setLabel);
  this.companyDescription = formatDescription(this.companyDescription);
  this.mainDivisionDescription = formatDescription(this.mainDivisionDescription);
  this.directorEmailAddress = formatEmail(this.directorEmailAddress);
  this.companyEmail = formatEmail(this.companyEmail);
  this.cin = formatCode(this.cin);
  this.registrationNumber = formatCode(this.registrationNumber);
  this.directorDin = formatCode(this.directorDin);
  this.roc = formatCode(this.roc);
  this.directorFirstName = formatPersonName(this.directorFirstName);
  this.directorLastName = formatPersonName(this.directorLastName);
  this.directorMobileNumber = String(this.directorMobileNumber ?? '').trim();
  this.city = formatLocation(this.city);
  this.state = formatLocation(this.state);
  this.postalCode = String(this.postalCode ?? '').trim();
  this.addressType = toTitleCase(this.addressType);
  this.streetAddressLine1 = toTitleCase(this.streetAddressLine1);
  this.streetAddressLine2 = toTitleCase(this.streetAddressLine2);
  this.directorPermanentCity = formatLocation(this.directorPermanentCity);
  this.directorPermanentState = formatLocation(this.directorPermanentState);
  this.directorPermanentPincode = String(this.directorPermanentPincode ?? '').trim();
  this.directorPermanentAddressLine1 = toTitleCase(this.directorPermanentAddressLine1);
  this.directorPermanentAddressLine2 = toTitleCase(this.directorPermanentAddressLine2);
  this.directorPresentCity = formatLocation(this.directorPresentCity);
  this.directorPresentState = formatLocation(this.directorPresentState);
  this.directorPresentPincode = String(this.directorPresentPincode ?? '').trim();
  this.directorPresentAddressLine1 = toTitleCase(this.directorPresentAddressLine1);
  this.directorPresentAddressLine2 = toTitleCase(this.directorPresentAddressLine2);
  this.companyType = toTitleCase(this.companyType);
  this.classOfCompany = toTitleCase(this.classOfCompany);
  this.companyCategory = toTitleCase(this.companyCategory);
  this.companySubcategory = toTitleCase(this.companySubcategory);
  this.companyOrigin = toTitleCase(this.companyOrigin);
  this.remarks = normalizeRemarks(this.remarks);
  this.contactNumberNormalized = normalizePhone(this.contactNumber);
  this.leadCompanyNameLower = normalizeText(this.leadCompanyName);
  this.contactNameLower = normalizeText(this.contactName);
  this.directorEmailLower = normalizeText(this.directorEmailAddress);
  this.setLabelLower = normalizeText(this.setLabel);
});

// Indexes using ObjectId
leadSchema.index({ companyCode: 1, leadId: 1 });
leadSchema.index({ companyCode: 1, leadCompanyNameLower: 1, leadId: 1 });
leadSchema.index({ companyCode: 1, assignedEmployeeId: 1, isArchived: 1, setLabelLower: 1, status: 1, sheetOrder: 1, _id: 1 });
leadSchema.index({ companyCode: 1, isArchived: 1, setLabelLower: 1, status: 1, sheetOrder: 1, _id: 1 });
leadSchema.index({ companyCode: 1, assignedEmployeeId: 1, contactNumberNormalized: 1 });
leadSchema.index({ companyCode: 1, contactNumberNormalized: 1 });
leadSchema.index({ companyCode: 1, assignedEmployeeId: 1, leadCompanyNameLower: 1 });
leadSchema.index({ companyCode: 1, assignedEmployeeId: 1, isArchived: 1, leadCompanyNameLower: 1, sheetOrder: 1, _id: 1 });
leadSchema.index({ companyCode: 1, leadCompanyNameLower: 1 });
leadSchema.index({ companyCode: 1, assignedEmployeeId: 1, isArchived: 1, isFavourite: 1, status: 1, sheetOrder: 1, _id: 1 });
leadSchema.index({ companyCode: 1, assignedEmployeeId: 1, isArchived: 1, updatedAt: -1, status: 1, _id: 1 });
leadSchema.index({ companyCode: 1, assignedEmployeeId: 1, contactNameLower: 1, sheetOrder: 1, _id: 1 });
leadSchema.index({ companyCode: 1, assignedEmployeeId: 1, directorEmailLower: 1, sheetOrder: 1, _id: 1 });
leadSchema.index({ companyCode: 1, assignedEmployeeId: 1, status: 1, sheetOrder: 1, _id: 1 });
leadSchema.index({
  leadCompanyName: 'text',
  contactName: 'text',
  directorEmailAddress: 'text',
  companyDescription: 'text',
  mainDivisionDescription: 'text',
  remarks: 'text',
});

module.exports = mongoose.model('Lead', leadSchema);
