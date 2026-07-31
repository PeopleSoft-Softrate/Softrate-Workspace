const mongoose = require('mongoose');

const leadImportBatchSchema = new mongoose.Schema(
  {
    companyCode: { type: String, required: true, index: true },
    assignedEmployeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', index: true },
    originalFileName: { type: String, default: '' },
    setLabel: { type: String, default: '' },
    status: {
      type: String,
      enum: ['queued', 'processing', 'completed', 'failed'],
      default: 'queued',
      index: true,
    },
    rowCount: { type: Number, default: 0 },
    insertedCount: { type: Number, default: 0 },
    duplicateCount: { type: Number, default: 0 },
    errorCount: { type: Number, default: 0 },
    errorSummary: { type: String, default: '' },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

leadImportBatchSchema.index({ companyCode: 1, assignedEmployeeId: 1, createdAt: -1 });

module.exports = mongoose.model('LeadImportBatch', leadImportBatchSchema);
