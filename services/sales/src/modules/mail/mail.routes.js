const express = require('express');
const multer = require('multer');
const { sendMail } = require('./mail.controller');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Accept multiple attachments with the field name 'attachments'
router.post('/send', upload.array('attachments'), sendMail);

module.exports = router;
