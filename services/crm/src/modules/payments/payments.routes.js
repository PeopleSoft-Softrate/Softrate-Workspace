
const express = require('express');
const { tenantMiddleware } = require('../../common/tenantMiddleware');
const router = express.Router();
router.use(tenantMiddleware);

function makeDocumentNumber(type) {
  const now = new Date();
  const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  return `${type}-${date}-${Math.floor(100000 + Math.random() * 900000)}`;
}

router.get('/payments', async (req, res) => {
  const {
    Client,
    CrmAmc,
    CrmContract,
    CrmDocumentTemplate,
    CrmPayment,
    CrmProject,
    CrmTicket,
    Lead
  } = req.models;
  try {
    const companyCode = scopedCompany(req);
    const query = companyCode ? {
      companyCode
    } : {};
    if (req.query.clientCompanyName) query.clientCompanyName = req.query.clientCompanyName;
    const payments = await CrmPayment.find(query).sort({
      createdAt: -1
    }).lean();
    const totalInvoiceAmount = payments.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const paidAmount = payments.reduce((sum, item) => sum + Number(item.paidAmount || 0), 0);
    return res.json({
      success: true,
      payments,
      analytics: {
        totalInvoiceAmount,
        paidAmount,
        outstandingAmount: Math.max(totalInvoiceAmount - paidAmount, 0),
        paidInvoiceCount: payments.filter(item => item.status === 'Paid').length
      }
    });
  } catch (err) {
    console.error('[crm payments]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to load payments.'
    });
  }
});

router.post('/payments/paid-invoice', async (req, res) => {
  const {
    Client,
    CrmAmc,
    CrmContract,
    CrmDocumentTemplate,
    CrmPayment,
    CrmProject,
    CrmTicket,
    Lead
  } = req.models;
  try {
    if (!req.body?.clientCompanyName) {
      return res.status(400).json({
        success: false,
        message: 'Client company is required.'
      });
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
      notes: req.body.notes || 'Paid invoice generated from CRM payments.'
    });
    return res.status(201).json({
      success: true,
      payment
    });
  } catch (err) {
    console.error('[crm paid invoice]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate paid invoice.'
    });
  }
});

module.exports = router;
