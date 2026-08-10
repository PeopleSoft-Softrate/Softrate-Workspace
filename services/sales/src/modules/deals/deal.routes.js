const express = require('express');
const mongoose = require('mongoose');
const Deal = require('../../../models/Deal');
const Lead = require('../../../models/Lead');
const History = require('../../../models/History');
const { companyMiddleware } = require('../../common/tenantMiddleware');
const { logChange } = require('../../../services/historyService');

const router = express.Router();
router.use(companyMiddleware);

// ── POST /api/deals ──────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { companyCode, user } = req;
    const { leadId, dealName, amount, closingDate, description } = req.body;

    if (!leadId || !dealName) {
      return res.status(400).json({ success: false, message: 'leadId and dealName are required' });
    }

    const lead = await Lead.findOne({ _id: leadId, companyCode });
    if (!lead) {
      return res.status(404).json({ success: false, message: 'Lead not found' });
    }

    // Determine initial stage based on lead's current pipelineStage or default to QUALIFICATION
    let initialStage = lead.pipelineStage;
    if (!initialStage || initialStage === 'NEW' || initialStage === 'CONNECTED') {
        initialStage = 'QUALIFICATION'; // Default for a new deal if lead isn't already deep in the pipeline
    }

    const deal = new Deal({
      companyCode,
      leadId: lead._id,
      assignedEmployeeId: lead.assignedEmployeeId,
      leadCompanyName: lead.leadCompanyName,
      contactName: lead.contactName,
      contactNumber: lead.contactNumber,
      directorEmailAddress: lead.directorEmailAddress,
      
      dealName,
      amount: amount ? Number(amount) : 0,
      closingDate: closingDate ? new Date(closingDate) : null,
      description: description || '',
      
      pipelineStage: initialStage,
      connectionOutcome: lead.connectionOutcome,
      qualificationOutcome: lead.qualificationOutcome,
      stageChangedAt: new Date(),
      
      createdByRole: user.role === 'employee' ? 'employee' : 'admin',
      createdByName: user.employeeName || user.email || '',
      createdById: user._id,
    });

    await deal.save();

    await logChange(companyCode, lead._id, 'DEAL_CREATED', 'New deal added: ' + dealName, req.user);

    return res.status(201).json({ success: true, data: deal });
  } catch (error) {
    console.error('Create deal error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
