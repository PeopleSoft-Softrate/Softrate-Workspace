const mongoose = require('mongoose');
const Client = require('../models/Client');
const Counter = require('../models/Counter');
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
    gstNumber: source.gstNumber || '',
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
  let email = stringValue(lead.directorEmailAddress);
  if (email) {
    const parts = email.split(/[\s,;/]+/).map(p => p.trim()).filter(Boolean);
    email = parts.find(p => p.includes('@')) || parts[0] || '';
  }

  return {
    companyCode: stringValue(lead.companyCode),
    companyName: stringValue(lead.leadCompanyName),
    primaryContactName: stringValue(lead.contactName),
    primaryPhone: stringValue(lead.contactNumber),
    primaryEmail: email,
    description: stringValue(lead.mainDivisionDescription || lead.companyDescription),
    source: 'converted_lead',
    sourceLeadIds: [lead._id],
    assignedEmployeePhones: [lead.assignedEmployeePhone],
    onboardedByRole: 'system',
  };
}

async function getNextSequence({ CounterModel }, companyCode, entity) {
  const counter = await CounterModel.findOneAndUpdate(
    { companyCode, entity },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  return counter.seq;
}

async function nextClientId({ CounterModel }, companyCode) {
  const seq = await getNextSequence({ CounterModel }, companyCode, 'client');
  return `CL${999 + seq}`;
}

async function createClientPayload({ ClientModel, CounterModel }, payload, options = {}) {
  const companyCode = stringValue(payload.companyCode);
  const companyName = stringValue(payload.companyName || payload.leadCompanyName);
  if (!companyCode || !companyName) {
    const error = new Error('companyCode and companyName are required.');
    error.statusCode = 400;
    throw error;
  }

  const normalizedCompanyName = normalizeText(companyName);
  const existing = await ClientModel.findOne({ companyCode, normalizedCompanyName });
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
      const merged = await ClientModel.findByIdAndUpdate(existing._id, update, { new: true });
      return { client: merged, created: false, duplicate: true };
    }

    const error = new Error('Client already exists for this company.');
    error.statusCode = 409;
    error.client = mapClient(existing);
    throw error;
  }

  let client;
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      client = await ClientModel.create({
        companyCode,
        clientId: await nextClientId({ CounterModel }, companyCode),
        companyName,
        primaryContactName: stringValue(payload.primaryContactName || payload.contactName),
        primaryPhone: stringValue(payload.primaryPhone || payload.contactNumber || payload.phone),
        primaryEmail: stringValue(payload.primaryEmail || payload.email),
        address: stringValue(payload.address),
        description: stringValue(payload.description),
        gstNumber: stringValue(payload.gstNumber).toUpperCase(),
        source: payload.source === 'converted_lead' ? 'converted_lead' : 'manual',
        sourceLeadIds: (payload.sourceLeadIds || []).filter(Boolean),
        assignedEmployeePhones: compact(payload.assignedEmployeePhones || [payload.employeePhone]),
        onboardedByRole: ['employee', 'admin', 'system'].includes(payload.onboardedByRole) ? payload.onboardedByRole : 'system',
        onboardedByName: stringValue(payload.onboardedByName),
        onboardedByPhone: stringValue(payload.onboardedByPhone || payload.employeePhone),
      });
      break;
    } catch (err) {
      if (err.code === 11000 && err.message.includes('clientId')) {
        if (attempt === 9) throw err;
        continue;
      }
      throw err;
    }
  }

  return { client, created: true, duplicate: false };
}

async function ensureClientForLead({ ClientModel, LeadModel, CounterModel }, leadOrId) {
  const lead = typeof leadOrId === 'string' || leadOrId instanceof mongoose.Types.ObjectId
    ? await LeadModel.findById(leadOrId)
    : leadOrId;
  if (!lead || !(await isConvertedStatus(lead.companyCode, lead.status))) return null;
  const result = await createClientPayload({ ClientModel, CounterModel }, clientPayloadFromLead(lead), { mergeIfExists: true });

  // Notify WE-CRM so it can add the entity to the client's account
  const targetCompanyCode = process.env.WE_CRM_ACCESS;
  if (result.client && targetCompanyCode && lead.companyCode === targetCompanyCode) {
    notifyWeCrm({
      companyId: process.env.WE_CRM_COMPANYID,
      companyName: stringValue(result.client.companyName),
      ownerName: stringValue(result.client.primaryContactName),
      phone: stringValue(result.client.primaryPhone),
      email: stringValue(result.client.primaryEmail),
      address: stringValue(result.client.address),
      businessType: '',
      serviceName: 'Entity Onboarding',
      dealvoiceClientId: String(result.client._id || ''),
      softrateClientId: String(result.client.clientId || ''),
      // Pass the new entity company name so WE-CRM can add it to client_entities
      entityName: stringValue(lead.leadCompanyName),
    }).catch(err => console.error('[WE-CRM intake ensureClientForLead] webhook failed:', err.message));
  }

  return result.client;
}

