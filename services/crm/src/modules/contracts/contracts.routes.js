
const express = require('express');
const { tenantMiddleware } = require('../../common/tenantMiddleware');
const router = express.Router();
router.use(tenantMiddleware);
const { NDA_PLACEHOLDERS, createDefaultNdaTemplate, normalizeTemplate } = require('./ndaTemplate');
const { generateDynamicNdaPDF } = require('./ndaPdfGenerator');
const { generateSlaPDF } = require('./slaPdfGenerator');

function scopedCompany(req) {
  return String(req.query.companyCode || req.body?.companyCode || req.crmUser?.companyCode || '').trim();
}

router.get('/nda-template', async (req, res) => {
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
    const saved = await CrmDocumentTemplate.findOne({
      companyCode,
      type: 'NDA'
    }).lean();
    return res.json({
      success: true,
      ndaTemplate: normalizeStoredNdaTemplate(saved?.template),
      placeholders: NDA_PLACEHOLDERS,
      updatedAt: saved?.updatedAt || null
    });
  } catch (err) {
    console.error('[crm nda template]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to load NDA template.'
    });
  }
});

router.put('/nda-template', async (req, res) => {
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
    const ndaTemplate = normalizeTemplate(req.body?.ndaTemplate || req.body?.template || {});
    const saved = await CrmDocumentTemplate.findOneAndUpdate({
      companyCode,
      type: 'NDA'
    }, {
      $set: {
        companyCode,
        type: 'NDA',
        name: ndaTemplate.name || 'NDA Format Sample',
        template: ndaTemplate,
        updatedBy: req.crmUser?.email || ''
      }
    }, {
      new: true,
      upsert: true,
      runValidators: true,
      setDefaultsOnInsert: true
    }).lean();
    return res.json({
      success: true,
      message: 'NDA template saved successfully.',
      ndaTemplate: normalizeTemplate(saved.template)
    });
  } catch (err) {
    console.error('[crm nda template save]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to save NDA template.'
    });
  }
});

router.post('/nda/preview', async (req, res) => {
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
    const clientCompanyName = stringValue(req.body.clientCompanyName) || 'Client Company Name';
    const template = normalizeTemplate(req.body?.ndaTemplate || (await loadNdaTemplate(scopedCompany(req))));
    const data = await buildNdaDocData(req, clientCompanyName);
    const buffer = await generateDynamicNdaPDF(data, template);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="NDA-Preview.pdf"');
    return res.send(buffer);
  } catch (err) {
    console.error('[crm nda preview]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to preview NDA.'
    });
  }
});

router.get('/contracts', async (req, res) => {
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
    const query = {};
    if (companyCode) query.companyCode = companyCode;
    if (req.query.type) query.type = String(req.query.type).toUpperCase();
    if (req.query.clientCompanyName) query.clientCompanyName = req.query.clientCompanyName;
    const contracts = await CrmContract.find(query).select('-pdfBase64 -templateSnapshot').sort({
      createdAt: -1
    }).lean();
    return res.json({
      success: true,
      contracts: contracts.map(contractResponse)
    });
  } catch (err) {
    console.error('[crm contracts]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to load contract history.'
    });
  }
});

router.get('/contracts/:id/pdf', async (req, res) => {
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
    const contract = await CrmContract.findOne(query).select('+pdfBase64').lean();
    if (!contract || !contract.pdfBase64) {
      return res.status(404).json({
        success: false,
        message: 'PDF not found for this contract.'
      });
    }
    const buffer = Buffer.from(contract.pdfBase64, 'base64');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${contract.pdfFileName || `${contract.documentNumber}.pdf`}"`);
    return res.send(buffer);
  } catch (err) {
    console.error('[crm contract pdf]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to load contract PDF.'
    });
  }
});

router.post('/contracts/generate', async (req, res) => {
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
    const type = String(req.body?.type || '').toUpperCase();
    if (!['SLA', 'NDA'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Contract type must be SLA or NDA.'
      });
    }
    if (!req.body?.clientCompanyName) {
      return res.status(400).json({
        success: false,
        message: 'Client company is required.'
      });
    }
    const clientCompanyName = String(req.body.clientCompanyName).trim();
    const documentNumber = makeDocumentNumber(type);
    let pdfBuffer = null;
    let pdfFileName = '';
    let templateSnapshot;
    let content = req.body.content || `${type} generated for ${clientCompanyName}.`;
    if (type === 'NDA') {
      templateSnapshot = req.body?.ndaTemplate ? normalizeTemplate(req.body.ndaTemplate) : await loadNdaTemplate(scopedCompany(req));
      const docData = await buildNdaDocData(req, clientCompanyName);
      pdfBuffer = await generateDynamicNdaPDF(docData, templateSnapshot);
      pdfFileName = `${documentNumber}-${clientCompanyName.replace(/[^a-z0-9]+/gi, '-')}.pdf`;
      content = `NDA generated for ${clientCompanyName} using ${templateSnapshot.name || 'NDA Format Sample'}.`;
    } else if (type === 'SLA') {
      const companyCode = scopedCompany(req);
      const [company, client] = await Promise.all([companyCode ? User.findOne({
        companyCode
      }).lean() : null, companyCode && clientCompanyName ? Client.findOne({
        companyCode,
        companyName: clientCompanyName
      }).lean() : null]);
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
        clientSignatoryTitle: 'Authorized Signatory'
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
      templateSnapshot
    });
    return res.status(201).json({
      success: true,
      contract: contractResponse(contract)
    });
  } catch (err) {
    console.error('[crm contract generate]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate contract.'
    });
  }
});

module.exports = router;
