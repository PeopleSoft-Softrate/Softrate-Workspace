const mongoose = require('mongoose');

const employeeTargetSchema = new mongoose.Schema({
  companyCode: { type: String, required: true, index: true },
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
  year: { type: Number, required: true },
  month: { type: Number, required: true },
  targetAmount: { type: Number, default: 0 },
}, { timestamps: true });

employeeTargetSchema.index({ companyCode: 1, employeeId: 1, year: 1, month: 1 }, { unique: true });

module.exports = mongoose.model('EmployeeTarget', employeeTargetSchema);
