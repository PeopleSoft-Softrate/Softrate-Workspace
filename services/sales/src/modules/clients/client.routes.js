const express = require('express');
const {
  createManualClient,
  listClients,
  mapClient,
  updateClient,
} = require('../../../services/clientService');
const { companyMiddleware } = require('../../common/tenantMiddleware');

const router = express.Router();
router.use(companyMiddleware);

router.get('/', async (req, res) => {
  try {
    const payload = await listClients({ ClientModel: req.models.Client }, req.query);
    return res.json(payload);
  } catch (err) {
    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || 'Failed to load clients.',
    });
  }
});

router.post('/', async (req, res) => {
  try {
    const result = await createManualClient(
      { ClientModel: req.models.Client, LeadModel: req.models.Lead, CounterModel: req.models.Counter },
      { ...(req.body || {}), serviceName: req.body.serviceName }
    );
    return res.status(result.created ? 201 : 200).json({
      success: true,
      client: mapClient(result.client),
      duplicate: result.duplicate,
    });
  } catch (err) {
    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || 'Failed to onboard client.',
      client: err.client,
    });
  }
});

router.put('/:id', async (req, res) => {
  try {
    console.log('[Sales Update Client] req.body:', req.body);
    const client = await updateClient(
      { ClientModel: req.models.Client },
      req.params.id,
      req.body || {}
    );
    return res.json({
      success: true,
      client: mapClient(client),
    });
  } catch (err) {
    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || 'Failed to update client.',
    });
  }
});
const Quotation = require('../../../models/Quotation');
const Invoice = require('../../../models/Invoice');
const History = require('../../../models/History');
const CallDetail = require('../../../models/CallDetail');
const Client = require('../../../models/Client');
const Lead = require('../../../models/Lead');

router.get('/:companyCode/profile/:clientId', async (req, res) => {
  try {
    const { companyCode, clientId } = req.params;
    const client = await req.models.Client.findOne({ companyCode, clientId });
    
    if (!client) {
      return res.status(404).json({ success: false, message: 'Client not found.' });
    }

    const sourceLeadIds = client.sourceLeadIds || [];
    const phone = client.primaryPhoneNormalized;

    // Fetch related data concurrently
    const [quotations, invoices, history, callLogs, lead] = await Promise.all([
      sourceLeadIds.length > 0 
        ? req.models.Quotation.find({ companyCode, leadId: { $in: sourceLeadIds } }).sort({ quotationDate: -1 })
        : Promise.resolve([]),
      req.models.Invoice.find({ companyCode, clientId }).sort({ invoiceDate: -1 }),
      phone 
        ? req.models.History.find({ companyCode, contactNumber: phone }).sort({ timestamp: -1 }) 
        : Promise.resolve([]),
      phone 
        ? req.models.CallDetail.find({ companyCode, number: phone }).sort({ timestamp: -1 }) 
        : Promise.resolve([]),
      (sourceLeadIds.length > 0)
        ? req.models.Lead.findById(sourceLeadIds[0])
        : (phone ? req.models.Lead.findOne({ companyCode, contactNumberNormalized: phone }) : Promise.resolve(null))
    ]);

    // Combine history and callLogs into a single activity log timeline
    const activityLog = [
      ...history.map(h => ({ type: 'history', data: h, date: h.timestamp })),
      ...callLogs.map(c => ({ type: 'call', data: c, date: c.timestamp }))
    ].sort((a, b) => new Date(b.date) - new Date(a.date));

    return res.json({
      success: true,
      client: mapClient(client),
      leadDetails: {
        directorEmailAddress: lead?.directorEmailAddress || '',
        isStarred: lead?.isStarred || false,
      },
      callCount: callLogs.length,
      quotations,
      invoices,
      activityLog
    });
  } catch (err) {
    console.error('[Client Profile Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to load client profile.'
    });
  }
});

module.exports = router;
