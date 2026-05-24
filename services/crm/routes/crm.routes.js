const express = require('express');
const jwt = require('jsonwebtoken');
const { getConvertedClients } = require('../services/clientService');
const CrmContract = require('../models/CrmContract');
const Client = require('../models/Client');
const CrmDocumentTemplate = require('../models/CrmDocumentTemplate');
const CrmAmc = require('../models/CrmAmc');
const CrmPayment = require('../models/CrmPayment');
const CrmProject = require('../models/CrmProject');
const CrmTicket = require('../models/CrmTicket');
const User = require('../models/User');
const { NDA_PLACEHOLDERS, createDefaultNdaTemplate, normalizeTemplate } = require('../utilities/ndaTemplate');
const { generateDynamicNdaPDF } = require('../utilities/ndaPdfGenerator');
const { generateSlaPDF } = require('../utilities/slaPdfGenerator');
const { fetchHostingerDomains } = require('../services/hostingerService');
const {
  addYears,
  clientSuggestionsForDomain,
  lifecycleStatusFor,
  nextAnnualRenewalDate,
  normalizeDomainName,
  serializeAmcRecord,
} = require('../services/amcService');

const router = express.Router();

function requireCrmAdmin(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return res.status(401).json({ success: false, message: 'CRM auth token required.' });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.role !== 'crm_admin') {
      return res.status(403).json({ success: false, message: 'CRM admin role required.' });
    }
    req.crmUser = payload;
    return next();
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid or expired CRM auth token.' });
  }
}

function scopedCompany(req) {
  return String(req.query.companyCode || req.body?.companyCode || req.crmUser?.companyCode || '').trim();
}

