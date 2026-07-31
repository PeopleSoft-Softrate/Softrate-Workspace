
const express = require('express');
const { tenantMiddleware } = require('../../common/tenantMiddleware');
const router = express.Router();
router.use(tenantMiddleware);
const { fetchHostingerDomains } = require('./hostingerService');
const { addYears, clientSuggestionsForDomain, lifecycleStatusFor, nextAnnualRenewalDate, normalizeDomainName, serializeAmcRecord } = require('./amcService');

function scopedCompany(req) {
  return String(req.query.companyCode || req.body?.companyCode || req.crmUser?.companyCode || '').trim();
}

router.get('/amc/hostinger/domains', async (req, res) => {
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
    const [clients, records] = await Promise.all([getConvertedClients({
      Client,
      CrmContract,
      CrmAmc,
      companyCode,
      search: req.query.search
    }), CrmAmc.find(companyCode ? {
      companyCode
    } : {}).lean()]);
    const domains = await fetchHostingerDomains({
      includeDetails: true
    });
    const recordsByDomain = new Map(records.map(record => [normalizeDomainName(record.domainName), record]));
    return res.json({
      success: true,
      domains: domains.map(domain => {
        const existing = recordsByDomain.get(domain.domainName);
        const suggestions = clientSuggestionsForDomain(domain.domainName, clients);
        return {
          ...domain,
          existingMapping: existing ? serializeAmcRecord(existing) : null,
          suggestions
        };
      })
    });
  } catch (err) {
    console.error('[crm amc hostinger domains]', err);
    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.statusCode === 503 ? err.message : 'Failed to fetch Hostinger domains.'
    });
  }
});

router.post('/amc/hostinger/import', async (req, res) => {
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
    const mappings = Array.isArray(req.body?.mappings) ? req.body.mappings : [];
    const mappingByDomain = new Map(mappings.map(item => [normalizeDomainName(item.domainName), item]));
    const autoMap = req.body?.autoMap !== false;
    const [clients, domains] = await Promise.all([getConvertedClients({
      Client,
      CrmContract,
      CrmAmc,
      companyCode
    }), fetchHostingerDomains({
      includeDetails: true
    })]);
    const imported = [];
    const unmapped = [];
    for (const domain of domains) {
      const explicitMapping = mappingByDomain.get(domain.domainName);
      const suggestions = clientSuggestionsForDomain(domain.domainName, clients);
      const suggestedClient = suggestions[0]?.score >= 85 ? suggestions[0] : null;
      const mappedClientId = String(explicitMapping?.clientId || (autoMap ? suggestedClient?.clientId : '') || '').trim();
      const fallbackCompanyName = String(explicitMapping?.clientCompanyName || (autoMap ? suggestedClient?.clientCompanyName : '') || '').trim();
      if (!mappedClientId && !fallbackCompanyName) {
        unmapped.push({
          ...domain,
          suggestions
        });
        continue;
      }
      const mappedClient = clients.find(client => mappedClientId && client.clientId === mappedClientId || !mappedClientId && client.companyName === fallbackCompanyName);
      if (!mappedClient?.clientId) {
        unmapped.push({
          ...domain,
          suggestions
        });
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
        source: 'hostinger'
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
      message: `${imported.length} Hostinger domain${imported.length === 1 ? '' : 's'} imported. ${unmapped.length} left unmapped.`
    });
  } catch (err) {
    console.error('[crm amc hostinger import]', err);
    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.statusCode === 503 ? err.message : 'Failed to import Hostinger domains.'
    });
  }
});

