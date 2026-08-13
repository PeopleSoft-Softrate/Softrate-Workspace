const express = require('express');
const mongoose = require('mongoose');
const crypto = require('crypto');
const Invoice = require('../../../models/Invoice');
const Lead = require('../../../models/Lead');
const User = require('../../../models/User');
const Employee = require('../../../models/Employee');
const EmployeeRevenue = require('../../../models/EmployeeRevenue');
const eventBus = require('../../../services/eventBus');
const { getClientByClientId, ensureClientForLead, mapClient } = require('../../../services/clientService');
const { normalizeText } = require('../../../services/leadNormalization');
const { parsePageQuery, buildPageResponse } = require('../../common/pagination/pagination');

const { companyMiddleware } = require('../../common/tenantMiddleware');
const router = express.Router();
router.use(companyMiddleware);

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
  const isLocalhost = /localhost|127\.0\.0\.1/.test(configuredUrl);
  if (configuredUrl && !isLocalhost) return configuredUrl.replace(/\/+$/, '');

  // Derive from request: use X-Forwarded-Proto + Host for reverse-proxied requests
  const forwardedProto = normalize(req.get('x-forwarded-proto')).split(',')[0].trim();
  const forwardedHost = normalize(req.get('x-forwarded-host') || req.get('host'));
  if (forwardedProto && forwardedHost && !forwardedHost.includes('localhost') && !forwardedHost.includes('127.0.0.1')) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  const requestOrigin = normalize(req.get('origin'));
  if (requestOrigin && !requestOrigin.includes('localhost') && !requestOrigin.includes('127.0.0.1')) {
    return requestOrigin.replace(/\/+$/, '');
  }

  // Last resort
  return `${req.protocol}://${req.get('host')}`;
}

function publicInvoiceUrl(req, publicToken) {
  return `${frontendBaseUrl(req)}/invoice/${encodeURIComponent(publicToken || '')}`;
}

