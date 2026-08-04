const crypto = require('crypto');
const EmailConnection = require('../model/email-connection.model');

// ── Encryption config ─────────────────────────────────────────────────────────
// ENCRYPTION_KEY must be a 64-char hex string (32 bytes).
// Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY
  ? Buffer.from(process.env.ENCRYPTION_KEY, 'hex')
  : null;

const ALGORITHM = 'aes-256-gcm';

// ── AES-256-GCM Encrypt ───────────────────────────────────────────────────────
function encrypt(plaintext) {
  if (!ENCRYPTION_KEY) throw new Error('ENCRYPTION_KEY is not set in environment.');
  const iv = crypto.randomBytes(12); // 96-bit IV for GCM
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // Store as hex:hex:hex so we can parse it back
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

// ── AES-256-GCM Decrypt ───────────────────────────────────────────────────────
function decrypt(ciphertext) {
  if (!ENCRYPTION_KEY) throw new Error('ENCRYPTION_KEY is not set in environment.');
  const [ivHex, authTagHex, dataHex] = ciphertext.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const data = Buffer.from(dataHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

// ── Service Methods ───────────────────────────────────────────────────────────

/**
 * Fetch the email connection record for a company employee.
 * @param {string} companyCode
 * @param {string} userId
 * @returns {Promise<object|null>}
 */
async function getConnection(companyCode, userId = 'admin') {
  return EmailConnection.findOne({ companyCode, userId });
}

/**
 * Upsert an email connection (save encrypted refresh token).
 * @param {string} companyCode
 * @param {string} userId
 * @param {{ provider: string, email: string, refreshToken: string }} data
 */
async function saveConnection(companyCode, userId, { provider, email, refreshToken }) {
  const encryptedToken = refreshToken ? encrypt(refreshToken) : '';
  return EmailConnection.findOneAndUpdate(
    { companyCode, userId, provider },
    {
      companyCode,
      userId,
      provider,
      email,
      connected: true,
      refreshToken: encryptedToken,
    },
    { upsert: true, returnDocument: 'after' }
  );
}

/**
 * Mark a connection as disconnected and clear stored credentials.
 * @param {string} companyCode
 * @param {string} userId
 * @param {string} provider
 */
async function disconnectConnection(companyCode, userId = 'admin', provider = 'google') {
  return EmailConnection.findOneAndUpdate(
    { companyCode, userId, provider },
    {
      connected: false,
      email: '',
      refreshToken: '',
    },
    { returnDocument: 'after' }
  );
}

/**
 * Build a safe public-facing status object (no tokens exposed).
 * @param {object|null} conn
 */
function buildStatusPayload(conn) {
  if (!conn || !conn.connected) {
    return { connected: false, provider: null, email: null, connectedAt: null };
  }
  return {
    connected: true,
    provider: conn.provider,
    email: conn.email,
    connectedAt: conn.updatedAt,
  };
}

module.exports = {
  getConnection,
  saveConnection,
  disconnectConnection,
  buildStatusPayload,
  encrypt,
  decrypt,
};
