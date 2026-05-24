const Client = require('../models/Client');
const CrmContract = require('../models/CrmContract');
const CrmAmc = require('../models/CrmAmc');
const { lifecycleStatusFor } = require('./amcService');

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function compact(values) {
  return values.map((value) => String(value || '').trim()).filter(Boolean);
}

function buildDateLabel(value) {
  if (!value) return '';
  return new Date(value).toISOString();
}

function contractStatusFor(contracts, type, clientName) {
  const normalizedName = String(clientName || '').toLowerCase();
  const record = contracts.find((item) => (
    item.type === type &&
    String(item.clientCompanyName || '').toLowerCase() === normalizedName
  ));
  return record?.status || 'Not Generated';
}

function amcStatusFor(amcRecords, client) {
  const clientId = String(client.clientId || '').trim();
  const normalizedName = String(client.companyName || '').toLowerCase();
  const record = amcRecords.find((item) => (
    (clientId && String(item.clientId || '').trim() === clientId) ||
    String(item.clientCompanyName || '').toLowerCase() === normalizedName
  ));
  return lifecycleStatusFor(record);
}

function contactFromClient(client) {
  const hasContact = client.primaryContactName || client.primaryPhone || client.primaryEmail;
  if (!hasContact) return [];
  return [{
    _id: String(client._id || ''),
    companyCode: client.companyCode || '',
    assignedEmployeePhone: client.assignedEmployeePhones?.[0] || '',
    leadCompanyName: client.companyName || '',
    contactName: client.primaryContactName || 'Primary Contact',
    contactNumber: client.primaryPhone || '',
    status: client.status || 'Onboarded',
    setLabel: '',
    companyDescription: client.description || '',
    mainDivisionDescription: client.description || '',
    directorEmailAddress: client.primaryEmail || '',
    remarks: [],
    isStarred: false,
    isFavourite: false,
    createdAt: buildDateLabel(client.createdAt),
    updatedAt: buildDateLabel(client.updatedAt),
  }];
}

async function getConvertedClients({ companyCode = '', search = '' } = {}) {
  const filter = { status: { $ne: 'Inactive' } };
  if (companyCode) filter.companyCode = companyCode;

  const searchValue = String(search || '').trim();
  if (searchValue) {
    const regex = new RegExp(escapeRegex(searchValue), 'i');
    filter.$or = [
      { clientId: regex },
      { companyName: regex },
      { primaryContactName: regex },
      { primaryPhone: regex },
      { primaryEmail: regex },
      { assignedEmployeePhones: regex },
    ];
  }

  const [clients, contracts, amcRecords] = await Promise.all([
    Client.find(filter).sort({ updatedAt: -1, createdAt: -1, clientId: -1 }).lean(),
    CrmContract.find(companyCode ? { companyCode } : {}).sort({ createdAt: -1 }).lean(),
    CrmAmc.find(companyCode ? { companyCode } : {}).lean(),
  ]);

  return clients.map((client) => {
    const contacts = contactFromClient(client);
    const managers = Array.from(new Set(compact(client.assignedEmployeePhones || [])));
    const latest = buildDateLabel(client.updatedAt || client.createdAt);

    return {
      id: client.clientId || String(client._id || ''),
      _id: String(client._id || ''),
      companyCode: client.companyCode || '',
      clientId: client.clientId || '',
      leadCompanyName: client.companyName || '',
      companyName: client.companyName || '',
      primaryContact: client.primaryContactName || 'Primary Contact',
      primaryContactName: client.primaryContactName || '',
      primaryPhone: client.primaryPhone || '',
      primaryEmail: client.primaryEmail || '',
      address: client.address || '',
      description: client.description || '',
      status: client.status || 'Onboarded',
      source: client.source || 'manual',
      contacts,
      contactCount: contacts.length,
      managers,
      remarks: [],
      latestUpdate: latest,
      onboardedAt: buildDateLabel(client.onboardedAt || client.createdAt),
      sourceLeadIds: (client.sourceLeadIds || []).map((id) => String(id || '')).filter(Boolean),
      slaStatus: contractStatusFor(contracts, 'SLA', client.companyName),
      ndaStatus: contractStatusFor(contracts, 'NDA', client.companyName),
      amcStatus: amcStatusFor(amcRecords, client),
    };
  });
}

module.exports = {
  getConvertedClients,
};
