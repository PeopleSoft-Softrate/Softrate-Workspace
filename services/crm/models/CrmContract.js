const mongoose = require('mongoose');

const crmContractSchema = new mongoose.Schema(
  {
    companyCode: { type: String, trim: true, default: '' },
    clientCompanyName: { type: String, required: true, trim: true },
    contactName: { type: String, trim: true, default: '' },
    contactEmail: { type: String, trim: true, default: '' },
    type: { type: String, enum: ['SLA', 'NDA'], required: true },
    documentNumber: { type: String, required: true, unique: true },
    title: { type: String, required: true, trim: true },
    status: { type: String, enum: ['Draft', 'Generated', 'Sent', 'Signed', 'Expired'], default: 'Generated' },
    effectiveFrom: { type: Date, default: Date.now },
    effectiveTo: { type: Date },
    generatedBy: { type: String, trim: true, default: 'CRM Admin' },
    content: { type: String, trim: true, default: '' },
    pdfFileName: { type: String, trim: true, default: '' },
    pdfBase64: { type: String, select: false, default: '' },
    templateSnapshot: { type: mongoose.Schema.Types.Mixed, select: false, default: undefined },
  },
  { timestamps: true }
);

module.exports = mongoose.models.CrmContract || mongoose.model('CrmContract', crmContractSchema);
