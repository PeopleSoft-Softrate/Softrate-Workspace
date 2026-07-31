
const express = require('express');
const { tenantMiddleware } = require('../../common/tenantMiddleware');
const router = express.Router();
router.use(tenantMiddleware);

router.get('/projects', async (req, res) => {
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
    if (req.query.status && req.query.status !== 'all') query.status = req.query.status;
    const projects = await CrmProject.find(query).sort({
      updatedAt: -1
    }).lean();
    return res.json({
      success: true,
      projects
    });
  } catch (err) {
    console.error('[crm projects]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to load project mappings.'
    });
  }
});

router.post('/projects/map', async (req, res) => {
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
    const payload = projectPayload(req.body, companyCode, req.crmUser);
    if (!payload.clientId || !payload.projectManagerName) {
      return res.status(400).json({
        success: false,
        message: 'Onboarded client and project manager are required.'
      });
    }
    const clients = await getConvertedClients({
      Client,
      CrmContract,
      CrmAmc,
      companyCode
    });
    const client = clients.find(item => item.clientId === payload.clientId);
    if (!client) {
      return res.status(400).json({
        success: false,
        message: 'Only onboarded clients can be mapped to a project manager.'
      });
    }
    payload.clientId = client.clientId;
    payload.clientCompanyName = client.companyName;
    payload.clientStatus = client.status || payload.clientStatus;
    const project = await CrmProject.findOneAndUpdate({
      companyCode,
      clientId: payload.clientId
    }, {
      $set: payload
    }, {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true
    }).lean();
    return res.status(200).json({
      success: true,
      project
    });
  } catch (err) {
    console.error('[crm project map]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to save project manager mapping.'
    });
  }
});

router.patch('/projects/:id/status', async (req, res) => {
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
    const status = stringValue(req.body?.status);
    if (!status) return res.status(400).json({
      success: false,
      message: 'Project status is required.'
    });
    const project = await CrmProject.findByIdAndUpdate(req.params.id, {
      $set: {
        status,
        notes: stringValue(req.body?.notes)
      }
    }, {
      new: true,
      runValidators: true
    }).lean();
    if (!project) return res.status(404).json({
      success: false,
      message: 'Project mapping not found.'
    });
    return res.json({
      success: true,
      project
    });
  } catch (err) {
    console.error('[crm project status]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to update project status.'
    });
  }
});

router.delete('/projects/:id', async (req, res) => {
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
    const query = {
      _id: req.params.id
    };
    if (companyCode) query.companyCode = companyCode;
    const project = await CrmProject.findOneAndDelete(query).lean();
    if (!project) return res.status(404).json({
      success: false,
      message: 'Project mapping not found.'
    });
    return res.json({
      success: true,
      message: 'Project mapping removed.'
    });
  } catch (err) {
    console.error('[crm project delete]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to remove project mapping.'
    });
  }
});

module.exports = router;
