const mongoose = require('mongoose');

const historySchema = new mongoose.Schema({
  companyCode:   { type: String, required: true, index: true },
  contactNumber: { type: String, required: true, index: true },
  contactName:   { type: String },
  companyName:   { type: String },
  dealName:      { type: String },
  action:        { type: String, required: true },
  oldValue:      { type: mongoose.Schema.Types.Mixed },
  newValue:      { type: mongoose.Schema.Types.Mixed },
  details:       { type: String },
  changedBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null }, // ObjectId of employee
  timestamp:     { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('History', historySchema);
