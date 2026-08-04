const express = require('express');
const router = express.Router();
const { connectGoogle, googleCallback, getStatus, disconnect } = require('../controller/email.controller');
const { requireCompanyAdmin, requireEmployee } = require('../middleware/email.auth.middleware');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

/* ─────────────────────────────────────────────────────────────────────────────
   Email Integration Routes
   All routes are mounted at: /api/email
─────────────────────────────────────────────────────────────────────────────

  GET  /api/email/google/connect    → Generate OAuth consent URL (company_admin only)
  GET  /api/email/google/callback   → Google OAuth callback (no auth, public — Google calls this)
  GET  /api/email/status            → Get current connection status (company_admin only)
  POST /api/email/disconnect        → Disconnect provider (company_admin only)
*/

// Generate Google OAuth URL
router.get('/google/connect', requireEmployee, connectGoogle);

// OAuth callback — must be public (Google redirects here without token)
router.get('/google/callback', googleCallback);

// Get email integration status
router.get('/status', requireEmployee, getStatus);

// Disconnect email provider
router.post('/disconnect', requireEmployee, disconnect);

// Send email from CRM (used by employees)
router.post('/send', requireEmployee, upload.array('attachments'), require('../controller/email.controller').sendEmailFromCRMController);

module.exports = router;
