const Activity = require('./activity.model');

exports.createActivity = async (req, res) => {
  try {
    const { leadId, type, title, description, activityDate } = req.body;
    // req.user should be populated by the auth middleware in actual implementation
    // For now, if we get employeeId in body, we use it, otherwise fallback.
    const employeeId = req.body.employeeId || req.user?._id;

    if (!employeeId) {
      return res.status(400).json({ success: false, message: 'Employee ID is required' });
    }

    const activity = new Activity({
      employeeId,
      leadId,
      type,
      title,
      description,
      activityDate
    });

    await activity.save();
    res.status(201).json({ success: true, data: activity });
  } catch (error) {
    console.error('Error creating activity:', error);
    res.status(500).json({ success: false, message: 'Server error creating activity' });
  }
};

exports.getEmployeeActivities = async (req, res) => {
  try {
    const { employeeId } = req.params;
    
    // Optionally filter by date range query params (start, end)
    const { start, end } = req.query;
    let query = { employeeId };

    if (start && end) {
      query.activityDate = {
        $gte: new Date(start),
        $lte: new Date(end)
      };
    }

    let activities = await Activity.find(query).sort({ activityDate: 1 }).lean();
    
    // Manually fetch Lead data to attach client name
    const Lead = require('../../../models/Lead');
    const leadIds = activities.map(a => a.leadId).filter(Boolean);
    
    if (leadIds.length > 0) {
      // Find matching leads. Since leadId is string, but Lead._id might be ObjectId,
      // mongoose handles casting automatically if they are valid ObjectIds.
      // If some leadIds are not valid ObjectIds, this query might fail. We should be safe if they are valid.
      try {
        const leads = await Lead.find({ _id: { $in: leadIds } }, 'companyName primaryContactName');
        const leadMap = {};
        leads.forEach(l => {
          leadMap[l._id.toString()] = l;
        });
        
        activities = activities.map(a => {
          if (a.leadId && leadMap[a.leadId]) {
            const l = leadMap[a.leadId];
            a.leadName = `${l.companyName} (${l.primaryContactName || 'No Name'})`;
          }
          return a;
        });
      } catch (err) {
        console.error('Error fetching leads for activities:', err.message);
      }
    }
    
    res.status(200).json({ success: true, data: activities });
  } catch (error) {
    console.error('Error fetching activities:', error);
    res.status(500).json({ success: false, message: 'Server error fetching activities' });
  }
};

exports.getLeadActivities = async (req, res) => {
  try {
    const { leadId } = req.params;
    let activities = await Activity.find({ leadId }).sort({ activityDate: -1 }).lean();
    res.status(200).json({ success: true, data: activities });
  } catch (error) {
    console.error('Error fetching lead activities:', error);
    res.status(500).json({ success: false, message: 'Server error fetching lead activities' });
  }
};