function makeDocumentNumber(type) {
  const now = new Date();
  const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  return `${type}-${date}-${Math.floor(100000 + Math.random() * 900000)}`;
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function numberValue(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function stringValue(value) {
  return String(value || '').trim();
}

function addCalendarYears(date, amount) {
  const next = new Date(date);
  next.setFullYear(next.getFullYear() + amount);
  return next;
}

function contractResponse(contract) {
  const object = typeof contract.toObject === 'function' ? contract.toObject() : { ...contract };
  delete object.pdfBase64;
  delete object.templateSnapshot;
  if (object._id && object.pdfFileName) {
    object.downloadUrl = `/api/crm/contracts/${object._id}/pdf`;
  }
  return object;
}

function normalizeStoredNdaTemplate(template) {
  const defaultTemplate = createDefaultNdaTemplate();
  if (!template) return defaultTemplate;

  const normalized = normalizeTemplate(template);
  const defaultClauseCount = defaultTemplate.clauses.length;
  const savedClauseCount = Array.isArray(normalized.clauses) ? normalized.clauses.length : 0;

  return savedClauseCount < Math.floor(defaultClauseCount * 0.8) ? defaultTemplate : normalized;
}

async function loadNdaTemplate(companyCode) {
  const saved = await CrmDocumentTemplate.findOne({ companyCode, type: 'NDA' }).lean();
  return normalizeStoredNdaTemplate(saved?.template);
}

async function buildNdaDocData(req, clientCompanyName) {
  const companyCode = scopedCompany(req);
  const [company, project] = await Promise.all([
    companyCode ? User.findOne({ companyCode }).lean() : null,
    companyCode && clientCompanyName
      ? CrmProject.findOne({ companyCode, clientCompanyName }).sort({ updatedAt: -1 }).lean()
      : null,
  ]);

  const effectiveDate = parseDate(req.body.effectiveFrom || req.body.effectiveDate) || new Date();
  const expiryDate = parseDate(req.body.effectiveTo || req.body.expiryDate) || addCalendarYears(effectiveDate, 3);

  return {
    companyName: stringValue(req.body.companyName) || company?.companyName || 'Softrate Technologies Private Limited',
    companyAddress: stringValue(req.body.companyAddress)
      || company?.invoiceRegisteredAddress
      || company?.companyAddress
      || '60A, Velleeswaran Street, Mangadu, Chennai, Tamil Nadu, 600122, India',
    companyEmail: stringValue(req.body.companyEmail)
      || company?.contactDetails?.email
      || company?.email
      || 'helpdesk@softrateglobal.com',
    companyPhone: stringValue(req.body.companyPhone)
      || company?.contactDetails?.phone
      || company?.mobile
      || '+91 8148633580',
    companyWebsite: stringValue(req.body.companyWebsite)
      || company?.contactDetails?.website
      || 'www.softrateglobal.com',
    companyLogo: company?.invoiceLogo || null,
    clientName: stringValue(req.body.contactName || req.body.clientName) || 'Client Representative',
    clientCompanyName,
    clientAddress: stringValue(req.body.clientAddress) || '#, Street Name, Area Name, City, State, 600001, India',
    clientEmail: stringValue(req.body.contactEmail || req.body.clientEmail),
    effectiveDate,
    expiryDate,
    projectName: stringValue(req.body.projectName) || project?.clientCompanyName || 'Project Name / Service Name',
    projectDescription: stringValue(req.body.projectDescription) || project?.notes || 'Service Description',
    jurisdiction: stringValue(req.body.jurisdiction) || 'India',
    solicitationPeriod: stringValue(req.body.solicitationPeriod) || 'one (1) year',
    validityPeriod: stringValue(req.body.validityPeriod) || 'three (3) years',
    terminationNoticeDays: stringValue(req.body.terminationNoticeDays) || '30',
    noticeReceiptDays: stringValue(req.body.noticeReceiptDays) || 'five (5)',
    signatoryName: stringValue(req.body.signatoryName) || company?.name || 'Authorized Signatory',
    signatoryTitle: stringValue(req.body.signatoryTitle) || 'Authorized Signatory',
    clientSignatoryTitle: stringValue(req.body.clientSignatoryTitle) || 'Authorized Signatory',
    companySignature: stringValue(req.body.companySignature),
    clientSignature: stringValue(req.body.clientSignature),
    todayDate: new Date(),
  };
}

function amcViewFilter(row, view) {
  const filter = String(view || 'all').toLowerCase();
  if (filter === 'paid') return row.status === 'Paid';
  if (filter === 'unpaid') return row.status === 'Unpaid';
  if (filter === 'upcoming') return row.status === 'Upcoming Renewals';
  if (filter === 'blocked') return row.status === 'Blocked';
  return true;
}

function amcAnalytics(rows) {
  return rows.reduce((summary, row) => {
    if (row.status === 'Paid') summary.paid += 1;
    if (row.status === 'Upcoming Renewals') summary.upcoming += 1;
    if (row.status === 'Unpaid') summary.unpaid += 1;
    if (row.status === 'Blocked') summary.blocked += 1;
    return summary;
  }, { paid: 0, unpaid: 0, upcoming: 0, blocked: 0 });
}

function projectPayload(body = {}, companyCode = '', crmUser = {}) {
  return {
    companyCode,
    clientId: stringValue(body.clientId),
    clientCompanyName: stringValue(body.clientCompanyName),
    clientStatus: stringValue(body.clientStatus) || 'Onboarded',
    projectManagerName: stringValue(body.projectManagerName),
    projectManagerPhone: stringValue(body.projectManagerPhone),
    projectManagerEmail: stringValue(body.projectManagerEmail),
    projectManagerRole: 'project_manager',
    status: stringValue(body.status) || 'Assigned',
    notes: stringValue(body.notes),
    mappedBy: crmUser.email || '',
  };
}

async function findAmcRecord({ id, companyCode, clientId, clientCompanyName, domainName }) {
  if (id) return CrmAmc.findById(id);
  if (clientId && domainName) return CrmAmc.findOne({ companyCode, clientId, domainName });
  if (domainName) return CrmAmc.findOne({ companyCode, domainName });
  if (clientId) return CrmAmc.findOne({ companyCode, clientId });
  if (clientCompanyName) return CrmAmc.findOne({ companyCode, clientCompanyName });
  return null;
}

async function saveAmcRecordFromPayload(payload, crmUser = {}) {
  const companyCode = String(payload.companyCode || crmUser.companyCode || '').trim();
  const clientId = String(payload.clientId || '').trim();
  const clientCompanyName = String(payload.clientCompanyName || '').trim();
  const domainName = normalizeDomainName(payload.domainName);
  if (!clientId && !(payload.id || payload._id)) {
    const error = new Error('Client ID is required for AMC mapping.');
    error.statusCode = 400;
    throw error;
  }
  if (!clientCompanyName) {
    const error = new Error('Client company is required.');
    error.statusCode = 400;
    throw error;
  }

  const domainPurchaseDate = parseDate(payload.domainPurchaseDate);
  const renewalDate = parseDate(payload.renewalDate) || nextAnnualRenewalDate(domainPurchaseDate);
  const record = await findAmcRecord({
    id: payload.id || payload._id,
    companyCode,
    clientId,
    clientCompanyName,
    domainName,
  }) || new CrmAmc({ companyCode, clientId, clientCompanyName });
  const previousPaymentStatus = record.paymentStatus;

  record.companyCode = companyCode;
  if (clientId) record.clientId = clientId;
  record.clientCompanyName = clientCompanyName;
  if (domainName) record.domainName = domainName;
  if (payload.hostingerDomainId !== undefined) record.hostingerDomainId = String(payload.hostingerDomainId || '').trim();
  if (payload.hostingerStatus !== undefined) record.hostingerStatus = String(payload.hostingerStatus || '').trim();
  if (payload.hostingerExpiresAt !== undefined) record.hostingerExpiresAt = parseDate(payload.hostingerExpiresAt);
  if (domainPurchaseDate) record.domainPurchaseDate = domainPurchaseDate;
  if (renewalDate) record.renewalDate = renewalDate;
  record.annualFee = numberValue(payload.annualFee, record.annualFee || 0);
  record.owner = String(payload.owner || record.owner || '').trim();
  record.notes = String(payload.notes || record.notes || '').trim();
  record.source = payload.source || record.source || 'manual';

  const requestedStatus = String(payload.paymentStatus || payload.status || '').trim();
  if (['Paid', 'Unpaid'].includes(requestedStatus)) {
    record.paymentStatus = requestedStatus;
    record.outstandingAmount = requestedStatus === 'Paid'
      ? 0
      : numberValue(payload.outstandingAmount, record.annualFee || record.outstandingAmount || 0);
    if (requestedStatus === 'Paid' && previousPaymentStatus !== 'Paid') {
      record.lastPaidAt = new Date();
      record.lastPaidRenewalDate = record.renewalDate || null;
      if (record.renewalDate) record.renewalDate = addYears(record.renewalDate, 1);
      record.blocked = false;
      record.blockedAt = undefined;
      record.blockedBy = '';
      record.blockReason = '';
    }
  } else {
    record.outstandingAmount = numberValue(payload.outstandingAmount, record.outstandingAmount || 0);
  }

  if (payload.blockClient || requestedStatus === 'Blocked') {
    record.blocked = true;
    record.blockedAt = new Date();
    record.blockedBy = crmUser.email || '';
    record.blockReason = String(payload.blockReason || 'Manual AMC block').trim();
    record.paymentStatus = 'Unpaid';
  }

  record.status = lifecycleStatusFor(record);
  await record.save();
  return record;
}

router.use(requireCrmAdmin);

router.get('/clients', async (req, res) => {
  try {
    const clients = await getConvertedClients({
      companyCode: scopedCompany(req),
      search: req.query.search,
    });
    return res.json({ success: true, clients, total: clients.length });
  } catch (err) {
    console.error('[crm clients]', err);
    return res.status(500).json({ success: false, message: 'Failed to load CRM clients.' });
  }
});

router.put('/clients/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const companyCode = scopedCompany(req);
    const client = await Client.findOne({ _id: id, companyCode });
    if (!client) {
      return res.status(404).json({ success: false, message: 'Client not found.' });
    }

    if (req.body.companyName !== undefined) client.companyName = String(req.body.companyName).trim();
    if (req.body.primaryContactName !== undefined) client.primaryContactName = String(req.body.primaryContactName).trim();
    if (req.body.primaryPhone !== undefined) client.primaryPhone = String(req.body.primaryPhone).trim();
    if (req.body.primaryEmail !== undefined) client.primaryEmail = String(req.body.primaryEmail).trim().toLowerCase();
    if (req.body.address !== undefined) client.address = String(req.body.address).trim();
    if (req.body.description !== undefined) client.description = String(req.body.description).trim();
    if (req.body.status !== undefined) client.status = String(req.body.status).trim();

    await client.save();
    return res.json({ success: true, client });
  } catch (err) {
    console.error('[crm client update]', err);
    return res.status(500).json({ success: false, message: 'Failed to update client.' });
  }
});

