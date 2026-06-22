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
    const { role, userId } = req.query; // 'employee', 'intern', or fetch all
    let filter = { companyId: req.tenant.companyId };
    
    let audienceFilter = ['all'];
    if (role === 'employee') audienceFilter.push('employee');
    else if (role === 'intern') audienceFilter.push('intern');
    else if (role === 'hr') audienceFilter.push('hr');
    else if (role === 'manager') audienceFilter.push('manager');

    if (userId) {
      filter.$or = [
        { targetAudience: { $in: audienceFilter } },
        { targetUserId: userId }
      ];
      filter.deletedBy = { $ne: userId };
    } else {
      filter.targetAudience = { $in: audienceFilter };
    }
    
    let notifications = await Notification.find(filter).sort({ createdAt: -1 }).limit(50);
    
    if (userId) {
      notifications = notifications.map(notif => {
        const notifObj = notif.toObject();
        if (notifObj.targetAudience !== 'specific_user') {
          notifObj.read = notifObj.readBy && notifObj.readBy.includes(userId);
        }
        return notifObj;
      });
    }

    res.json({ success: true, notifications });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Mark notification as read
router.put('/:id/read', verifyTenant, async (req, res) => {
  try {
    const notification = await Notification.findOne({
      _id: req.params.id,
      companyId: req.tenant.companyId
    });

    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    if (notification.targetAudience === 'specific_user') {
      notification.read = true;
    } else {
      if (!notification.readBy.includes(req.user.id)) {
        notification.readBy.push(req.user.id);
      }
    }
    await notification.save();

    res.json({ success: true, notification });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete notification
router.delete('/:id', verifyTenant, async (req, res) => {
  try {
    const notification = await Notification.findOne({
      _id: req.params.id,
      companyId: req.tenant.companyId
    });
    
    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    if (notification.targetAudience === 'specific_user') {
      await Notification.findByIdAndDelete(req.params.id);
    } else {
      if (!notification.deletedBy.includes(req.user.id)) {
        notification.deletedBy.push(req.user.id);
        await notification.save();
      }
    }

    res.json({ success: true, message: 'Notification deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
