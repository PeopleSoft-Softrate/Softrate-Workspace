const express = require('express');
const mongoose = require('mongoose');
const History = require('../../../models/History');
const { companyMiddleware } = require('../../common/tenantMiddleware');
const { logChange } = require('../../../services/historyService');
const { invalidateLeadCaches } = require('../../../services/leadCache');
const { pipelineToStatus } = require('./pipeline.mapper');

const router = express.Router();
router.use(companyMiddleware);

// ── Constants ──────────────────────────────────────────────────
const VALID_PIPELINE_STAGES = [
  'FOLLOW_UP', 'QUALIFICATION',
  'NEEDS_ANALYSIS', 'VALUE_PROPOSITION', 'PROPOSAL_QUOTE',
  'NEGOTIATION_REVIEW', 'CLOSED_WON', 'CLOSED_LOST',
];

const VALID_CONNECTION_OUTCOMES = ['NOT_CONNECTED', 'DNR', 'BUSY', 'SWITCH_OFF', 'NOT_REACHABLE'];
const VALID_QUALIFICATION_OUTCOMES = ['QUALIFIED', 'NOT_QUALIFIED'];
const VALID_QUALIFICATION_REASONS = ['NOT_INTERESTED', 'INVALID'];
const VALID_LOST_REASONS = ['PRICE', 'WRONG_TIME', 'COMPETITION'];

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

// ── Helpers ────────────────────────────────────────────────────

function parsePage(value) {
  const p = parseInt(String(value ?? '1'), 10);
  return Number.isFinite(p) && p > 0 ? p : 1;
}

function parsePageSize(value) {
  const p = parseInt(String(value ?? String(DEFAULT_PAGE_SIZE)), 10);
  if (!Number.isFinite(p) || p <= 0) return DEFAULT_PAGE_SIZE;
  return Math.min(p, MAX_PAGE_SIZE);
}

