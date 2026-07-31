
const express = require('express');
const { tenantMiddleware } = require('../../common/tenantMiddleware');
const router = express.Router();
router.use(tenantMiddleware);
const { getConvertedClients } = require('./clientService');

router.get('/clients', async (req, res) => {
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
    const clients = await getConvertedClients({
      companyCode: scopedCompany(req),
      search: req.query.search
    });
    return res.json({
      success: true,
      clients,
      total: clients.length
    });
  } catch (err) {
    console.error('[crm clients]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to load CRM clients.'
    });
  }
});

router.put('/clients/:id', async (req, res) => {
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
    const {
      id
    } = req.params;
    const companyCode = scopedCompany(req);
    const isObjectId = mongoose.Types.ObjectId.isValid(id);
    const searchFilter = isObjectId ? {
      $or: [{
        clientId: id
      }, {
        _id: id
      }]
    } : {
      clientId: id
    };
    let client = await Client.findOne(companyCode ? {
      ...searchFilter,
      companyCode
    } : searchFilter);
    if (!client && companyCode) {
      client = await Client.findOne(searchFilter);
    }
    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found.'
      });
    }
    console.log('[CRM Update Client] req.body:', req.body);
    if (req.body.companyName !== undefined) client.companyName = String(req.body.companyName).trim();
    if (req.body.primaryContactName !== undefined) client.primaryContactName = String(req.body.primaryContactName).trim();
    if (req.body.primaryPhone !== undefined) client.primaryPhone = String(req.body.primaryPhone).trim();
    if (req.body.primaryEmail !== undefined) client.primaryEmail = String(req.body.primaryEmail).trim().toLowerCase();
    if (req.body.address !== undefined) client.address = String(req.body.address).trim();
    if (req.body.gstNumber !== undefined) client.gstNumber = String(req.body.gstNumber).trim().toUpperCase();
    if (req.body.description !== undefined) client.description = String(req.body.description).trim();
    if (req.body.status !== undefined) client.status = String(req.body.status).trim();
    await client.save();
    return res.json({
      success: true,
      client
    });
  } catch (err) {
    console.error('[crm client update]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to update client.'
    });
  }
});

module.exports = router;
