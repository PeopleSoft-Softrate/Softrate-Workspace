const express = require('express');
const mongoose = require('mongoose');
const Proposal = require('../../../models/Proposal');
const Lead = require('../../../models/Lead');
const User = require('../../../models/User');
const Employee = require('../../../models/Employee');
const eventBus = require('../../../services/eventBus');
const { parsePageQuery, buildPageResponse } = require('../../common/pagination/pagination');
const { normalizeText } = require('../../../services/leadNormalization');
const { companyMiddleware } = require('../../common/tenantMiddleware');

const router = express.Router();
router.use(companyMiddleware);

function normalize(value) {
  return String(value || '').trim();
}

function sanitizePagesSnapshot(pages) {
  if (!Array.isArray(pages)) return [];
  return pages.map(page => {
    if (!page || typeof page !== 'object') return page;
    const sanitized = { ...page };
    if (typeof sanitized.backgroundImage === 'string' && sanitized.backgroundImage.startsWith('data:')) {
      sanitized.backgroundImage = '';
    }
    if (Array.isArray(sanitized.layers)) {
      sanitized.layers = sanitized.layers.map(layer => {
        if (!layer || typeof layer !== 'object') return layer;
        const l = { ...layer };
        if (typeof l.imageSrc === 'string' && l.imageSrc.startsWith('data:')) {
          l.imageSrc = '';
        }
        return l;
      });
    }
    return sanitized;
  });
}

function getProposalModel(req) {
  return req.models?.Proposal || req.db?.model('Proposal') || mongoose.model('Proposal');
}

function getLeadModel(req) {
  return req.models?.Lead || req.db?.model('Lead') || mongoose.model('Lead');
}

function getClientModel(req) {
  return req.models?.Client || req.db?.model('Client') || mongoose.model('Client');
}

function getEmployeeModel(req) {
  return req.models?.Employee || req.db?.model('Employee') || mongoose.model('Employee');
}

function getBookmarkModel(req) {
  return req.models?.Bookmark || req.db?.model('Bookmark') || mongoose.model('Bookmark');
}

async function findLead(req, body) {
  const companyCode = normalize(body.companyCode);
  const leadId = normalize(body.leadId);
  const LeadModel = getLeadModel(req);
  if (leadId && mongoose.Types.ObjectId.isValid(leadId)) {
    const lead = await LeadModel.findOne({ _id: leadId, companyCode, isArchived: { $ne: true } });
    if (lead) return lead;
  }
  const contactNumber = normalize(body.contactNumber);
  if (contactNumber) return LeadModel.findOne({ companyCode, contactNumber, isArchived: { $ne: true } });
  return null;
}

async function generateProposalNumberAndVersion(req, companyCode, leadId) {
  const date = new Date();
  const yy = String(date.getFullYear()).slice(-2);
  const ProposalModel = getProposalModel(req);

  // Total proposals count for sequence
  const count = await ProposalModel.countDocuments({
    companyCode,
    proposalNumber: new RegExp(`^PR-?${yy}\\d{3,}$`, 'i'),
  });

  const nextSeq = String(count + 1).padStart(3, '0');
  const proposalNumber = `PR${yy}${nextSeq}`;

  // Version count for this specific lead/client
  let versionNo = 1;
  if (leadId && mongoose.Types.ObjectId.isValid(leadId)) {
    const existingCount = await ProposalModel.countDocuments({
      companyCode,
      leadId: new mongoose.Types.ObjectId(leadId),
    });
    versionNo = existingCount + 1;
  }

  return { proposalNumber, versionNo };
}

