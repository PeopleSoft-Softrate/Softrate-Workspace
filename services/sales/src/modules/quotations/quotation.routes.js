const express = require('express');
const mongoose = require('mongoose');
const Quotation = require('../../../models/Quotation');
const Lead = require('../../../models/Lead');
const User = require('../../../models/User');
const Employee = require('../../../models/Employee');
const { parsePageQuery, buildPageResponse } = require('../../common/pagination/pagination');

const { companyMiddleware } = require('../../common/tenantMiddleware');
const router = express.Router();
router.use(companyMiddleware);

function normalize(value) {
  return String(value || '').trim();
}

async function findLead(req, body) {
  const companyCode = normalize(body.companyCode);
  const leadId = normalize(body.leadId);
  if (leadId && mongoose.Types.ObjectId.isValid(leadId)) {
    const lead = await req.models.Lead.findOne({ _id: leadId, companyCode, isArchived: { $ne: true } });
    if (lead) return lead;
  }
  const contactNumber = normalize(body.contactNumber);
  if (contactNumber) return req.models.Lead.findOne({ companyCode, contactNumber, isArchived: { $ne: true } });
  return null;
}


async function generateQuotationNumber(req, companyCode, lead, quotationDate, client = null) {
  const date = quotationDate ? new Date(quotationDate) : new Date();
  const yy = String(date.getFullYear()).slice(-2);
  
  const count = await req.models.Quotation.countDocuments({
    companyCode,
    quotationNumber: new RegExp(`^QT-${yy}\\d{3,}$`, 'i'),
  });
  
  const nextSeq = String(count + 1).padStart(3, '0');
  
  return {
    quotationNumber: `QT-${yy}${nextSeq}`,
    versionNo: 1,
  };
}

function buildItems(rawItems, gstPercentage) {
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
        quantity,
        rate,
        taxable,
        gst,
        total: taxable + gst,
      };
    })
    .filter((item) => item.name && item.rate >= 0);
}

