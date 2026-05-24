const mongoose = require('mongoose');
const Client = require('../models/Client');
const Lead = require('../models/Lead');
const User = require('../models/User');
const { normalizeText } = require('./leadNormalization');

function stringValue(value) {
  return String(value || '').trim();
}

function escapeRegex(value) {
  return stringValue(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function compact(values = []) {
  return values.map((value) => stringValue(value)).filter(Boolean);
}

function mapClient(client = {}) {
  const source = typeof client.toObject === 'function' ? client.toObject() : client;
  return {
    _id: String(source._id || ''),
    id: String(source._id || ''),
    companyCode: source.companyCode || '',
    clientId: source.clientId || '',
    companyName: source.companyName || '',
    leadCompanyName: source.companyName || '',
    primaryContact: source.primaryContactName || 'Primary Contact',
    primaryContactName: source.primaryContactName || '',
    primaryPhone: source.primaryPhone || '',
    primaryEmail: source.primaryEmail || '',
    address: source.address || '',
    description: source.description || '',
    status: source.status || 'Onboarded',
    source: source.source || 'manual',
    sourceLeadIds: (source.sourceLeadIds || []).map((id) => String(id || '')).filter(Boolean),
    assignedEmployeePhones: source.assignedEmployeePhones || [],
    managers: source.assignedEmployeePhones || [],
    contactCount: source.primaryPhone || source.primaryEmail || source.primaryContactName ? 1 : 0,
    latestUpdate: source.updatedAt || source.createdAt || '',
    onboardedAt: source.onboardedAt || source.createdAt || '',
    createdAt: source.createdAt || '',
    updatedAt: source.updatedAt || '',
  };
}

async function convertedStatusesFor(companyCode) {
  if (!companyCode) return ['Converted'];
  const user = await User.findOne({ companyCode }).select('convertedPageStatuses').lean();
  const statuses = compact(user?.convertedPageStatuses || []);
  return statuses.length ? statuses : ['Converted'];
}

async function isConvertedStatus(companyCode, status) {
  const normalized = stringValue(status).toLowerCase();
  if (!normalized) return false;
  const statuses = await convertedStatusesFor(companyCode);
  return statuses.map((item) => item.toLowerCase()).includes(normalized) || normalized.includes('convert');
}

function clientPayloadFromLead(lead) {
  return {
    companyCode: stringValue(lead.companyCode),
    companyName: stringValue(lead.leadCompanyName),
    primaryContactName: stringValue(lead.contactName),
    primaryPhone: stringValue(lead.contactNumber),
    primaryEmail: stringValue(lead.directorEmailAddress),
    description: stringValue(lead.mainDivisionDescription || lead.companyDescription),
    source: 'converted_lead',
    sourceLeadIds: [lead._id],
    assignedEmployeePhones: [lead.assignedEmployeePhone],
    onboardedByRole: 'system',
  };
}

async function nextClientId(companyCode, date = new Date()) {
  const yy = String(date.getFullYear()).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const prefix = `CL-${yy}${mm}-`;
  const latest = await Client.findOne({
    companyCode,
    clientId: new RegExp(`^${escapeRegex(prefix)}\\d{4}$`),
  }).sort({ clientId: -1 }).select('clientId').lean();
  const nextSequence = Number(String(latest?.clientId || '').slice(-4) || 0) + 1;
  return `${prefix}${String(nextSequence).padStart(4, '0')}`;
}

async function createClientPayload(payload, options = {}) {
  const companyCode = stringValue(payload.companyCode);
  const companyName = stringValue(payload.companyName || payload.leadCompanyName);
  if (!companyCode || !companyName) {
    const error = new Error('companyCode and companyName are required.');
    error.statusCode = 400;
    throw error;
  }

  const normalizedCompanyName = normalizeText(companyName);
  const existing = await Client.findOne({ companyCode, normalizedCompanyName });
  if (existing) {
    if (options.mergeIfExists) {
      const addToSet = {};
      const sourceLeadIds = (payload.sourceLeadIds || []).filter(Boolean);
      const assignedEmployeePhones = compact(payload.assignedEmployeePhones || []);
      if (sourceLeadIds.length) addToSet.sourceLeadIds = { $each: sourceLeadIds };
      if (assignedEmployeePhones.length) addToSet.assignedEmployeePhones = { $each: assignedEmployeePhones };

      const update = {
        $set: {
          primaryContactName: existing.primaryContactName || stringValue(payload.primaryContactName),
          primaryPhone: existing.primaryPhone || stringValue(payload.primaryPhone),
          primaryEmail: existing.primaryEmail || stringValue(payload.primaryEmail),
          address: existing.address || stringValue(payload.address),
          description: existing.description || stringValue(payload.description),
          status: 'Onboarded',
        },
      };
      if (Object.keys(addToSet).length) update.$addToSet = addToSet;
      const merged = await Client.findByIdAndUpdate(existing._id, update, { new: true });
      return { client: merged, created: false, duplicate: true };
    }

    const error = new Error('Client already exists for this company.');
    error.statusCode = 409;
    error.client = mapClient(existing);
    throw error;
  }

  const client = await Client.create({
    companyCode,
    clientId: await nextClientId(companyCode),
    companyName,
    primaryContactName: stringValue(payload.primaryContactName || payload.contactName),
    primaryPhone: stringValue(payload.primaryPhone || payload.contactNumber || payload.phone),
    primaryEmail: stringValue(payload.primaryEmail || payload.email),
    address: stringValue(payload.address),
    description: stringValue(payload.description),
    source: payload.source === 'converted_lead' ? 'converted_lead' : 'manual',
    sourceLeadIds: (payload.sourceLeadIds || []).filter(Boolean),
    assignedEmployeePhones: compact(payload.assignedEmployeePhones || [payload.employeePhone]),
    onboardedByRole: ['employee', 'admin', 'system'].includes(payload.onboardedByRole) ? payload.onboardedByRole : 'system',
    onboardedByName: stringValue(payload.onboardedByName),
    onboardedByPhone: stringValue(payload.onboardedByPhone || payload.employeePhone),
  });

  return { client, created: true, duplicate: false };
}

async function ensureClientForLead(leadOrId) {
  const lead = typeof leadOrId === 'string' || leadOrId instanceof mongoose.Types.ObjectId
    ? await Lead.findById(leadOrId)
    : leadOrId;
  if (!lead || !(await isConvertedStatus(lead.companyCode, lead.status))) return null;
  const result = await createClientPayload(clientPayloadFromLead(lead), { mergeIfExists: true });
  return result.client;
}

async function createManualClient(payload = {}) {
  let sourceLead = null;
  const sourceLeadId = stringValue(payload.sourceLeadId || payload.leadId);
  if (sourceLeadId && mongoose.Types.ObjectId.isValid(sourceLeadId)) {
    sourceLead = await Lead.findOne({
      _id: sourceLeadId,
      companyCode: stringValue(payload.companyCode),
      isArchived: { $ne: true },
    });
  }

  const result = await createClientPayload({
    companyCode: payload.companyCode,
    companyName: payload.companyName || sourceLead?.leadCompanyName,
    primaryContactName: payload.primaryContactName || payload.contactName || sourceLead?.contactName,
    primaryPhone: payload.primaryPhone || payload.contactNumber || sourceLead?.contactNumber,
    primaryEmail: payload.primaryEmail || payload.email || sourceLead?.directorEmailAddress,
    address: payload.address,
    description: payload.description || sourceLead?.mainDivisionDescription || sourceLead?.companyDescription,
    source: sourceLead ? 'converted_lead' : 'manual',
    sourceLeadIds: sourceLead ? [sourceLead._id] : [],
    assignedEmployeePhones: compact([payload.employeePhone, sourceLead?.assignedEmployeePhone]),
    onboardedByRole: payload.createdByRole || payload.onboardedByRole || 'employee',
    onboardedByName: payload.createdByName || payload.onboardedByName,
    onboardedByPhone: payload.createdByPhone || payload.onboardedByPhone || payload.employeePhone,
  });

  return result;
}

async function listClients(query = {}) {
  const companyCode = stringValue(query.companyCode);
  if (!companyCode) {
    const error = new Error('companyCode is required.');
    error.statusCode = 400;
    throw error;
  }

  const page = Math.max(1, Number.parseInt(String(query.page || 1), 10) || 1);
  const pageSize = Math.min(200, Math.max(1, Number.parseInt(String(query.pageSize || 50), 10) || 50));
  const filter = { companyCode, status: { $ne: 'Inactive' } };
  const employeePhone = stringValue(query.employeePhone || query.phone);
  if (employeePhone) filter.assignedEmployeePhones = employeePhone;

  const search = stringValue(query.search);
  if (search) {
    const regex = new RegExp(escapeRegex(search), 'i');
    filter.$or = [
      { clientId: regex },
      { companyName: regex },
      { primaryContactName: regex },
      { primaryPhone: regex },
      { primaryEmail: regex },
    ];
  }

  const [total, clients] = await Promise.all([
    Client.countDocuments(filter),
    Client.find(filter)
      .sort({ updatedAt: -1, createdAt: -1, clientId: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
  ]);

  const items = clients.map(mapClient);
  return {
    success: true,
    clients: items,
    items,
    page,
    pageSize,
    total,
    hasMore: page * pageSize < total,
  };
}

async function getClientByClientId(companyCode, clientId) {
  if (!companyCode || !clientId) return null;
  return Client.findOne({ companyCode: stringValue(companyCode), clientId: stringValue(clientId) });
}

module.exports = {
  mapClient,
  isConvertedStatus,
  ensureClientForLead,
  createManualClient,
  listClients,
  getClientByClientId,
};