function serializeInvoice(invoice, req, publicOnly = false) {
  const source = typeof invoice?.toObject === 'function' ? invoice.toObject() : invoice;
  if (!source) return source;
  const publicToken = normalize(source.publicToken);
  let computedAmountPaid = Number(source.amountPaid || 0);
  let computedBalanceDue = source.balanceDue !== undefined ? Number(source.balanceDue) : (Number(source.total || 0) - computedAmountPaid);
  
  if (source.paymentStatus === 'paid' && computedAmountPaid === 0 && Number(source.total || 0) > 0) {
    computedAmountPaid = Number(source.total || 0);
    computedBalanceDue = 0;
  }

  const serialized = {
    ...source,
    publicToken,
    amountPaid: computedAmountPaid,
    balanceDue: computedBalanceDue,
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
    amountPaid: serialized.amountPaid,
    balanceDue: serialized.balanceDue,
    isInclusiveGst: Boolean(serialized.isInclusiveGst),
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

  await req.models.Invoice.bulkWrite(operations, { ordered: false });
  const refreshed = await req.models.Invoice.find({ _id: { $in: missingRecords.map((invoice) => invoice._id) } })
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


async function generateInvoiceNumber(companyCode, lead, invoiceDate, client = null, req) {
  const date = invoiceDate ? new Date(invoiceDate) : new Date();
  const yy = String(date.getFullYear()).slice(-2);
  
  const count = await req.models.Invoice.countDocuments({
    companyCode,
    invoiceNumber: new RegExp(`^${yy}\\d{3,}$`),
  });
  
  const nextSeq = String(count + 1).padStart(3, '0');
  
  return {
    invoiceNumber: `${yy}${nextSeq}`,
    versionNo: 1,
  };
}

function buildLineItems(rawItems, gstPercentage, isInclusiveGst = false) {
  return (Array.isArray(rawItems) ? rawItems : [])
    .map((item) => {
      const quantity = Math.max(1, Number(item.quantity || 1));
      const rate = Math.max(0, Number(item.rate ?? item.price ?? 0));
      let taxable, gst, total;
      
      if (isInclusiveGst) {
        total = rate * quantity;
        taxable = total / (1 + (Number(gstPercentage || 0) / 100));
        gst = total - taxable;
      } else {
        taxable = rate * quantity;
        gst = taxable * (Number(gstPercentage || 0) / 100);
        total = taxable + gst;
      }

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
        total,
      };
    })
    .filter((item) => item.name && item.rate > 0);
}

async function findInvoiceLead(body, req) {
  const companyCode = normalize(body.companyCode);
  const leadId = normalize(body.leadId);
  if (leadId && mongoose.Types.ObjectId.isValid(leadId)) {
    const lead = await req.models.Lead.findOne({ _id: leadId, companyCode, isArchived: { $ne: true } });
    if (lead) return lead;
  }

  const contactNumber = normalize(body.contactNumber);
  if (contactNumber) {
    return req.models.Lead.findOne({ companyCode, contactNumber, isArchived: { $ne: true } });
  }

  return null;
}

async function findClientPrimaryLead(client, req) {
  const sourceLeadIds = Array.isArray(client?.sourceLeadIds) ? client.sourceLeadIds : [];
  const firstLeadId = sourceLeadIds.find((id) => mongoose.Types.ObjectId.isValid(id));
  if (firstLeadId) {
    const lead = await req.models.Lead.findOne({ _id: firstLeadId, companyCode: client.companyCode, isArchived: { $ne: true } });
    if (lead) return lead;
  }

  return req.models.Lead.findOne({
    companyCode: client.companyCode,
    leadCompanyNameLower: normalizeText(client.companyName),
    isArchived: { $ne: true },
  }).sort({ updatedAt: -1, createdAt: -1 });
}

router.post('/', async (req, res) => {
  
  try {
    const companyCode = normalize(req.body.companyCode);
    const brandingCompanyCode = normalize(req.body.brandingCompanyCode) || companyCode;
    if (!companyCode) {
      return res.status(400).json({ success: false, message: 'companyCode is required.' });
    }

    const user = await User.findOne({ companyCode: brandingCompanyCode });
    if (!user) {
      return res.status(404).json({ success: false, message: 'Company settings not found.' });
    }

    let client = await getClientByClientId({ ClientModel: req.models.Client }, companyCode, req.body.clientId);
    let lead = await findInvoiceLead(req.body, req);

    if (!client && lead) {
      if (!isConvertedLead(lead, user) && !req.body.dealId) {
        return res.status(400).json({
          success: false,
          message: 'Invoices can only be generated for onboarded clients.',
        });
      }
      client = await ensureClientForLead(
        { ClientModel: req.models.Client, LeadModel: req.models.Lead, CounterModel: req.models.Counter },
        lead,
        { forceCreate: !!req.body.dealId }
      );
    }

    if (!client) {
      return res.status(404).json({ success: false, message: 'Client not found for invoice.' });
    }

    if (!lead) {
      lead = await findClientPrimaryLead(client, req);
    }

    const gstPercentage = Number(req.body.gstPercentage ?? user.gstPercentage ?? 18);
    const isInclusiveGst = Boolean(req.body.isInclusiveGst);
    const items = buildLineItems(req.body.items, gstPercentage, isInclusiveGst);
    if (!items.length) {
      return res.status(400).json({ success: false, message: 'At least one invoice item is required.' });
    }

    const subtotal = items.reduce((sum, item) => sum + item.taxable, 0);
    const gstAmount = items.reduce((sum, item) => sum + item.cgst + item.sgst, 0);
    const invoiceDate = req.body.invoiceDate ? new Date(req.body.invoiceDate) : new Date();
    
    let invoice;
    let retries = 3;
    let lastError;

    const resolveEmployeeId = async (val) => {
      const v = normalize(val);
      if (!v) return null;
      if (mongoose.Types.ObjectId.isValid(v)) return v;
      const emp = await Employee.findOne({ companyCode, phone: v }).lean() || await Employee.findOne({ companyCode, mobile: v }).lean();
      return emp ? emp._id : null;
    };
    
    const clientDto = mapClient(client);
    const resolvedEmployeeId = await resolveEmployeeId(req.body.employeeId || lead?.assignedEmployeePhone || clientDto.assignedEmployeePhones?.[0]);
    const resolvedCreatedById = await resolveEmployeeId(req.body.createdById || req.body.employeeId);

    while (retries > 0) {
      try {
        const { invoiceNumber, versionNo } = await generateInvoiceNumber(companyCode, lead, invoiceDate, client, req);
        const clientCompanyName = clientDto.companyName || lead?.leadCompanyName || 'Client Company';

        invoice = await req.models.Invoice.create({
          companyCode,
          clientId: client.clientId,
          employeeId: resolvedEmployeeId,
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
          isInclusiveGst,
          amountPaid: Number(req.body.amountPaid || 0),
          balanceDue: (subtotal + gstAmount) - Number(req.body.amountPaid || 0),
          invoiceDate,
          dueDate: req.body.dueDate ? new Date(req.body.dueDate) : null,
          paymentStatus: normalizePaymentStatus(req.body.paymentStatus),
          createdByRole: req.body.createdByRole === 'admin' ? 'admin' : 'employee',
          createdByName: normalize(req.body.createdByName || req.body.employeeName),
          createdById: resolvedCreatedById,
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
            bankDetails: (() => {
              const clientGst = clientDto.gstNumber || '';
              const hasGst = !!clientGst.trim();
              const selectedBank = (!hasGst && user.bankDetails2 && user.bankDetails2.bankName) ? user.bankDetails2 : user.bankDetails;
              return {
                bankName: selectedBank?.bankName || '',
                accountNumber: selectedBank?.accountNumber || '',
                ifscCode: selectedBank?.ifscCode || '',
                branchName: selectedBank?.branchName || '',
              };
            })(),
          },
          clientSnapshot: {
            clientId: client.clientId,
            companyName: clientCompanyName,
            contactName: clientDto.primaryContactName || lead?.contactName || '',
            phone: clientDto.primaryPhone || lead?.contactNumber || '',
            email: clientDto.primaryEmail || lead?.directorEmailAddress || '',
            address: clientDto.address || '',
            gstNumber: clientDto.gstNumber || '',
          },
        });
        
        break; // Successfully created
      } catch (err) {
        lastError = err;
        if (err.code === 11000 && err.keyPattern && err.keyPattern.invoiceNumber) {
          retries -= 1;
          continue; // Retry generating a new invoice number
        }
        throw err; // Not a duplicate key on invoiceNumber, throw immediately
      }
    }

    if (!invoice) {
      throw lastError; // Exhausted retries
    }

    if (req.body.dealId) {
      try {
        await req.models.Deal.updateOne({ _id: req.body.dealId }, { $set: { amount: invoice.total } });
        eventBus.emitToCompany(companyCode, { type: 'PIPELINE_REFRESH' });
      } catch (dealErr) {
        console.error('Failed to update deal amount from invoice create:', dealErr);
      }
    }

    if (resolvedEmployeeId && invoice.amountPaid > 0) {
      try {
        const invMonth = invoice.invoiceDate.getMonth() + 1;
        const invYear = invoice.invoiceDate.getFullYear();
        await EmployeeRevenue.findOneAndUpdate(
          { companyCode, employeeId: resolvedEmployeeId, year: invYear, month: invMonth },
          { $inc: { achievedAmount: invoice.amountPaid } },
          { upsert: true }
        );
      } catch (revErr) {
        console.error('Failed to update EmployeeRevenue on create:', revErr);
      }
    }

    return res.status(201).json({ success: true, invoice: serializeInvoice(invoice, req) });
  } catch (err) {
    console.error('Create invoice error:', err);
    return res.status(500).json({ success: false, message: 'Failed to save invoice.' });
  }
});