// ── CREATE / SAVE PROPOSAL ──────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const companyCode = normalize(req.body.companyCode);
    const brandingCompanyCode = normalize(req.body.brandingCompanyCode) || companyCode;
    if (!companyCode) return res.status(400).json({ success: false, message: 'companyCode is required.' });

    const user = await User.findOne({ companyCode: new RegExp(`^${brandingCompanyCode}$`, 'i') }).select('-proposalTemplates');

    const { getClientByClientId } = require('../../../services/clientService');
    const lead = await findLead(req, req.body);
    let client = null;
    if (!lead && req.body.clientId) {
      const ClientModel = getClientModel(req);
      client = await getClientByClientId({ ClientModel }, companyCode, req.body.clientId);
    }

    const { proposalNumber, versionNo } = await generateProposalNumberAndVersion(
      req,
      companyCode,
      lead?._id || null
    );

    const EmployeeModel = getEmployeeModel(req);
    const resolveEmployeeId = async (val) => {
      const v = normalize(val);
      if (!v) return null;
      if (mongoose.Types.ObjectId.isValid(v)) return new mongoose.Types.ObjectId(v);
      const found = await EmployeeModel.findOne({ companyCode, mobile: v });
      return found ? found._id : null;
    };

    const resolvedEmployeeId = await resolveEmployeeId(req.body.employeeId || req.body.createdById);
    const ProposalModel = getProposalModel(req);

    const fallbackCompanyName = req.body.valuesSnapshot?.client_company_name 
      || req.body.valuesSnapshot?.company_name 
      || req.body.valuesSnapshot?.clientName 
      || 'Client';

    const proposal = await ProposalModel.create({
      companyCode,
      employeeId: resolvedEmployeeId,
      employeeName: normalize(req.body.employeeName || req.body.createdByName),
      clientId: normalize(lead?.clientId || client?.clientId || req.body.clientId || ''),
      leadId: lead?._id || null,
      leadCode: normalize(lead?.leadId || client?.leadId || req.body.leadCode || ''),
      leadCompanyName: normalize(lead?.leadCompanyName || client?.clientCompanyName || req.body.leadCompanyName || fallbackCompanyName),
      contactName: normalize(lead?.contactName || client?.directorDetails?.directorName || req.body.contactName || req.body.valuesSnapshot?.contact_person || ''),
      contactNumber: normalize(lead?.contactNumber || client?.directorDetails?.contactNumber || req.body.contactNumber || req.body.valuesSnapshot?.contact_number || ''),
      directorEmailAddress: normalize(lead?.directorEmailAddress || client?.directorDetails?.directorEmail || req.body.directorEmailAddress || req.body.valuesSnapshot?.client_email || ''),
      proposalNumber,
      versionNo,
      templateId: normalize(req.body.templateId),
      templateName: normalize(req.body.templateName),
      valuesSnapshot: req.body.valuesSnapshot || {},
      pagesSnapshot: sanitizePagesSnapshot(req.body.pagesSnapshot),
      proposalDate: req.body.proposalDate ? new Date(req.body.proposalDate) : new Date(),
      status: req.body.status || 'generated',
      createdByRole: req.body.createdByRole === 'admin' ? 'admin' : 'employee',
      createdByName: normalize(req.body.createdByName || req.body.employeeName),
      createdById: resolvedEmployeeId,
      companySnapshot: {
        name: user?.showCompanyNameOnInvoice === false ? '' : (user?.companyName || companyCode),
        logo: user?.invoiceLogo || '',
        registeredAddress: user?.invoiceRegisteredAddress || user?.companyAddress || '',
        phone: user?.contactDetails?.phone || '',
        email: user?.contactDetails?.email || '',
        website: user?.contactDetails?.website || '',
        gstNumber: user?.gstNumber || '',
        footer: user?.invoiceFooter || '',
      },
    });

    // If linked to lead, mark proposalSent on lead/bookmark
    if (lead) {
      try {
        const BookmarkModel = getBookmarkModel(req);
        await BookmarkModel.updateMany(
          { companyCode, leadId: lead._id },
          { $set: { proposalSent: true } }
        );
      } catch (bmErr) {
        console.error('[Proposal Record] Bookmark update error:', bmErr);
      }
    }

    eventBus.emitToCompany(companyCode, { type: 'PROPOSAL_CREATED', proposalId: proposal._id });

    return res.status(201).json({ success: true, proposal });
  } catch (err) {
    console.error('Create proposal error:', err);
    return res.status(500).json({ success: false, message: 'Failed to save proposal record.' });
  }
});

// ── GET / LIST PROPOSALS ────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const companyCode = normalize(req.query.companyCode);
    if (!companyCode) return res.status(400).json({ success: false, message: 'companyCode is required.' });

    const filter = { companyCode: new RegExp(`^${companyCode}$`, 'i') };
    const employeeId = normalize(req.query.employeeId);
    if (employeeId && mongoose.Types.ObjectId.isValid(employeeId)) {
      filter.employeeId = new mongoose.Types.ObjectId(employeeId);
    }
    const leadId = normalize(req.query.leadId);
    if (leadId && mongoose.Types.ObjectId.isValid(leadId)) {
      filter.leadId = new mongoose.Types.ObjectId(leadId);
    }

    const search = normalize(req.query.search);
    if (search) {
      filter.$or = [
        { proposalNumber: new RegExp(search, 'i') },
        { templateName: new RegExp(search, 'i') },
        { leadCompanyName: new RegExp(search, 'i') },
        { contactName: new RegExp(search, 'i') },
        { contactNumber: new RegExp(search, 'i') },
        { directorEmailAddress: new RegExp(search, 'i') },
      ];
    }

    const dateFrom = req.query.dateFrom ? new Date(req.query.dateFrom) : null;
    const dateTo = req.query.dateTo ? new Date(req.query.dateTo) : null;
    if (dateFrom || dateTo) {
      filter.proposalDate = {};
      if (dateFrom) filter.proposalDate.$gte = dateFrom;
      if (dateTo) {
        const endOfDay = new Date(dateTo);
        endOfDay.setHours(23, 59, 59, 999);
        filter.proposalDate.$lte = endOfDay;
      }
    }

    const pagination = parsePageQuery(req.query);
    const ProposalModel = getProposalModel(req);

    const [total, proposals] = await Promise.all([
      ProposalModel.countDocuments(filter),
      ProposalModel.find(filter)
        .sort({ proposalDate: -1, versionNo: -1, createdAt: -1 })
        .skip(pagination.isPaginated ? pagination.skip : 0)
        .limit(pagination.isPaginated ? pagination.pageSize : 300)
        .lean(),
    ]);