router.get('/nda-template', async (req, res) => {
  try {
    const companyCode = scopedCompany(req);
    const saved = await CrmDocumentTemplate.findOne({ companyCode, type: 'NDA' }).lean();
    return res.json({
      success: true,
      ndaTemplate: normalizeStoredNdaTemplate(saved?.template),
      placeholders: NDA_PLACEHOLDERS,
      updatedAt: saved?.updatedAt || null,
    });
  } catch (err) {
    console.error('[crm nda template]', err);
    return res.status(500).json({ success: false, message: 'Failed to load NDA template.' });
  }
});

router.put('/nda-template', async (req, res) => {
  try {
    const companyCode = scopedCompany(req);
    const ndaTemplate = normalizeTemplate(req.body?.ndaTemplate || req.body?.template || {});
    const saved = await CrmDocumentTemplate.findOneAndUpdate(
      { companyCode, type: 'NDA' },
      {
        $set: {
          companyCode,
          type: 'NDA',
          name: ndaTemplate.name || 'NDA Format Sample',
          template: ndaTemplate,
          updatedBy: req.crmUser?.email || '',
        },
      },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    ).lean();
    return res.json({
      success: true,
      message: 'NDA template saved successfully.',
      ndaTemplate: normalizeTemplate(saved.template),
    });
  } catch (err) {
    console.error('[crm nda template save]', err);
    return res.status(500).json({ success: false, message: 'Failed to save NDA template.' });
  }
});

