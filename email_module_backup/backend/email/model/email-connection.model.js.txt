const mongoose = require('mongoose');

/**
 * email_connections collection
 * Stores Google Workspace (and future provider) OAuth credentials per company.
 * Refresh tokens are ALWAYS stored encrypted — never plaintext.
 */
const emailConnectionSchema = new mongoose.Schema(
  {
    companyCode: { type: String, required: true, index: true },
    userId: { type: String, default: 'admin' },
    provider: { type: String, required: true, default: 'google' },
    email: { type: String, default: '' },
    connected: { type: Boolean, default: false },
    // AES-256-GCM encrypted refresh token — format: iv:authTag:ciphertext (all hex)
    refreshToken: { type: String, default: '' },
  },
  { timestamps: true }
);

// One connection record per employee per provider
emailConnectionSchema.index({ companyCode: 1, userId: 1, provider: 1 }, { unique: true });

module.exports = mongoose.model('EmailConnection', emailConnectionSchema, 'email_connections');