router.put('/:id', async (req, res) => {
  
  try {
    const invoiceId = req.params.id;
    if (!invoiceId) {
      return res.status(400).json({ success: false, message: 'Invoice ID is required.' });
    }

    const { items, total, subTotal, taxTotal, invoiceDate, paymentStatus, amountPaid, balanceDue, isInclusiveGst } = req.body;
    const updateData = {};
    
    if (items !== undefined) updateData.items = items;
    if (total !== undefined) updateData.total = Number(total);
    if (subTotal !== undefined) updateData.subtotal = Number(subTotal);
    if (taxTotal !== undefined) updateData.gstAmount = Number(taxTotal);
    if (invoiceDate !== undefined) updateData.invoiceDate = new Date(invoiceDate);
    if (paymentStatus !== undefined) updateData.paymentStatus = paymentStatus;
    if (amountPaid !== undefined) updateData.amountPaid = Number(amountPaid);
    if (balanceDue !== undefined) updateData.balanceDue = Number(balanceDue);
    if (isInclusiveGst !== undefined) updateData.isInclusiveGst = Boolean(isInclusiveGst);
    
    updateData.updatedAt = new Date();

    const oldInvoice = await req.models.Invoice.findById(invoiceId);
    if (!oldInvoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found.' });
    }

    const invoice = await req.models.Invoice.findByIdAndUpdate(invoiceId, { $set: updateData }, { returnDocument: 'after' });
    
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found.' });
    }

    if (req.body.dealId) {
      try {
        await req.models.Deal.updateOne({ _id: req.body.dealId }, { $set: { amount: invoice.total } });
        eventBus.emitToCompany(updatePayload.companyCode || invoice.companyCode, { type: 'PIPELINE_REFRESH' });
      } catch (dealErr) {
        console.error('Failed to update deal amount from invoice update:', dealErr);
      }
    }

    if (invoice.employeeId || oldInvoice.employeeId) {
      try {
        const oldEmployeeId = oldInvoice.employeeId;
        const newEmployeeId = invoice.employeeId;
        const oldPaid = Number(oldInvoice.amountPaid || 0);
        const newPaid = Number(invoice.amountPaid || 0);

        const currentMonth = new Date().getMonth() + 1;
        const currentYear = new Date().getFullYear();

        if (String(oldEmployeeId) === String(newEmployeeId)) {
          // Same employee, just apply delta to current month
          const delta = newPaid - oldPaid;
          if (delta !== 0 && newEmployeeId) {
            await EmployeeRevenue.findOneAndUpdate(
              { companyCode: invoice.companyCode, employeeId: newEmployeeId, year: currentYear, month: currentMonth },
              { $inc: { achievedAmount: delta } },
              { upsert: true }
            );
          }
        } else {
          // Employee changed, remove from old, add to new (in current month)
          if (oldEmployeeId && oldPaid > 0) {
            await EmployeeRevenue.findOneAndUpdate(
              { companyCode: oldInvoice.companyCode, employeeId: oldEmployeeId, year: currentYear, month: currentMonth },
              { $inc: { achievedAmount: -oldPaid } },
              { upsert: true }
            );
          }
          if (newEmployeeId && newPaid > 0) {
            await EmployeeRevenue.findOneAndUpdate(
              { companyCode: invoice.companyCode, employeeId: newEmployeeId, year: currentYear, month: currentMonth },
              { $inc: { achievedAmount: newPaid } },
              { upsert: true }
            );
          }
        }
      } catch (revErr) {
        console.error('Failed to update EmployeeRevenue on update:', revErr);
      }
    }

    if (!invoice.publicToken) {
      invoice.publicToken = crypto.randomBytes(24).toString('base64url');
      await invoice.save();
    }

    return res.json({ success: true, invoice: serializeInvoice(invoice, req) });
  } catch (err) {
    console.error('Update invoice error:', err);
    return res.status(500).json({ success: false, message: 'Failed to update invoice.' });
  }
});

router.get('/public/:publicToken', async (req, res) => {
  
  try {
    const publicToken = normalize(req.params.publicToken);
    if (!publicToken) {
      return res.status(404).json({ success: false, message: 'Invoice not found.' });
    }

    const invoice = await req.models.Invoice.findOne({ publicToken }).lean();
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
    const employeeId = normalize(req.query.employeeId);
    if (employeeId) filter.employeeId = employeeId;

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
      req.models.Invoice.countDocuments(filter),
      req.models.Invoice.find(filter)
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