router.get('/amc', async (req, res) => {
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
      domainName: {
        $exists: true,
        $nin: ['', null]
      }
    };
    if (companyCode) query.companyCode = companyCode;
    const searchValue = String(req.query.search || '').trim().toLowerCase();
    const [clients, records] = await Promise.all([getConvertedClients({
      Client,
      CrmContract,
      CrmAmc,
      companyCode
    }), CrmAmc.find(query).sort({
      renewalDate: 1,
      updatedAt: -1
    }).lean()]);
    const clientsById = new Map(clients.map(client => [String(client.clientId || '').trim(), client]).filter(([clientId]) => !!clientId));
    const clientsByName = new Map(clients.map(client => [String(client.companyName || '').toLowerCase(), client]));
    const allRows = records.filter(record => record.clientId && clientsById.has(String(record.clientId || '').trim()) || clientsByName.has(String(record.clientCompanyName || '').toLowerCase())).map(record => {
      const client = clientsById.get(String(record.clientId || '').trim()) || clientsByName.get(String(record.clientCompanyName || '').toLowerCase());
      return serializeAmcRecord({
        ...record,
        clientId: client?.clientId || record.clientId,
        clientCompanyName: client?.companyName || record.clientCompanyName,
        companyCode: client?.companyCode || record.companyCode,
        owner: record.owner || client?.managers?.[0] || ''
      });
    }).filter(row => !searchValue || String(row.clientCompanyName || '').toLowerCase().includes(searchValue) || String(row.clientId || '').toLowerCase().includes(searchValue) || String(row.domainName || '').toLowerCase().includes(searchValue) || String(row.owner || '').toLowerCase().includes(searchValue));
    const amc = allRows.filter(row => amcViewFilter(row, req.query.view));
    return res.json({
      success: true,
      amc,
      analytics: amcAnalytics(allRows)
    });
  } catch (err) {
    console.error('[crm amc]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to load AMC tracking.'
    });
  }
});

router.patch('/amc', async (req, res) => {
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
    const record = await saveAmcRecordFromPayload({
      ...req.body,
      companyCode: scopedCompany(req)
    }, req.crmUser);
    return res.json({
      success: true,
      amc: serializeAmcRecord(record)
    });
  } catch (err) {
    console.error('[crm amc update]', err);
    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || 'Failed to update AMC tracking.'
    });
  }
});

router.patch('/amc/:id/status', async (req, res) => {
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
    const record = await CrmAmc.findById(req.params.id);
    if (!record) return res.status(404).json({
      success: false,
      message: 'AMC record not found.'
    });
    const paymentStatus = String(req.body?.paymentStatus || '').trim();
    if (!['Paid', 'Unpaid'].includes(paymentStatus)) {
      return res.status(400).json({
        success: false,
        message: 'paymentStatus must be Paid or Unpaid.'
      });
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
    return res.json({
      success: true,
      amc: serializeAmcRecord(record)
    });
  } catch (err) {
    console.error('[crm amc status]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to update AMC payment status.'
    });
  }
});

router.patch('/amc/:id/block', async (req, res) => {
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
    const record = await CrmAmc.findById(req.params.id);
    if (!record) return res.status(404).json({
      success: false,
      message: 'AMC record not found.'
    });
    if (!serializeAmcRecord(record).canManualBlock) {
      return res.status(400).json({
        success: false,
        message: 'Manual block is available only for unpaid AMC records in the last 3 days before renewal or overdue.'
      });
    }
    record.blocked = true;
    record.blockedAt = new Date();
    record.blockedBy = req.crmUser?.email || '';
    record.blockReason = String(req.body?.reason || 'Manual AMC block').trim();
    record.paymentStatus = 'Unpaid';
    record.status = 'Blocked';
    await record.save();
    return res.json({
      success: true,
      amc: serializeAmcRecord(record)
    });
  } catch (err) {
    console.error('[crm amc block]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to block AMC domain.'
    });
  }
});

router.delete('/amc/:id', async (req, res) => {
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
    const record = await CrmAmc.findOneAndDelete(query).lean();
    if (!record) return res.status(404).json({
      success: false,
      message: 'AMC mapping not found.'
    });
    return res.json({
      success: true,
      message: 'AMC mapping removed.'
    });
  } catch (err) {
    console.error('[crm amc delete]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to remove AMC mapping.'
    });
  }
});

module.exports = router;
