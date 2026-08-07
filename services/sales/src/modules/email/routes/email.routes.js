const express = require('express');
const router = express.Router();
const { requireEmployee } = require('../middleware/email.auth.middleware');
const { tenantMiddleware } = require('../../../common/tenantMiddleware');
const { sendEmailFromCRMController } = require('../controller/email.controller');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });



// Get email integration status for the tenant
router.get('/status', requireEmployee, tenantMiddleware, require('../controller/email.controller').getEmailStatus);

// Send email from CRM (used by employees)
router.post('/send', requireEmployee, tenantMiddleware, upload.array('attachments'), require('../controller/email.controller').sendEmailFromCRMController);

module.exports = router;
