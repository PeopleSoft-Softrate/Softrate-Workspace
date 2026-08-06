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
    
    // Manually fetch Lead and Client data to attach company name
    const Lead = require('../../../models/Lead');
    const Client = require('../../../models/Client');
    const leadIds = activities.map(a => a.leadId).filter(Boolean);
    
    if (leadIds.length > 0) {
      try {
        const LeadModel = req.models?.Lead || require('../../../models/Lead');
        const ClientModel = req.models?.Client || require('../../../models/Client');
        
        const leads = await LeadModel.find({ _id: { $in: leadIds } }, 'companyCode leadCompanyName contactName');
        const clients = await ClientModel.find({ _id: { $in: leadIds } }, 'companyCode companyName primaryContactName');
        
        const entityMap = {};
        leads.forEach(l => {
          entityMap[l._id.toString()] = {
            companyName: l.leadCompanyName,
            contactName: l.contactName,
            companyCode: l.companyCode
          };
        });
        clients.forEach(c => {
          entityMap[c._id.toString()] = {
            companyName: c.companyName,
            contactName: c.primaryContactName,
            companyCode: c.companyCode
          };
        });
        
        activities = activities.map(a => {
          if (a.leadId && entityMap[a.leadId]) {
            const ent = entityMap[a.leadId];
            a.companyName = ent.companyName || 'No Name';
            a.contactName = ent.contactName || '';
            a.leadName = `${a.companyName}${a.contactName ? ' (' + a.contactName + ')' : ''}`;
            a.companyCode = ent.companyCode;
          }
          return a;
        });
      } catch (err) {
        console.error('Error fetching leads/clients for activities:', err.message);
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

exports.updateActivity = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    const updatedActivity = await Activity.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true }
    );
    
    if (!updatedActivity) {
      return res.status(404).json({ success: false, message: 'Activity not found' });
    }
    
    res.status(200).json({ success: true, data: updatedActivity });
  } catch (error) {
    console.error('Error updating activity:', error);
    res.status(500).json({ success: false, message: 'Server error updating activity' });
  }
};
