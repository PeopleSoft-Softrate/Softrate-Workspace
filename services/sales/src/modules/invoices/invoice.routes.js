const express = require('express');
const mongoose = require('mongoose');
const crypto = require('crypto');
const Invoice = require('../../../models/Invoice');
const Lead = require('../../../models/Lead');
const User = require('../../../models/User');
const { getClientByClientId, ensureClientForLead, mapClient } = require('../../../services/clientService');
const { normalizeText } = require('../../../services/leadNormalization');
const { parsePageQuery, buildPageResponse } = require('../../common/pagination/pagination');

const router = express.Router();

function normalize(value) {
  return String(value || '').trim();
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizePaymentStatus(value) {
  return normalize(value).toLowerCase() === 'paid' ? 'paid' : 'unpaid';
}

function generatePublicToken() {
  return crypto.randomBytes(24).toString('base64url');
}

function frontendBaseUrl(req) {
  const configuredUrl = normalize(process.env.FRONTEND_URL);
  if (configuredUrl) return configuredUrl.replace(/\/+$/, '');
  const requestOrigin = normalize(req.get('origin'));
  if (requestOrigin) return requestOrigin.replace(/\/+$/, '');
  return `${req.protocol}://${req.get('host')}`;
}

function publicInvoiceUrl(req, publicToken) {
  return `${frontendBaseUrl(req)}/invoice/${encodeURIComponent(publicToken || '')}`;
}

function serializeInvoice(invoice, req, publicOnly = false) {
  const source = typeof invoice?.toObject === 'function' ? invoice.toObject() : invoice;
  if (!source) return source;
  const publicToken = normalize(source.publicToken);
  const serialized = {
    ...source,
    publicToken,
    publicUrl: publicToken ? publicInvoiceUrl(req, publicToken) : '',
  };
  if (!publicOnly) return serialized;
  return {
    invoiceNumber: serialized.invoiceNumber || '',
    publicToken: serialized.publicToken,
    publicUrl: serialized.publicUrl,
    leadCompanyName: serialized.leadCompanyName || '',
    contactName: serialized.contactName || '',
    contactNumber: serialized.contactNumber || '',
    directorEmailAddress: serialized.directorEmailAddress || '',
    items: Array.isArray(serialized.items) ? serialized.items : [],
    subtotal: Number(serialized.subtotal || 0),
    gstPercentage: Number(serialized.gstPercentage || 0),
    cgst: Number(serialized.cgst || 0),
    sgst: Number(serialized.sgst || 0),
    gstAmount: Number(serialized.gstAmount || 0),
    total: Number(serialized.total || 0),
    invoiceDate: serialized.invoiceDate || serialized.createdAt || null,
    dueDate: serialized.dueDate || null,
    paymentStatus: serialized.paymentStatus || 'unpaid',
    createdByRole: serialized.createdByRole || '',
    createdByName: serialized.createdByName || '',
    employeeName: serialized.employeeName || '',
    companySnapshot: serialized.companySnapshot || {},
    clientSnapshot: serialized.clientSnapshot || {},
  };
}

async function ensurePublicTokens(invoices) {
  const records = Array.isArray(invoices) ? invoices : [invoices];
  const missingRecords = records.filter((invoice) => invoice && !normalize(invoice.publicToken));
  if (!missingRecords.length) return;

  const usedTokens = new Set(records.map((invoice) => normalize(invoice?.publicToken)).filter(Boolean));
  const operations = missingRecords.map((invoice) => {
    let publicToken = generatePublicToken();
    while (usedTokens.has(publicToken)) publicToken = generatePublicToken();
    usedTokens.add(publicToken);
    invoice.publicToken = publicToken;
    return {
      updateOne: {
        filter: {
          _id: invoice._id,
          $or: [
            { publicToken: { $exists: false } },
            { publicToken: '' },
            { publicToken: null },
          ],
        },
        update: { $set: { publicToken } },
      },
    };
  });

  await Invoice.bulkWrite(operations, { ordered: false });
  const refreshed = await Invoice.find({ _id: { $in: missingRecords.map((invoice) => invoice._id) } })
    .select('_id publicToken')
    .lean();
  const tokenById = new Map(refreshed.map((invoice) => [String(invoice._id), invoice.publicToken]));
  missingRecords.forEach((invoice) => {
    invoice.publicToken = tokenById.get(String(invoice._id)) || invoice.publicToken;
  });
}

function getConvertedStatuses(user) {
  const configured = Array.isArray(user?.convertedPageStatuses) ? user.convertedPageStatuses : [];
  return configured.length ? configured : ['Converted'];
}

function isConvertedLead(lead, user) {
  return getConvertedStatuses(user)
    .map((status) => normalize(status).toLowerCase())
    .includes(normalize(lead?.status).toLowerCase());
}

function parseInvoiceSeries(invoiceNumber) {
  const match = normalize(invoiceNumber).match(/^(Invoice_\d{4}\d{3})_v(\d+)$/);
  if (!match) return null;
  return {
    base: match[1],
    sequence: Number(match[1].slice(-3)),
    version: Number(match[2] || 1),
  };
}

function buildCompanyInvoiceFilter(companyCode, lead, client) {
  const conditions = [];
  if (client?.clientId) conditions.push({ clientId: client.clientId });
  if (lead?._id) conditions.push({ leadId: lead._id });
  const leadCompanyName = normalize(lead?.leadCompanyName || client?.companyName);
  if (leadCompanyName) {
    conditions.push({ leadCompanyName: new RegExp(`^${escapeRegex(leadCompanyName)}$`, 'i') });
  }
  return conditions.length ? { companyCode, $or: conditions } : { companyCode };
}

async function generateInvoiceNumber(companyCode, lead, invoiceDate, client = null) {
  const existingInvoice = await Invoice.findOne(buildCompanyInvoiceFilter(companyCode, lead, client))
    .sort({ versionNo: -1, createdAt: -1 })
    .select('invoiceNumber versionNo')
    .lean();
  const existingSeries = parseInvoiceSeries(existingInvoice?.invoiceNumber);
  if (existingSeries) {
    const nextVersion = Math.max(Number(existingInvoice?.versionNo || 0), existingSeries.version) + 1;
    return {
      invoiceNumber: `${existingSeries.base}_v${nextVersion}`,
      versionNo: nextVersion,
    };
  }

  const date = invoiceDate ? new Date(invoiceDate) : new Date();
  const yy = String(date.getFullYear()).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const prefix = `Invoice_${yy}${mm}`;
  const existingMonthInvoices = await Invoice.find({
    companyCode,
    invoiceNumber: new RegExp(`^${prefix}\\d{3}_v\\d+$`),
  }).select('invoiceNumber').lean();
  const maxSequence = existingMonthInvoices.reduce((max, record) => {
    const parsed = parseInvoiceSeries(record?.invoiceNumber);
    return parsed ? Math.max(max, parsed.sequence) : max;
  }, 0);
  return {
    invoiceNumber: `${prefix}${String(maxSequence + 1).padStart(3, '0')}_v1`,
    versionNo: 1,
  };
}

function buildLineItems(rawItems, gstPercentage) {
  return (Array.isArray(rawItems) ? rawItems : [])
    .map((item) => {
      const quantity = Math.max(1, Number(item.quantity || 1));
      const rate = Math.max(0, Number(item.rate ?? item.price ?? 0));
      const taxable = rate * quantity;
      const gst = taxable * (Number(gstPercentage || 0) / 100);
      return {
        productId: mongoose.Types.ObjectId.isValid(item.productId || item.product?._id)
          ? item.productId || item.product?._id
          : null,
        name: normalize(item.name || item.product?.name || 'Service'),
        sacHsn: normalize(item.sacHsn || item.product?.sacHsn || ''),
        quantity,
        rate,
        taxable,
        cgst: gst / 2,
        sgst: gst / 2,
        total: taxable + gst,
      };
    })
    .filter((item) => item.name && item.rate > 0);
}

async function findInvoiceLead(body) {
  const companyCode = normalize(body.companyCode);
  const leadId = normalize(body.leadId);
  if (leadId && mongoose.Types.ObjectId.isValid(leadId)) {
    const lead = await Lead.findOne({ _id: leadId, companyCode, isArchived: { $ne: true } });
    if (lead) return lead;
  }

  const contactNumber = normalize(body.contactNumber);
  if (contactNumber) {
    return Lead.findOne({ companyCode, contactNumber, isArchived: { $ne: true } });
  }

  return null;
}

async function findClientPrimaryLead(client) {
  const sourceLeadIds = Array.isArray(client?.sourceLeadIds) ? client.sourceLeadIds : [];
  const firstLeadId = sourceLeadIds.find((id) => mongoose.Types.ObjectId.isValid(id));
  if (firstLeadId) {
    const lead = await Lead.findOne({ _id: firstLeadId, companyCode: client.companyCode, isArchived: { $ne: true } });
    if (lead) return lead;
  }

  return Lead.findOne({
    companyCode: client.companyCode,
    leadCompanyNameLower: normalizeText(client.companyName),
    isArchived: { $ne: true },
  }).sort({ updatedAt: -1, createdAt: -1 });
}

router.post('/', async (req, res) => {
  try {
    const companyCode = normalize(req.body.companyCode);
    if (!companyCode) {
      return res.status(400).json({ success: false, message: 'companyCode is required.' });
    }

    const user = await User.findOne({ companyCode });
    if (!user) {
      return res.status(404).json({ success: false, message: 'Company settings not found.' });
    }

    let client = await getClientByClientId(companyCode, req.body.clientId);
    let lead = await findInvoiceLead(req.body);

    if (!client && lead) {
      if (!isConvertedLead(lead, user)) {
        return res.status(400).json({
          success: false,
          message: 'Invoices can only be generated for onboarded clients.',
        });
      }
      client = await ensureClientForLead(lead);
    }

    if (!client) {
      return res.status(404).json({ success: false, message: 'Client not found for invoice.' });
    }

    if (!lead) {
      lead = await findClientPrimaryLead(client);
    }

    const gstPercentage = Number(req.body.gstPercentage ?? user.gstPercentage ?? 18);
    const items = buildLineItems(req.body.items, gstPercentage);
    if (!items.length) {
      return res.status(400).json({ success: false, message: 'At least one invoice item is required.' });
    }

    const subtotal = items.reduce((sum, item) => sum + item.taxable, 0);
    const gstAmount = items.reduce((sum, item) => sum + item.cgst + item.sgst, 0);
    const invoiceDate = req.body.invoiceDate ? new Date(req.body.invoiceDate) : new Date();
    const { invoiceNumber, versionNo } = await generateInvoiceNumber(companyCode, lead, invoiceDate, client);
    const clientDto = mapClient(client);
    const clientCompanyName = clientDto.companyName || lead?.leadCompanyName || 'Client Company';

    const invoice = await Invoice.create({
      companyCode,
      clientId: client.clientId,
      employeePhone: normalize(req.body.employeePhone || lead?.assignedEmployeePhone || clientDto.assignedEmployeePhones?.[0]),
      employeeName: normalize(req.body.employeeName),
      leadId: lead?._id || null,
      leadCompanyName: clientCompanyName,
      contactName: clientDto.primaryContactName || lead?.contactName || '',
      contactNumber: clientDto.primaryPhone || lead?.contactNumber || '',
      directorEmailAddress: clientDto.primaryEmail || lead?.directorEmailAddress || '',
      invoiceNumber,
      versionNo,
      publicToken: generatePublicToken(),
      items,
      subtotal,
      gstPercentage,
      cgst: gstAmount / 2,
      sgst: gstAmount / 2,
      gstAmount,
      total: subtotal + gstAmount,
      invoiceDate,
      dueDate: req.body.dueDate ? new Date(req.body.dueDate) : null,
      paymentStatus: normalizePaymentStatus(req.body.paymentStatus),
      createdByRole: req.body.createdByRole === 'admin' ? 'admin' : 'employee',
      createdByName: normalize(req.body.createdByName || req.body.employeeName),
      createdByPhone: normalize(req.body.createdByPhone || req.body.employeePhone),
      companySnapshot: {
        name: user.showCompanyNameOnInvoice === false ? '' : user.companyName,
        logo: user.invoiceLogo || '',
        seal: user.invoiceSeal || '',
        terms: user.invoiceTerms || '',
        gstNumber: user.gstNumber || '',
        registeredAddress: user.invoiceRegisteredAddress || user.companyAddress || '',
        phone: user.contactDetails?.phone || '',
        email: user.contactDetails?.email || '',
        website: user.contactDetails?.website || '',
        footer: user.invoiceFooter || '',
        bankDetails: {
          bankName: user.bankDetails?.bankName || '',
          accountNumber: user.bankDetails?.accountNumber || '',
          ifscCode: user.bankDetails?.ifscCode || '',
          branchName: user.bankDetails?.branchName || '',
        },
      },
      clientSnapshot: {
        clientId: client.clientId,
        companyName: clientCompanyName,
        contactName: clientDto.primaryContactName || lead?.contactName || '',
        phone: clientDto.primaryPhone || lead?.contactNumber || '',
        email: clientDto.primaryEmail || lead?.directorEmailAddress || '',
        address: clientDto.address || '',
      },
    });

    return res.status(201).json({ success: true, invoice: serializeInvoice(invoice, req) });
  } catch (err) {
    console.error('Create invoice error:', err);
    return res.status(500).json({ success: false, message: 'Failed to save invoice.' });
  }
});

router.get('/public/:publicToken', async (req, res) => {
  try {
    const publicToken = normalize(req.params.publicToken);
    if (!publicToken) {
      return res.status(404).json({ success: false, message: 'Invoice not found.' });
    }

    const invoice = await Invoice.findOne({ publicToken }).lean();
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found.' });
    }

    return res.json({ success: true, invoice: serializeInvoice(invoice, req, true) });
  } catch (err) {
    console.error('Public invoice error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch invoice.' });
  }
});

