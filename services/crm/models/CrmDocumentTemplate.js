const mongoose = require('mongoose');

const crmDocumentTemplateSchema = new mongoose.Schema(
  {
    companyCode: { type: String, trim: true, default: '' },
    type: { type: String, enum: ['NDA'], required: true },
    name: { type: String, trim: true, default: 'NDA Format Sample' },
    template: { type: mongoose.Schema.Types.Mixed, default: {} },
    updatedBy: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

crmDocumentTemplateSchema.index({ companyCode: 1, type: 1 }, { unique: true });

module.exports = mongoose.models.CrmDocumentTemplate
  || mongoose.model('CrmDocumentTemplate', crmDocumentTemplateSchema);