router.post('/nda/preview', async (req, res) => {
  try {
    const clientCompanyName = stringValue(req.body.clientCompanyName) || 'Client Company Name';
    const template = normalizeTemplate(req.body?.ndaTemplate || await loadNdaTemplate(scopedCompany(req)));
    const data = await buildNdaDocData(req, clientCompanyName);
    const buffer = await generateDynamicNdaPDF(data, template);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="NDA-Preview.pdf"');
    return res.send(buffer);
  } catch (err) {
    console.error('[crm nda preview]', err);
    return res.status(500).json({ success: false, message: 'Failed to preview NDA.' });
  }
});

router.get('/contracts', async (req, res) => {
  try {
    const companyCode = scopedCompany(req);
    const query = {};
    if (companyCode) query.companyCode = companyCode;
    if (req.query.type) query.type = String(req.query.type).toUpperCase();
    if (req.query.clientCompanyName) query.clientCompanyName = req.query.clientCompanyName;

    const contracts = await CrmContract.find(query).select('-pdfBase64 -templateSnapshot').sort({ createdAt: -1 }).lean();
    return res.json({ success: true, contracts: contracts.map(contractResponse) });
  } catch (err) {
    console.error('[crm contracts]', err);
    return res.status(500).json({ success: false, message: 'Failed to load contract history.' });
  }
});

router.get('/contracts/:id/pdf', async (req, res) => {
  try {
    const companyCode = scopedCompany(req);
    const query = { _id: req.params.id };
    if (companyCode) query.companyCode = companyCode;
    const contract = await CrmContract.findOne(query).select('+pdfBase64').lean();
    if (!contract || !contract.pdfBase64) {
      return res.status(404).json({ success: false, message: 'PDF not found for this contract.' });
    }
    const buffer = Buffer.from(contract.pdfBase64, 'base64');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${contract.pdfFileName || `${contract.documentNumber}.pdf`}"`);
    return res.send(buffer);
  } catch (err) {
    console.error('[crm contract pdf]', err);
    return res.status(500).json({ success: false, message: 'Failed to load contract PDF.' });
  }
});

