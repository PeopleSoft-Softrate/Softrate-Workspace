
const express = require('express');
const { tenantMiddleware } = require('../../common/tenantMiddleware');
const router = express.Router();
router.use(tenantMiddleware);

router.get('/tickets', async (req, res) => {
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
    const tickets = await CrmTicket.find(query).sort({
      updatedAt: -1
    }).lean();
    return res.json({
      success: true,
      tickets
    });
  } catch (err) {
    console.error('[crm tickets]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to load tickets.'
    });
  }
});

router.post('/tickets', async (req, res) => {
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
    if (!req.body?.clientCompanyName || !req.body?.subject) {
      return res.status(400).json({
        success: false,
        message: 'Client company and subject are required.'
      });
    }
    const ticket = await CrmTicket.create({
      companyCode: scopedCompany(req),
      clientCompanyName: req.body.clientCompanyName,
      subject: req.body.subject,
      query: req.body.query || '',
      priority: req.body.priority || 'Medium',
      status: req.body.status || 'Open',
      raisedBy: req.body.raisedBy || req.crmUser?.email || ''
    });
    return res.status(201).json({
      success: true,
      ticket
    });
  } catch (err) {
    console.error('[crm ticket create]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to create ticket.'
    });
  }
});

module.exports = router;