router.post('/', async (req, res) => {
  
  try {
    const companyCode = normalize(req.body.companyCode);
    const brandingCompanyCode = normalize(req.body.brandingCompanyCode) || companyCode;
    if (!companyCode) return res.status(400).json({ success: false, message: 'companyCode is required.' });

    const user = await User.findOne({ companyCode: brandingCompanyCode });
    if (!user) return res.status(404).json({ success: false, message: 'Company settings not found.' });

    const { getClientByClientId } = require('../../../services/clientService');
    const lead = await findLead(req, req.body);
    let client = null;
    if (!lead && req.body.clientId) {
      client = await getClientByClientId({ ClientModel: req.models.Client }, companyCode, req.body.clientId);
    }
    if (!lead && !client) return res.status(404).json({ success: false, message: 'req.models.Lead or Client not found for quotation.' });

    const gstPercentage = Number(req.body.gstPercentage ?? user.gstPercentage ?? 18);
    const items = buildItems(req.body.items, gstPercentage);
    if (!items.length) return res.status(400).json({ success: false, message: 'At least one quotation item is required.' });

    const subtotal = items.reduce((sum, item) => sum + item.taxable, 0);
    const gstAmount = items.reduce((sum, item) => sum + item.gst, 0);

    let quotation = null;
    let lastError = null;
    let retries = 5;

    const resolveEmployeeId = async (val) => {
      const v = normalize(val);
      if (!v) return null;
      if (mongoose.Types.ObjectId.isValid(v)) return v;
      const emp = await Employee.findOne({ companyCode, phone: v }).lean() || await Employee.findOne({ companyCode, mobile: v }).lean();
      return emp ? emp._id : null;
    };

    const resolvedEmployeeId = await resolveEmployeeId(req.body.employeeId || lead?.assignedEmployeePhone || lead?.assignedEmployeeId || client?.assignedEmployeePhones?.[0]);
    const resolvedCreatedById = await resolveEmployeeId(req.body.createdById || req.body.employeeId);

    while (retries > 0) {
      try {
        const quotationDate = req.body.quotationDate ? new Date(req.body.quotationDate) : new Date();
        const { quotationNumber, versionNo } = await generateQuotationNumber(req, companyCode, lead, quotationDate, client);

        const clientCompanyName = client?.companyName || lead?.leadCompanyName || 'Client Company';

        quotation = await req.models.Quotation.create({
          companyCode,
          clientId: client?.clientId || '',
          employeeId: resolvedEmployeeId,
          employeeName: normalize(req.body.employeeName),
          leadId: lead?._id || null,
          leadCompanyName: clientCompanyName,
          contactName: client?.primaryContactName || lead?.contactName || '',
          contactNumber: client?.primaryPhone || lead?.contactNumber || '',
          directorEmailAddress: client?.primaryEmail || lead?.directorEmailAddress || '',
          quotationNumber,
          versionNo,
          kindNote: normalize(req.body.kindNote || user.invoiceFooter || 'We aim to provide the best software to automate your business with high quality at affordable cost.'),
          items,
          subtotal,
          gstPercentage,
          gstAmount,
          total: subtotal + gstAmount,
          quotationDate,
          createdByRole: req.body.createdByRole === 'admin' ? 'admin' : 'employee',
          createdByName: normalize(req.body.createdByName || req.body.employeeName),
          createdById: resolvedCreatedById,
          companySnapshot: {
            name: user.showCompanyNameOnInvoice === false ? '' : user.companyName,
            logo: user.invoiceLogo || '',
            registeredAddress: user.invoiceRegisteredAddress || user.companyAddress || '',
            phone: user.contactDetails?.phone || '',
            email: user.contactDetails?.email || '',
            website: user.contactDetails?.website || '',
            gstNumber: user.gstNumber || '',
            footer: user.invoiceFooter || '',
            bankDetails: (() => {
              const clientGst = lead.gstNumber || '';
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
        });
        break;
      } catch (err) {
        lastError = err;
        if (err.code === 11000 && (err.keyPattern?.quotationNumber || err.errmsg?.includes('quotationNumber'))) {
          retries -= 1;
          continue;
        }
        throw err;
      }
    }

    if (!quotation) {
      throw lastError;
    }

    return res.status(201).json({ success: true, quotation });
  } catch (err) {
    console.error('Create quotation error:', err);
    return res.status(500).json({ success: false, message: 'Failed to save quotation.' });
  }
});

router.get('/', async (req, res) => {
  
  try {
    const companyCode = normalize(req.query.companyCode);
    if (!companyCode) return res.status(400).json({ success: false, message: 'companyCode is required.' });

    const filter = { companyCode };
    const employeeId = normalize(req.query.employeeId);
    if (employeeId) filter.employeeId = employeeId;
    const leadId = normalize(req.query.leadId);
    if (leadId && mongoose.Types.ObjectId.isValid(leadId)) {
      filter.leadId = new mongoose.Types.ObjectId(leadId);
    }

    const search = normalize(req.query.search);
    if (search) {
      filter.$or = [
        { quotationNumber: new RegExp(search, 'i') },
        { leadCompanyName: new RegExp(search, 'i') },
        { contactName: new RegExp(search, 'i') },
        { contactNumber: new RegExp(search, 'i') },
        { directorEmailAddress: new RegExp(search, 'i') },
      ];
    }

    const dateFrom = req.query.dateFrom ? new Date(req.query.dateFrom) : null;
    const dateTo = req.query.dateTo ? new Date(req.query.dateTo) : null;
    if (dateFrom || dateTo) {
      filter.quotationDate = {};
      if (dateFrom) filter.quotationDate.$gte = dateFrom;
      if (dateTo) {
        dateTo.setHours(23, 59, 59, 999);
        filter.quotationDate.$lte = dateTo;
      }
    }

    const pagination = parsePageQuery(req.query);
    const [total, quotations] = await Promise.all([
      req.models.Quotation.countDocuments(filter),
      req.models.Quotation.find(filter)
        .sort({ quotationDate: -1, createdAt: -1 })
        .skip(pagination.isPaginated ? pagination.skip : 0)
        .limit(pagination.isPaginated ? pagination.pageSize : 300)
        .lean(),
    ]);

    const page = buildPageResponse({
      items: quotations,
      total,
      page: pagination.page,
      pageSize: pagination.isPaginated ? pagination.pageSize : quotations.length,
    });

    return res.json({
      success: true,
      quotations: page.items,
      items: page.items,
      page: page.page,
      pageSize: page.pageSize,
      total: page.total,
      hasMore: page.hasMore,
    });
  } catch (err) {
    console.error('List quotations error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch quotations.' });
  }
});

module.exports = router;