router.post('/contracts/generate', async (req, res) => {
  try {
    const type = String(req.body?.type || '').toUpperCase();
    if (!['SLA', 'NDA'].includes(type)) {
      return res.status(400).json({ success: false, message: 'Contract type must be SLA or NDA.' });
    }
    if (!req.body?.clientCompanyName) {
      return res.status(400).json({ success: false, message: 'Client company is required.' });
    }

    const clientCompanyName = String(req.body.clientCompanyName).trim();
    const documentNumber = makeDocumentNumber(type);
    let pdfBuffer = null;
    let pdfFileName = '';
    let templateSnapshot;
    let content = req.body.content || `${type} generated for ${clientCompanyName}.`;

    if (type === 'NDA') {
      templateSnapshot = req.body?.ndaTemplate
        ? normalizeTemplate(req.body.ndaTemplate)
        : await loadNdaTemplate(scopedCompany(req));
      const docData = await buildNdaDocData(req, clientCompanyName);
      pdfBuffer = await generateDynamicNdaPDF(docData, templateSnapshot);
      pdfFileName = `${documentNumber}-${clientCompanyName.replace(/[^a-z0-9]+/gi, '-')}.pdf`;
      content = `NDA generated for ${clientCompanyName} using ${templateSnapshot.name || 'NDA Format Sample'}.`;
    } else if (type === 'SLA') {
      const companyCode = scopedCompany(req);
      const [company, client] = await Promise.all([
        companyCode ? User.findOne({ companyCode }).lean() : null,
        companyCode && clientCompanyName
          ? Client.findOne({ companyCode, companyName: clientCompanyName }).lean()
          : null,
      ]);

      const docData = {
        companyName: company?.companyName || 'Softrate Technologies Private Limited',
        companyAddress: company?.invoiceRegisteredAddress || '60A, Velleeswaran Street, Mangadu, Chennai, Tamil Nadu, 600122, India',
        companyPhone: company?.contactDetails?.phone || '+91 8148633580',
        companyEmail: company?.contactDetails?.email || 'helpdesk@softrateglobal.com',
        companyWebsite: company?.contactDetails?.website || 'www.softrateglobal.com',
        companyLogo: company?.invoiceLogo || null,

        clientCompanyName,
        clientName: client?.primaryContactName || req.body.contactName || 'Client Representative',
        clientAddress: client?.address || req.body.clientAddress || '#, Street Name, Area Name, City, State, India',
        clientEmail: client?.primaryEmail || req.body.contactEmail || '',

        effectiveDate: parseDate(req.body.effectiveFrom) || new Date(),
        signatoryName: company?.name || 'Authorized Signatory',
        signatoryTitle: 'Authorized Signatory',
        clientSignatoryTitle: 'Authorized Signatory',
      };

      pdfBuffer = await generateSlaPDF(docData);
      pdfFileName = `${documentNumber}-${clientCompanyName.replace(/[^a-z0-9]+/gi, '-')}.pdf`;
      content = `SLA generated for ${clientCompanyName}.`;
    }

    const contract = await CrmContract.create({
      companyCode: scopedCompany(req),
      clientCompanyName,
      contactName: req.body.contactName || '',
      contactEmail: req.body.contactEmail || '',
      type,
      documentNumber,
      title: `${type} - ${clientCompanyName}`,
      status: 'Generated',
      effectiveFrom: req.body.effectiveFrom || new Date(),
      effectiveTo: req.body.effectiveTo || null,
      generatedBy: req.crmUser?.email || 'CRM Admin',
      content,
      pdfFileName,
      pdfBase64: pdfBuffer ? pdfBuffer.toString('base64') : '',
      templateSnapshot,
    });

    return res.status(201).json({ success: true, contract: contractResponse(contract) });
  } catch (err) {
    console.error('[crm contract generate]', err);
    return res.status(500).json({ success: false, message: 'Failed to generate contract.' });
  }
});

router.get('/amc/hostinger/domains', async (req, res) => {
  try {
    const companyCode = scopedCompany(req);
    const [clients, records] = await Promise.all([
      getConvertedClients({ companyCode, search: req.query.search }),
      CrmAmc.find(companyCode ? { companyCode } : {}).lean(),
    ]);
    const domains = await fetchHostingerDomains({ includeDetails: true });
    const recordsByDomain = new Map(records.map((record) => [normalizeDomainName(record.domainName), record]));

    return res.json({
      success: true,
      domains: domains.map((domain) => {
        const existing = recordsByDomain.get(domain.domainName);
        const suggestions = clientSuggestionsForDomain(domain.domainName, clients);
        return {
          ...domain,
          existingMapping: existing ? serializeAmcRecord(existing) : null,
          suggestions,
        };
      }),
    });
  } catch (err) {
    console.error('[crm amc hostinger domains]', err);
    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.statusCode === 503 ? err.message : 'Failed to fetch Hostinger domains.',
    });
  }
});