function buildBoardMatchQuery(companyCode, filters = {}) {
  const query = {
    companyCode,
    isArchived: { $ne: true },
    pipelineStage: { $ne: null, $exists: true },
  };
  if (filters.owner) {
    query.assignedEmployeeId = mongoose.Types.ObjectId.isValid(filters.owner) 
      ? new mongoose.Types.ObjectId(String(filters.owner)) 
      : filters.owner;
  }
  if (filters.connectionOutcome && VALID_CONNECTION_OUTCOMES.includes(filters.connectionOutcome)) {
    query.connectionOutcome = filters.connectionOutcome;
  }
  if (filters.qualificationOutcome && VALID_QUALIFICATION_OUTCOMES.includes(filters.qualificationOutcome)) {
    query.qualificationOutcome = filters.qualificationOutcome;
  }
  if (filters.search) {
    const searchRx = new RegExp(filters.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    query.$or = [
      { leadCompanyName: searchRx },
      { contactName: searchRx },
      { contactNumber: searchRx },
    ];
  }
  if (filters.stage && VALID_PIPELINE_STAGES.includes(filters.stage)) {
    query.pipelineStage = filters.stage;
  }
  return query;
}

// ── GET /api/pipeline/board ─────────────────────────────────────
// Returns all 10 columns with per-column pagination using $facet (single query)
router.get('/board', async (req, res) => {
  try {
    const { companyCode } = req.query;
    if (!companyCode) {
      return res.status(400).json({ success: false, message: 'companyCode is required.' });
    }

    const pageSize = parsePageSize(req.query.pageSize);
    const filters = {
      owner: req.query.owner || '',
      connectionOutcome: req.query.connectionOutcome || '',
      qualificationOutcome: req.query.qualificationOutcome || '',
      search: req.query.search || '',
    };

    const matchQuery = buildBoardMatchQuery(companyCode, filters);
    const LeadModel = req.models.Lead;

    // 1. Get total counts per stage
    const countResults = await LeadModel.aggregate([
      { $match: matchQuery },
      { $group: { _id: '$pipelineStage', count: { $sum: 1 } } }
    ]);
    const countsMap = countResults.reduce((acc, row) => {
      acc[row._id] = row.count;
      return acc;
    }, {});

    // 2. Build $facet branches for top N leads per stage
    const facetBranches = {};
    for (const stage of VALID_PIPELINE_STAGES) {
      facetBranches[stage] = [
        { $match: { pipelineStage: stage } },
        { $sort: { stageChangedAt: -1, updatedAt: -1, _id: -1 } },
        { $limit: pageSize },
      ];
    }

    // 3. Single aggregation for leads
    const [raw] = await LeadModel.aggregate([
      { $match: matchQuery },
      { $facet: facetBranches },
    ]);

    const STAGE_LABELS = {
      FOLLOW_UP: 'Follow Up',
      QUALIFICATION: 'Qualification', NEEDS_ANALYSIS: 'Needs Analysis',
      VALUE_PROPOSITION: 'Value Proposition', PROPOSAL_QUOTE: 'Proposal / Price Quote',
      NEGOTIATION_REVIEW: 'Negotiation / Review', CLOSED_WON: 'Closed Won', CLOSED_LOST: 'Closed Lost',
    };

    const columns = VALID_PIPELINE_STAGES.map((stage) => {
      const leads = raw?.[stage] || [];
      const total = countsMap[stage] || 0;
      return {
        stage,
        label: STAGE_LABELS[stage],
        leads,
        total,
        page: 1,
        pageSize,
        hasMore: total > leads.length,
      };
    });

    // Summary stats
    const openStages = VALID_PIPELINE_STAGES.filter(s => s !== 'CLOSED_WON' && s !== 'CLOSED_LOST');
    const openCount = openStages.reduce((sum, s) => {
      const col = columns.find(c => c.stage === s);
      return sum + (col?.total || 0);
    }, 0);
    const wonCount = columns.find(c => c.stage === 'CLOSED_WON')?.total || 0;
    const lostCount = columns.find(c => c.stage === 'CLOSED_LOST')?.total || 0;
    const qualifiedCount = await LeadModel.countDocuments({
      ...matchQuery,
      qualificationOutcome: 'QUALIFIED',
    });

    return res.status(200).json({
      success: true,
      columns,
      summary: { openCount, wonCount, lostCount, qualifiedCount },
    });
  } catch (err) {
    console.error('[pipeline board]', err);
    return res.status(500).json({ success: false, message: 'Server error loading pipeline board.' });
  }
});

// ── GET /api/pipeline/board/column — load more for a single column ──
router.get('/board/column', async (req, res) => {
  try {
    const { companyCode, stage } = req.query;
    if (!companyCode) return res.status(400).json({ success: false, message: 'companyCode is required.' });
    if (!stage || !VALID_PIPELINE_STAGES.includes(stage)) {
      return res.status(400).json({ success: false, message: 'Valid stage is required.' });
    }

    const page = parsePage(req.query.page);
    const pageSize = parsePageSize(req.query.pageSize);
    const skip = (page - 1) * pageSize;

    const filters = {
      owner: req.query.owner || '',
      connectionOutcome: req.query.connectionOutcome || '',
      qualificationOutcome: req.query.qualificationOutcome || '',
      search: req.query.search || '',
      stage,
    };

    const matchQuery = buildBoardMatchQuery(companyCode, filters);
    const LeadModel = req.models.Lead;

    const [total, leads] = await Promise.all([
      LeadModel.countDocuments(matchQuery),
      LeadModel.find(matchQuery)
        .sort({ stageChangedAt: -1, updatedAt: -1, _id: -1 })
        .skip(skip)
        .limit(pageSize)
        .lean(),
    ]);

    return res.status(200).json({
      success: true,
      stage,
      leads,
      total,
      page,
      pageSize,
      hasMore: skip + leads.length < total,
    });
  } catch (err) {
    console.error('[pipeline column load-more]', err);
    return res.status(500).json({ success: false, message: 'Server error loading pipeline column.' });
  }
});

// ── PATCH /api/pipeline/leads/:id/stage ────────────────────────
// Move a lead to a new pipeline stage with full validation
router.patch('/leads/:id/stage', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      companyCode,
      targetStage,
      qualificationOutcome,
      qualificationReason,
      lostReason,
      connectionOutcome,
    } = req.body;

    // 1. Basic required fields
    if (!companyCode) {
      return res.status(400).json({ success: false, message: 'companyCode is required.' });
    }
    if (!targetStage || !VALID_PIPELINE_STAGES.includes(targetStage)) {
      return res.status(400).json({ success: false, message: `Invalid targetStage. Must be one of: ${VALID_PIPELINE_STAGES.join(', ')}` });
    }

    // 2. Load lead and verify tenant ownership
    const LeadModel = req.models.Lead;
    const lead = await LeadModel.findById(id).lean();
    if (!lead) {
      return res.status(404).json({ success: false, message: 'Lead not found.' });
    }
    if (lead.companyCode !== companyCode) {
      return res.status(403).json({ success: false, message: 'Access denied. Lead does not belong to this company.' });
    }

    const previousStage = lead.pipelineStage;
    const newStatus = pipelineToStatus(targetStage);
    const update = {
      pipelineStage: targetStage,
      stageChangedAt: new Date(),
    };
    if (newStatus) {
      update.status = newStatus;
    }

    // 3. CLOSED_LOST requires a valid lostReason
    if (targetStage === 'CLOSED_LOST') {
      if (!lostReason || !VALID_LOST_REASONS.includes(lostReason)) {
        return res.status(400).json({
          success: false,
          message: `lostReason is required when moving to Closed Lost. Must be one of: ${VALID_LOST_REASONS.join(', ')}`,
        });
      }
      update.lostReason = lostReason;
    }

    // 4. NEEDS_ANALYSIS requires qualificationOutcome = QUALIFIED (already set on lead OR in this request)
    if (targetStage === 'NEEDS_ANALYSIS') {
      const effectiveQualification = qualificationOutcome || lead.qualificationOutcome;
      if (effectiveQualification !== 'QUALIFIED') {
        return res.status(422).json({
          success: false,
          message: 'Cannot move to Needs Analysis: lead must be Qualified first. Set qualificationOutcome to QUALIFIED at the Qualification stage.',
        });
      }
    }

    // 5. If qualificationOutcome is being set, validate it
    if (qualificationOutcome) {
      if (!VALID_QUALIFICATION_OUTCOMES.includes(qualificationOutcome)) {
        return res.status(400).json({ success: false, message: `Invalid qualificationOutcome. Must be one of: ${VALID_QUALIFICATION_OUTCOMES.join(', ')}` });
      }
      update.qualificationOutcome = qualificationOutcome;

      // NOT_QUALIFIED requires a reason
      if (qualificationOutcome === 'NOT_QUALIFIED') {
        if (!qualificationReason || !VALID_QUALIFICATION_REASONS.includes(qualificationReason)) {
          return res.status(400).json({
            success: false,
            message: `qualificationReason is required when qualificationOutcome is NOT_QUALIFIED. Must be one of: ${VALID_QUALIFICATION_REASONS.join(', ')}`,
          });
        }
        update.qualificationReason = qualificationReason;
      }
    }

    // 6. If connectionOutcome is being set, validate it
    if (connectionOutcome) {
      if (!VALID_CONNECTION_OUTCOMES.includes(connectionOutcome)) {
        return res.status(400).json({ success: false, message: `Invalid connectionOutcome. Must be one of: ${VALID_CONNECTION_OUTCOMES.join(', ')}` });
      }
      update.connectionOutcome = connectionOutcome;
    }

    // 7. Persist the update
    const updatedLead = await LeadModel.findByIdAndUpdate(
      id,
      { $set: update },
      { new: true },
    ).lean();

    if (!updatedLead) {
      return res.status(404).json({ success: false, message: 'Lead not found after update.' });
    }

    // 8. Log to history
    const historyDetails = [];
    if (qualificationOutcome) historyDetails.push(`qualificationOutcome: ${qualificationOutcome}`);
    if (qualificationReason) historyDetails.push(`qualificationReason: ${qualificationReason}`);
    if (lostReason) historyDetails.push(`lostReason: ${lostReason}`);
    if (connectionOutcome) historyDetails.push(`connectionOutcome: ${connectionOutcome}`);

    await logChange({
      HistoryModel: History,
      companyCode: updatedLead.companyCode,
      contactNumber: updatedLead.contactNumber,
      contactName: updatedLead.contactName,
      companyName: updatedLead.leadCompanyName,
      action: 'Pipeline Stage Changed',
      oldValue: previousStage,
      newValue: targetStage,
      details: historyDetails.length ? historyDetails.join('; ') : undefined,
      changedBy: updatedLead.assignedEmployeeId,
    });

    // 9. Invalidate caches
    await invalidateLeadCaches({ companyCode, employeeId: updatedLead.assignedEmployeeId });

    return res.status(200).json({ success: true, lead: updatedLead });
  } catch (err) {
    console.error('[pipeline stage move]', err);
    return res.status(500).json({ success: false, message: 'Server error updating pipeline stage.' });
  }
});

module.exports = router;
