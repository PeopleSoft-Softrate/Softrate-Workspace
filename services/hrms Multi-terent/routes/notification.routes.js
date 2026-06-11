const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const verifyTenant = require('../middleware/tenant.middleware');

// Create a new general notification (HR only)
router.post('/', verifyTenant, async (req, res) => {
  try {
    const { title, description, targetAudience } = req.body;
    
    if (!title || !description || !targetAudience) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    const notification = new Notification({
      companyId: req.tenant.companyId,
      title,
      description,
      targetAudience
    });

    await notification.save();
    res.status(201).json({ success: true, notification });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get notifications for a user based on their role/type
router.get('/', verifyTenant, async (req, res) => {
  try {
    const { role } = req.query; // 'employee', 'intern', or fetch all
    let filter = { companyId: req.tenant.companyId };
    
    if (role === 'employee') {
      filter.targetAudience = { $in: ['employee', 'all'] };
    } else if (role === 'intern') {
      filter.targetAudience = { $in: ['intern', 'all'] };
    }
    // HR gets all of them
    
    const notifications = await Notification.find(filter).sort({ createdAt: -1 }).limit(20);
    res.json({ success: true, notifications });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