router.post('/amc/hostinger/import', async (req, res) => {
  try {
    const companyCode = scopedCompany(req);
    const mappings = Array.isArray(req.body?.mappings) ? req.body.mappings : [];
    const mappingByDomain = new Map(mappings.map((item) => [normalizeDomainName(item.domainName), item]));
    const autoMap = req.body?.autoMap !== false;
    const [clients, domains] = await Promise.all([
      getConvertedClients({ companyCode }),
      fetchHostingerDomains({ includeDetails: true }),
    ]);

    const imported = [];
    const unmapped = [];

    for (const domain of domains) {
      const explicitMapping = mappingByDomain.get(domain.domainName);
      const suggestions = clientSuggestionsForDomain(domain.domainName, clients);
      const suggestedClient = suggestions[0]?.score >= 85 ? suggestions[0] : null;
      const mappedClientId = String(explicitMapping?.clientId || (autoMap ? suggestedClient?.clientId : '') || '').trim();
      const fallbackCompanyName = String(explicitMapping?.clientCompanyName || (autoMap ? suggestedClient?.clientCompanyName : '') || '').trim();

      if (!mappedClientId && !fallbackCompanyName) {
        unmapped.push({ ...domain, suggestions });
        continue;
      }

      const mappedClient = clients.find((client) => (
        (mappedClientId && client.clientId === mappedClientId) ||
        (!mappedClientId && client.companyName === fallbackCompanyName)
      ));
      if (!mappedClient?.clientId) {
        unmapped.push({ ...domain, suggestions });
        continue;
      }
      const record = await saveAmcRecordFromPayload({
        companyCode: mappedClient?.companyCode || companyCode,
        clientId: mappedClient.clientId,
        clientCompanyName: mappedClient.companyName,
        domainName: domain.domainName,
        hostingerDomainId: domain.hostingerDomainId,
        hostingerStatus: domain.hostingerStatus,
        hostingerExpiresAt: domain.hostingerExpiresAt,
        domainPurchaseDate: domain.domainPurchaseDate,
        annualFee: explicitMapping?.annualFee,
        owner: explicitMapping?.owner || mappedClient?.managers?.[0] || '',
        source: 'hostinger',
      }, req.crmUser);

      record.lastImportedAt = new Date();
      record.mappedAt = record.mappedAt || new Date();
      record.mappedBy = record.mappedBy || req.crmUser?.email || '';
      record.status = lifecycleStatusFor(record);
      await record.save();
      imported.push(serializeAmcRecord(record));
    }

    return res.json({
      success: true,
      imported,
      unmapped,
      message: `${imported.length} Hostinger domain${imported.length === 1 ? '' : 's'} imported. ${unmapped.length} left unmapped.`,
    });
  } catch (err) {
    console.error('[crm amc hostinger import]', err);
    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.statusCode === 503 ? err.message : 'Failed to import Hostinger domains.',
    });
  }
});

router.get('/amc', async (req, res) => {
  try {
    const companyCode = scopedCompany(req);
    const query = { domainName: { $exists: true, $nin: ['', null] } };
    if (companyCode) query.companyCode = companyCode;
    const searchValue = String(req.query.search || '').trim().toLowerCase();
    const [clients, records] = await Promise.all([
      getConvertedClients({ companyCode }),
      CrmAmc.find(query).sort({ renewalDate: 1, updatedAt: -1 }).lean(),
    ]);

    const clientsById = new Map(clients.map((client) => [String(client.clientId || '').trim(), client]).filter(([clientId]) => !!clientId));
    const clientsByName = new Map(clients.map((client) => [String(client.companyName || '').toLowerCase(), client]));
    const allRows = records
      .filter((record) => (
        (record.clientId && clientsById.has(String(record.clientId || '').trim())) ||
        clientsByName.has(String(record.clientCompanyName || '').toLowerCase())
      ))
      .map((record) => {
        const client = clientsById.get(String(record.clientId || '').trim()) ||
          clientsByName.get(String(record.clientCompanyName || '').toLowerCase());
        return serializeAmcRecord({
          ...record,
          clientId: client?.clientId || record.clientId,
          clientCompanyName: client?.companyName || record.clientCompanyName,
          companyCode: client?.companyCode || record.companyCode,
          owner: record.owner || client?.managers?.[0] || '',
        });
      })
      .filter((row) => !searchValue
        || String(row.clientCompanyName || '').toLowerCase().includes(searchValue)
        || String(row.clientId || '').toLowerCase().includes(searchValue)
        || String(row.domainName || '').toLowerCase().includes(searchValue)
        || String(row.owner || '').toLowerCase().includes(searchValue));
    const amc = allRows.filter((row) => amcViewFilter(row, req.query.view));

    return res.json({ success: true, amc, analytics: amcAnalytics(allRows) });
  } catch (err) {
    console.error('[crm amc]', err);
    return res.status(500).json({ success: false, message: 'Failed to load AMC tracking.' });
  }
});

router.patch('/amc', async (req, res) => {
  try {
    const record = await saveAmcRecordFromPayload({
      ...req.body,
      companyCode: scopedCompany(req),
    }, req.crmUser);
    return res.json({ success: true, amc: serializeAmcRecord(record) });
  } catch (err) {
    console.error('[crm amc update]', err);
    return res.status(err.statusCode || 500).json({ success: false, message: err.message || 'Failed to update AMC tracking.' });
  }
});

