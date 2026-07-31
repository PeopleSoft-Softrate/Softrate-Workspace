const mongoose = require('mongoose');

const clientSchema = new mongoose.Schema(
  {
    companyCode: { type: String, required: true, trim: true, index: true },
    clientId: { type: String, required: true, trim: true },
    companyName: { type: String, required: true, trim: true },
    normalizedCompanyName: { type: String, trim: true, default: '' },
    primaryContactName: { type: String, trim: true, default: '' },
    primaryPhone: { type: String, trim: true, default: '' },
    primaryEmail: { type: String, trim: true, default: '' },
    address: { type: String, trim: true, default: '' },
    gstNumber: { type: String, trim: true, uppercase: true, default: '' },
    description: { type: String, trim: true, default: '' },
    status: { type: String, trim: true, default: 'Onboarded' },
    source: { type: String, trim: true, default: 'manual' },
    sourceLeadIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Lead' }],
    assignedEmployeeIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Employee' }],
    onboardedAt: { type: Date },
  },
  { timestamps: true, collection: 'clients' }
);

clientSchema.index({ companyCode: 1, clientId: 1 }, { unique: true });
clientSchema.index({ companyCode: 1, normalizedCompanyName: 1 }, { unique: true });
clientSchema.index({ companyCode: 1, assignedEmployeeIds: 1, updatedAt: -1 });

module.exports = mongoose.models.Client || mongoose.model('Client', clientSchema);
