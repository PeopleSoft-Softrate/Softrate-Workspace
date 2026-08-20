const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema({
  name:         { type: String, required: true, trim: true },
  email:        { type: String, default: '', trim: true },
  countryCode:  { type: String, default: '+91', trim: true },
  mobile:       { type: String, required: true, trim: true },
  // companyCode kept for backward compat during transition — scoped by tenant DB
  companyCode:  { type: String, required: true, index: true },
  employeeCode: { type: String, default: '' },  // Optional — set by employee in app
  passwordHash: { type: String, default: '' },  // bcrypt hash — empty = no password set
  tags:         [{ type: String }],
  // Device info (updated on each sync from Flutter)
  deviceModel:  { type: String, default: '' },
  appVersion:   { type: String, default: '' },
  lastCallTime: { type: Date, default: null },
  lastSyncTime: { type: Date, default: null },
  forceSync:    { type: Boolean, default: false },
  allowedCompanies: [{ type: String, trim: true }],
  twoFactorEnabled: { type: Boolean, default: false },
  twoFactorSecret: { type: String, default: '' },
  twoFactorTempSecret: { type: String, default: '' },
  lastLoginDate: { type: String, default: '' },
  createdAt:    { type: Date, default: Date.now },
});

module.exports = mongoose.model('Employee', employeeSchema);
