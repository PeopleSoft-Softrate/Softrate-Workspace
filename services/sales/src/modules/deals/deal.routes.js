const express = require('express');
const mongoose = require('mongoose');

const { tenantMiddleware } = require('../../common/tenantMiddleware');
const { logChange } = require('../../../services/historyService');
const eventBus = require('../../../services/eventBus');

const router = express.Router();
router.use(tenantMiddleware);

// ── GET /api/deals ───────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const companyCode = req.tenant.companyCode;
    const { leadId } = req.query;

    if (!leadId) {
      return res.status(400).json({ success: false, message: 'leadId is required' });
    }

    const deals = await req.models.Deal.find({ companyCode, leadId }).sort({ createdAt: -1 });

    return res.status(200).json({ success: true, data: deals });
  } catch (error) {
    console.error('Get deals error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── POST /api/deals ──────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const companyCode = req.tenant.companyCode;
    const user = req.employee;
    const { leadId, dealName, amount, closingDate, description } = req.body;

    if (!leadId || !dealName) {
      return res.status(400).json({ success: false, message: 'leadId and dealName are required' });
    }

    const lead = await req.models.Lead.findOne({ _id: leadId, companyCode });
    if (!lead) {
      return res.status(404).json({ success: false, message: 'Lead not found' });
    }

    // Determine initial stage based on lead's current pipelineStage or default to QUALIFICATION
    let initialStage = lead.pipelineStage;
    if (!initialStage || initialStage === 'NEW' || initialStage === 'CONNECTED') {
        initialStage = 'QUALIFICATION'; // Default for a new deal if lead isn't already deep in the pipeline
    }

    const deal = new req.models.Deal({
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

    await logChange({
      HistoryModel: req.models.History,
      companyCode,
      contactNumber: lead.contactNumber,
      contactName: lead.contactName,
      companyName: lead.leadCompanyName,
      dealName: dealName,
      action: 'DEAL_CREATED',
      details: 'New deal added: ' + dealName,
      changedBy: user._id,
    });
    const LeadModel = req.models.Lead;
    const targetCompanyName = String(lead.leadCompanyName || '').trim();
    
    if (targetCompanyName) {
      const allCompanyLeads = await LeadModel.find({ companyCode }).select('_id leadCompanyName');
      const matchedLeadIds = allCompanyLeads
        .filter(l => String(l.leadCompanyName || '').trim() === targetCompanyName)
        .map(l => l._id);
        
      if (matchedLeadIds.length > 0) {
        await LeadModel.updateMany(
          { _id: { $in: matchedLeadIds } },
          { $set: { status: 'Pipeline', pipelineStage: initialStage, updatedAt: new Date() } }
        );
      }
    } else {
      lead.status = 'Pipeline';
      lead.pipelineStage = initialStage;
      await lead.save();
    }

    const { invalidateLeadCaches } = require('../../../services/leadCache');
    await invalidateLeadCaches({ companyCode, employeeId: lead.assignedEmployeeId });

    eventBus.emitToCompany(companyCode, { type: 'PIPELINE_REFRESH' });
    eventBus.emitToCompany(companyCode, { type: 'LEADS_REFRESH' });

    return res.status(201).json({ success: true, data: deal });
  } catch (error) {
    console.error('Create deal error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