router.patch('/amc/:id/status', async (req, res) => {
  try {
    const record = await CrmAmc.findById(req.params.id);
    if (!record) return res.status(404).json({ success: false, message: 'AMC record not found.' });
    const paymentStatus = String(req.body?.paymentStatus || '').trim();
    if (!['Paid', 'Unpaid'].includes(paymentStatus)) {
      return res.status(400).json({ success: false, message: 'paymentStatus must be Paid or Unpaid.' });
    }

    record.paymentStatus = paymentStatus;
    if (paymentStatus === 'Paid') {
      record.outstandingAmount = 0;
      record.lastPaidAt = new Date();
      record.lastPaidRenewalDate = record.renewalDate || null;
      if (record.renewalDate) record.renewalDate = addYears(record.renewalDate, 1);
      record.blocked = false;
      record.blockedAt = undefined;
      record.blockedBy = '';
      record.blockReason = '';
    } else {
      record.outstandingAmount = numberValue(req.body?.outstandingAmount, record.annualFee || record.outstandingAmount || 0);
    }
    record.status = lifecycleStatusFor(record);
    await record.save();
    return res.json({ success: true, amc: serializeAmcRecord(record) });
  } catch (err) {
    console.error('[crm amc status]', err);
    return res.status(500).json({ success: false, message: 'Failed to update AMC payment status.' });
  }
});

router.patch('/amc/:id/block', async (req, res) => {
  try {
    const record = await CrmAmc.findById(req.params.id);
    if (!record) return res.status(404).json({ success: false, message: 'AMC record not found.' });
    if (!serializeAmcRecord(record).canManualBlock) {
      return res.status(400).json({ success: false, message: 'Manual block is available only for unpaid AMC records in the last 3 days before renewal or overdue.' });
    }

    record.blocked = true;
    record.blockedAt = new Date();
    record.blockedBy = req.crmUser?.email || '';
    record.blockReason = String(req.body?.reason || 'Manual AMC block').trim();
    record.paymentStatus = 'Unpaid';
    record.status = 'Blocked';
    await record.save();

    return res.json({ success: true, amc: serializeAmcRecord(record) });
  } catch (err) {
    console.error('[crm amc block]', err);
    return res.status(500).json({ success: false, message: 'Failed to block AMC domain.' });
  }
});

router.delete('/amc/:id', async (req, res) => {
  try {
    const companyCode = scopedCompany(req);
    const query = { _id: req.params.id };
    if (companyCode) query.companyCode = companyCode;
    const record = await CrmAmc.findOneAndDelete(query).lean();
    if (!record) return res.status(404).json({ success: false, message: 'AMC mapping not found.' });
    return res.json({ success: true, message: 'AMC mapping removed.' });
  } catch (err) {
    console.error('[crm amc delete]', err);
    return res.status(500).json({ success: false, message: 'Failed to remove AMC mapping.' });
  }
});

router.get('/payments', async (req, res) => {
  try {
    const companyCode = scopedCompany(req);
    const query = companyCode ? { companyCode } : {};
    if (req.query.clientCompanyName) query.clientCompanyName = req.query.clientCompanyName;
    const payments = await CrmPayment.find(query).sort({ createdAt: -1 }).lean();
    const totalInvoiceAmount = payments.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const paidAmount = payments.reduce((sum, item) => sum + Number(item.paidAmount || 0), 0);
    return res.json({
      success: true,
      payments,
      analytics: {
        totalInvoiceAmount,
        paidAmount,
        outstandingAmount: Math.max(totalInvoiceAmount - paidAmount, 0),
        paidInvoiceCount: payments.filter((item) => item.status === 'Paid').length,
      },
    });
  } catch (err) {
    console.error('[crm payments]', err);
    return res.status(500).json({ success: false, message: 'Failed to load payments.' });
  }
});

router.post('/payments/paid-invoice', async (req, res) => {
  try {
    if (!req.body?.clientCompanyName) {
      return res.status(400).json({ success: false, message: 'Client company is required.' });
    }
    const amount = Number(req.body.amount || req.body.paidAmount || 0);
    const payment = await CrmPayment.create({
      companyCode: scopedCompany(req),
      clientCompanyName: req.body.clientCompanyName,
      invoiceNumber: req.body.invoiceNumber || makeDocumentNumber('PAID-INV'),
      amount,
      paidAmount: Number(req.body.paidAmount || amount),
      status: 'Paid',
      paidAt: req.body.paidAt || new Date(),
      paymentMode: req.body.paymentMode || 'Manual',
      notes: req.body.notes || 'Paid invoice generated from CRM payments.',
    });
    return res.status(201).json({ success: true, payment });
  } catch (err) {
    console.error('[crm paid invoice]', err);
    return res.status(500).json({ success: false, message: 'Failed to generate paid invoice.' });
  }
});

