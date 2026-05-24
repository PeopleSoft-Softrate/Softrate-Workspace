const mongoose = require('mongoose');
const { normalizePhone, normalizeText } = require('../services/leadNormalization');

const clientSchema = new mongoose.Schema({
  companyCode: { type: String, required: true, trim: true, index: true },
  clientId: { type: String, required: true, trim: true },
  companyName: { type: String, required: true, trim: true },
  normalizedCompanyName: { type: String, required: true, trim: true },
  primaryContactName: { type: String, trim: true, default: '' },
  primaryPhone: { type: String, trim: true, default: '' },
  primaryPhoneNormalized: { type: String, trim: true, default: '' },
  primaryEmail: { type: String, trim: true, lowercase: true, default: '' },
  address: { type: String, trim: true, default: '' },
  description: { type: String, trim: true, default: '' },
  status: { type: String, enum: ['Onboarded', 'Inactive'], default: 'Onboarded' },
  source: { type: String, enum: ['converted_lead', 'manual'], default: 'manual' },
  sourceLeadIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Lead' }],
  assignedEmployeePhones: [{ type: String, trim: true }],
  onboardedByRole: { type: String, enum: ['employee', 'admin', 'system'], default: 'system' },
  onboardedByName: { type: String, trim: true, default: '' },
  onboardedByPhone: { type: String, trim: true, default: '' },
  onboardedAt: { type: Date, default: Date.now },
}, { timestamps: true });

clientSchema.pre('validate', function normalizeClient(next) {
  this.companyCode = String(this.companyCode || '').trim();
  this.clientId = String(this.clientId || '').trim();
  this.companyName = String(this.companyName || '').trim();
  this.normalizedCompanyName = normalizeText(this.companyName);
  this.primaryContactName = String(this.primaryContactName || '').trim();
  this.primaryPhone = String(this.primaryPhone || '').trim();
  this.primaryPhoneNormalized = normalizePhone(this.primaryPhone);
  this.primaryEmail = String(this.primaryEmail || '').trim().toLowerCase();
  this.address = String(this.address || '').trim();
  this.description = String(this.description || '').trim();
  this.assignedEmployeePhones = Array.from(new Set((this.assignedEmployeePhones || []).map((phone) => String(phone || '').trim()).filter(Boolean)));
  next();
});

clientSchema.index({ companyCode: 1, clientId: 1 }, { unique: true });
clientSchema.index({ companyCode: 1, normalizedCompanyName: 1 }, { unique: true });
clientSchema.index({ companyCode: 1, assignedEmployeePhones: 1, updatedAt: -1 });
clientSchema.index({
  companyName: 'text',
  primaryContactName: 'text',
  primaryEmail: 'text',
  primaryPhone: 'text',
  clientId: 'text',
});

module.exports = mongoose.models.Client || mongoose.model('Client', clientSchema);
