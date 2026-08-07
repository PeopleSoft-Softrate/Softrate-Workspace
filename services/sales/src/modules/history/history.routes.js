const express = require('express');
const History = require('../../../models/History');
const { companyMiddleware } = require('../../common/tenantMiddleware');
const router = express.Router();

router.use(companyMiddleware);

// GET — fetch history for a specific company/lead
router.get('/', async (req, res) => {
  const { History } = req.models;
  try {
    const { companyCode, contactNumber, companyName } = req.query;
    if (!companyCode) {
      return res.status(400).json({ success: false, message: 'companyCode is required.' });
    }

    const query = { companyCode };
    if (companyName) {
      query.companyName = companyName;
    }
    if (contactNumber) {
      query.contactNumber = contactNumber;
    }

    const logs = await History.find(query).sort({ timestamp: -1, createdAt: -1 });
    return res.status(200).json({ success: true, logs });
  } catch (err) {
    console.error('[get history]', err);
    return res.status(500).json({ success: false, message: 'Server error fetching history.' });
  }
});

// POST — add a new history log entry manually
router.post('/', async (req, res) => {
  const { History } = req.models;
  try {
    const { companyCode, contactNumber, companyName, action, details, contactName: cName } = req.body;
    if (!companyCode || !action) {
      return res.status(400).json({ success: false, message: 'companyCode and action are required.' });
    }

    const log = new History({
      companyCode,
      contactNumber: contactNumber || '',
      companyName: companyName || '',
      contactName: cName || '',
      action,
      details: details || '',
      changedBy: req.user ? req.user._id : null,
      timestamp: new Date()
    });
    
    await log.save();
    return res.status(201).json({ success: true, log });
  } catch (err) {
    console.error('[post history]', err);
    return res.status(500).json({ success: false, message: 'Server error creating history log.' });
  }
});

module.exports = router;