router.get('/', async (req, res) => {
  try {
    const companyCode = normalize(req.query.companyCode);
    if (!companyCode) {
      return res.status(400).json({ success: false, message: 'companyCode is required.' });
    }

    const filter = { companyCode };
    const clientId = normalize(req.query.clientId);
    if (clientId) filter.clientId = clientId;
    const employeePhone = normalize(req.query.employeePhone);
    if (employeePhone) filter.employeePhone = employeePhone;

    const search = normalize(req.query.search);
    if (search) {
      filter.$or = [
        { invoiceNumber: new RegExp(search, 'i') },
        { clientId: new RegExp(search, 'i') },
        { leadCompanyName: new RegExp(search, 'i') },
        { contactName: new RegExp(search, 'i') },
        { contactNumber: new RegExp(search, 'i') },
        { directorEmailAddress: new RegExp(search, 'i') },
      ];
    }

    const dateFrom = req.query.dateFrom ? new Date(req.query.dateFrom) : null;
    const dateTo = req.query.dateTo ? new Date(req.query.dateTo) : null;
    if (dateFrom || dateTo) {
      filter.invoiceDate = {};
      if (dateFrom) filter.invoiceDate.$gte = dateFrom;
      if (dateTo) {
        dateTo.setHours(23, 59, 59, 999);
        filter.invoiceDate.$lte = dateTo;
      }
    }

    const pagination = parsePageQuery(req.query);
    const [total, invoices] = await Promise.all([
      Invoice.countDocuments(filter),
      Invoice.find(filter)
        .sort({ invoiceDate: -1, createdAt: -1 })
        .skip(pagination.isPaginated ? pagination.skip : 0)
        .limit(pagination.isPaginated ? pagination.pageSize : 300)
        .lean(),
    ]);
    await ensurePublicTokens(invoices);

    const page = buildPageResponse({
      items: invoices.map((invoice) => serializeInvoice(invoice, req)),
      total,
      page: pagination.page,
      pageSize: pagination.isPaginated ? pagination.pageSize : invoices.length,
    });

    return res.json({
      success: true,
      invoices: page.items,
      items: page.items,
      page: page.page,
      pageSize: page.pageSize,
      total: page.total,
      hasMore: page.hasMore,
    });
  } catch (err) {
    console.error('List invoices error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch invoices.' });
  }
});

module.exports = router;