async function ensureLeadCodes(proposals, req) {
  const records = Array.isArray(proposals) ? proposals : [proposals];
  const missingRecords = records.filter((p) => p && !normalize(p.leadCode));
  if (!missingRecords.length) return;

  const leadIds = missingRecords.map((i) => i.leadId).filter((id) => mongoose.Types.ObjectId.isValid(id));
  const clientIds = missingRecords.map((i) => normalize(i.clientId)).filter(Boolean);
  const companyNames = missingRecords.map((i) => normalizeText(i.leadCompanyName)).filter(Boolean);
  const companyCode = req.companyCode || records[0]?.companyCode;

  const LeadModel = getLeadModel(req);
  const [leadsById, leadsByName, clientsById, clientsByName] = await Promise.all([
    leadIds.length && LeadModel ? LeadModel.find({ _id: { $in: leadIds } }, 'leadId leadCompanyName').lean() : [],
    companyNames.length && LeadModel ? LeadModel.find({ companyCode, leadCompanyNameLower: { $in: companyNames } }, 'leadId leadCompanyNameLower').lean() : [],
    clientIds.length && req.models?.Client ? req.models.Client.find({ clientId: { $in: clientIds } }, 'leadId clientId companyName').lean() : [],
    companyNames.length && req.models?.Client ? req.models.Client.find({ companyCode, normalizedCompanyName: { $in: companyNames } }, 'leadId companyName normalizedCompanyName').lean() : [],
  ]);

  const leadIdMap = new Map();
  leadsById.forEach((l) => { if (l.leadId) leadIdMap.set(String(l._id), l.leadId); });
  const leadNameMap = new Map();
  leadsByName.forEach((l) => { if (l.leadId) leadNameMap.set(normalizeText(l.leadCompanyNameLower), l.leadId); });
  const clientIdMap = new Map();
  clientsById.forEach((c) => { if (c.leadId) clientIdMap.set(c.clientId, c.leadId); });
  const clientNameMap = new Map();
  clientsByName.forEach((c) => { if (c.leadId) clientNameMap.set(normalizeText(c.companyName || c.normalizedCompanyName), c.leadId); });

  for (const p of missingRecords) {
    const code = (p.leadId && leadIdMap.get(String(p.leadId)))
      || (p.clientId && clientIdMap.get(p.clientId))
      || leadNameMap.get(normalizeText(p.leadCompanyName))
      || clientNameMap.get(normalizeText(p.leadCompanyName))
      || '';
    if (code) {
      p.leadCode = code;
    }
  }
}

    await ensureLeadCodes(proposals, req);

    const page = buildPageResponse({
      items: proposals,
      total,
      page: pagination.page,
      pageSize: pagination.isPaginated ? pagination.pageSize : proposals.length,
    });

    return res.json({
      success: true,
      proposals: page.items,
      items: page.items,
      page: page.page,
      pageSize: page.pageSize,
      total: page.total,
      hasMore: page.hasMore,
    });
  } catch (err) {
    console.error('Fetch proposals error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch proposal history.' });
  }
});

// ── GET SINGLE PROPOSAL ─────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const companyCode = normalize(req.query.companyCode);
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid proposal ID.' });
    }

    const ProposalModel = getProposalModel(req);
    const proposal = await ProposalModel.findOne({ _id: id, companyCode }).lean();
    if (!proposal) {
      return res.status(404).json({ success: false, message: 'Proposal not found.' });
    }

    return res.json({ success: true, proposal });
  } catch (err) {
    console.error('Fetch proposal error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch proposal.' });
  }
});

// ── DELETE PROPOSAL ─────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const companyCode = normalize(req.query.companyCode);
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid proposal ID.' });
    }

    const ProposalModel = getProposalModel(req);
    const deleted = await ProposalModel.findOneAndDelete({ _id: id, companyCode });
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Proposal not found.' });
    }

    return res.json({ success: true, message: 'Proposal deleted successfully.' });
  } catch (err) {
    console.error('Delete proposal error:', err);
    return res.status(500).json({ success: false, message: 'Failed to delete proposal.' });
  }
});

module.exports = router;