async function createManualClient({ ClientModel, LeadModel, CounterModel }, payload = {}) {
  let sourceLead = null;
  const sourceLeadId = stringValue(payload.sourceLeadId || payload.leadId);
  if (sourceLeadId && mongoose.Types.ObjectId.isValid(sourceLeadId)) {
    sourceLead = await LeadModel.findOne({
      _id: sourceLeadId,
      companyCode: stringValue(payload.companyCode),
      isArchived: { $ne: true },
    });
  }

  let email = payload.primaryEmail || payload.email || sourceLead?.directorEmailAddress || '';
  if (email) {
    const parts = String(email).split(/[\s,;/]+/).map(p => p.trim()).filter(Boolean);
    email = parts.find(p => p.includes('@')) || parts[0] || '';
  }

  const result = await createClientPayload({ ClientModel, CounterModel }, {
    companyCode: payload.companyCode,
    companyName: payload.companyName || sourceLead?.leadCompanyName,
    primaryContactName: payload.primaryContactName || payload.contactName || sourceLead?.contactName,
    primaryPhone: payload.primaryPhone || payload.contactNumber || sourceLead?.contactNumber,
    primaryEmail: email,
    address: payload.address,
    gstNumber: payload.gstNumber,
    description: payload.description || sourceLead?.mainDivisionDescription || sourceLead?.companyDescription,
    source: sourceLead ? 'converted_lead' : 'manual',
    sourceLeadIds: sourceLead ? [sourceLead._id] : [],
    assignedEmployeePhones: compact([payload.employeePhone, sourceLead?.assignedEmployeePhone]),
    onboardedByRole: payload.createdByRole || payload.onboardedByRole || 'employee',
    onboardedByName: payload.createdByName || payload.onboardedByName,
    onboardedByPhone: payload.createdByPhone || payload.onboardedByPhone || payload.employeePhone,
  });

  // ── Notify WE-CRM via intake webhook if configured ───────────
  const targetCompanyCode = process.env.WE_CRM_ACCESS;
  if (result.client && payload.serviceName && targetCompanyCode && payload.companyCode === targetCompanyCode) {
    notifyWeCrm({
      companyId: process.env.WE_CRM_COMPANYID,
      companyName: stringValue(result.client.companyName),
      ownerName: stringValue(result.client.primaryContactName),
      phone: stringValue(result.client.primaryPhone),
      email: stringValue(result.client.primaryEmail),
      address: stringValue(payload.address),
      businessType: '',
      serviceName: payload.serviceName,
      dealvoiceClientId: String(result.client._id || ''),
      softrateClientId: String(result.client.clientId || ''),
    }).catch(err => console.error('[WE-CRM intake] webhook failed:', err.message));
  }

  return result;
}

async function notifyWeCrm(data) {
  const weCrmUrl = process.env.WE_CRM_URL;
  const weCrmAccess = process.env.WE_CRM_ACCESS;
  if (!weCrmUrl || !weCrmAccess) return;

  const body = JSON.stringify(data);
  const urlObj = new URL(`${weCrmUrl}/intake/onboard`);
  const isHttps = urlObj.protocol === 'https:';
  const lib = isHttps ? require('https') : require('http');

  return new Promise((resolve, reject) => {
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'authorization': weCrmAccess
      }
    };

    const req = lib.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          console.log('[WE-CRM intake] success:', json.message);
        } catch (e) {}
        resolve(res.statusCode);
      });
    });

    req.on('error', (err) => {
      console.error('[WE-CRM intake] request error:', err.message);
      reject(err);
    });

    req.write(body);
    req.end();
  });
}

async function listClients({ ClientModel }, query = {}) {
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
    ClientModel.countDocuments(filter),
    ClientModel.find(filter)
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

async function updateClient({ ClientModel }, clientId, payload = {}) {
  const id = stringValue(clientId);
  const companyCode = stringValue(payload.companyCode);
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    const error = new Error('Valid client ID is required.');
    error.statusCode = 400;
    throw error;
  }
  if (!companyCode) {
    const error = new Error('companyCode is required.');
    error.statusCode = 400;
    throw error;
  }

  const filter = { _id: id, status: { $ne: 'Inactive' } };
  if (companyCode) filter.companyCode = companyCode;

  let client = await ClientModel.findOne(filter);
  if (!client && companyCode) {
    delete filter.companyCode;
    client = await ClientModel.findOne(filter);
  }
  if (!client) {
    const error = new Error('Client not found.');
    error.statusCode = 404;
    throw error;
  }

  if (payload.companyName !== undefined) {
    const companyName = stringValue(payload.companyName);
    if (!companyName) {
      const error = new Error('Company name is required.');
      error.statusCode = 400;
      throw error;
    }
    const normalizedCompanyName = normalizeText(companyName);
    const duplicate = await ClientModel.findOne({
      _id: { $ne: client._id },
      companyCode,
      normalizedCompanyName,
    }).select('_id companyName').lean();
    if (duplicate) {
      const error = new Error('Client already exists for this company.');
      error.statusCode = 409;
      throw error;
    }
    client.companyName = companyName;
  }

  if (payload.primaryContactName !== undefined) client.primaryContactName = stringValue(payload.primaryContactName);
  if (payload.primaryPhone !== undefined) client.primaryPhone = stringValue(payload.primaryPhone);
  if (payload.primaryEmail !== undefined) client.primaryEmail = stringValue(payload.primaryEmail).toLowerCase();
  if (payload.address !== undefined) client.address = stringValue(payload.address);
  if (payload.gstNumber !== undefined) client.gstNumber = stringValue(payload.gstNumber).toUpperCase();
  if (payload.description !== undefined) client.description = stringValue(payload.description);

  await client.save();
  return client;
}

async function getClientByClientId({ ClientModel }, companyCode, clientId) {
  if (!companyCode || !clientId) return null;
  return ClientModel.findOne({ companyCode: stringValue(companyCode), clientId: stringValue(clientId) });
}

module.exports = {
  mapClient,
  isConvertedStatus,
  ensureClientForLead,
  createManualClient,
  listClients,
  updateClient,
  getClientByClientId,
};