router.get('/tickets', async (req, res) => {
  try {
    const companyCode = scopedCompany(req);
    const query = companyCode ? { companyCode } : {};
    if (req.query.clientCompanyName) query.clientCompanyName = req.query.clientCompanyName;
    const tickets = await CrmTicket.find(query).sort({ updatedAt: -1 }).lean();
    return res.json({ success: true, tickets });
  } catch (err) {
    console.error('[crm tickets]', err);
    return res.status(500).json({ success: false, message: 'Failed to load tickets.' });
  }
});

router.post('/tickets', async (req, res) => {
  try {
    if (!req.body?.clientCompanyName || !req.body?.subject) {
      return res.status(400).json({ success: false, message: 'Client company and subject are required.' });
    }
    const ticket = await CrmTicket.create({
      companyCode: scopedCompany(req),
      clientCompanyName: req.body.clientCompanyName,
      subject: req.body.subject,
      query: req.body.query || '',
      priority: req.body.priority || 'Medium',
      status: req.body.status || 'Open',
      raisedBy: req.body.raisedBy || req.crmUser?.email || '',
    });
    return res.status(201).json({ success: true, ticket });
  } catch (err) {
    console.error('[crm ticket create]', err);
    return res.status(500).json({ success: false, message: 'Failed to create ticket.' });
  }
});

router.get('/projects', async (req, res) => {
  try {
    const companyCode = scopedCompany(req);
    const query = companyCode ? { companyCode } : {};
    if (req.query.status && req.query.status !== 'all') query.status = req.query.status;
    const projects = await CrmProject.find(query).sort({ updatedAt: -1 }).lean();
    return res.json({ success: true, projects });
  } catch (err) {
    console.error('[crm projects]', err);
    return res.status(500).json({ success: false, message: 'Failed to load project mappings.' });
  }
});

router.post('/projects/map', async (req, res) => {
  try {
    const companyCode = scopedCompany(req);
    const payload = projectPayload(req.body, companyCode, req.crmUser);
    if (!payload.clientId || !payload.projectManagerName) {
      return res.status(400).json({ success: false, message: 'Onboarded client and project manager are required.' });
    }

    const clients = await getConvertedClients({ companyCode });
    const client = clients.find((item) => item.clientId === payload.clientId);
    if (!client) {
      return res.status(400).json({ success: false, message: 'Only onboarded clients can be mapped to a project manager.' });
    }

    payload.clientId = client.clientId;
    payload.clientCompanyName = client.companyName;
    payload.clientStatus = client.status || payload.clientStatus;

    const project = await CrmProject.findOneAndUpdate(
      { companyCode, clientId: payload.clientId },
      { $set: payload },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).lean();

    return res.status(200).json({ success: true, project });
  } catch (err) {
    console.error('[crm project map]', err);
    return res.status(500).json({ success: false, message: 'Failed to save project manager mapping.' });
  }
});

router.patch('/projects/:id/status', async (req, res) => {
  try {
    const status = stringValue(req.body?.status);
    if (!status) return res.status(400).json({ success: false, message: 'Project status is required.' });

    const project = await CrmProject.findByIdAndUpdate(
      req.params.id,
      { $set: { status, notes: stringValue(req.body?.notes) } },
      { new: true, runValidators: true }
    ).lean();

    if (!project) return res.status(404).json({ success: false, message: 'Project mapping not found.' });
    return res.json({ success: true, project });
  } catch (err) {
    console.error('[crm project status]', err);
    return res.status(500).json({ success: false, message: 'Failed to update project status.' });
  }
});

router.delete('/projects/:id', async (req, res) => {
  try {
    const companyCode = scopedCompany(req);
    const query = { _id: req.params.id };
    if (companyCode) query.companyCode = companyCode;
    const project = await CrmProject.findOneAndDelete(query).lean();
    if (!project) return res.status(404).json({ success: false, message: 'Project mapping not found.' });
    return res.json({ success: true, message: 'Project mapping removed.' });
  } catch (err) {
    console.error('[crm project delete]', err);
    return res.status(500).json({ success: false, message: 'Failed to remove project mapping.' });
  }
});

module.exports = router;
