const { formatLeadId, normalizeText } = require('./leadNormalization');

/**
 * Gets the next sequential Lead ID for a tenant.
 */
async function getNextLeadId({ CounterModel }, companyCode) {
  const code = String(companyCode || '').trim().toUpperCase();
  const counter = await CounterModel.findOneAndUpdate(
    { companyCode: code, entity: 'lead' },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  return formatLeadId(counter.seq);
}

/**
 * Resolves or generates a Lead ID for a single company.
 * If the company already has a Lead ID in LeadModel or ClientModel, returns the existing Lead ID.
 * Otherwise, atomically increments the tenant's 'lead' Counter and returns a new Lead ID.
 */
async function getLeadIdForCompany({ LeadModel, ClientModel, CounterModel }, companyCode, leadCompanyName) {
  const code = String(companyCode || '').trim().toUpperCase();
  const normName = normalizeText(leadCompanyName);

  if (!normName) {
    return getNextLeadId({ CounterModel }, code);
  }

  // 1. Check existing leads for this company
  if (LeadModel) {
    const existingLead = await LeadModel.findOne(
      { companyCode: code, leadCompanyNameLower: normName, leadId: { $ne: '', $exists: true } },
      'leadId'
    ).lean();
    if (existingLead && existingLead.leadId) {
      return existingLead.leadId;
    }
  }

  // 2. Check existing clients for this company
  if (ClientModel) {
    const existingClient = await ClientModel.findOne(
      { companyCode: code, normalizedCompanyName: normName, leadId: { $ne: '', $exists: true } },
      'leadId'
    ).lean();
    if (existingClient && existingClient.leadId) {
      return existingClient.leadId;
    }
  }

  // 3. Generate new Lead ID for new company
  return getNextLeadId({ CounterModel }, code);
}

/**
 * Allocates Lead IDs for a batch of leads during Excel bulk import.
 * Maps every distinct company to an existing Lead ID or allocates new sequential Lead IDs in bulk.
 */
async function allocateLeadIdsForBatch({ LeadModel, ClientModel, CounterModel }, companyCode, leads = []) {
  const code = String(companyCode || '').trim().toUpperCase();
  const companyMap = new Map(); // normalizedCompanyName -> leadId
  const distinctCompanies = new Set();

  leads.forEach((l) => {
    const norm = normalizeText(l.leadCompanyName || l.leadCompanyNameLower || l.companyName);
    if (norm) {
      if (l.leadId) {
        companyMap.set(norm, l.leadId);
      }
      distinctCompanies.add(norm);
    }
  });

  const companyList = Array.from(distinctCompanies);
  if (companyList.length === 0) return companyMap;

  // 1. Find existing Lead IDs from DB
  if (LeadModel) {
    const existingLeads = await LeadModel.find(
      { companyCode: code, leadCompanyNameLower: { $in: companyList }, leadId: { $ne: '', $exists: true } },
      'leadCompanyNameLower leadId'
    ).lean();

    existingLeads.forEach((item) => {
      if (item.leadCompanyNameLower && item.leadId && !companyMap.has(item.leadCompanyNameLower)) {
        companyMap.set(item.leadCompanyNameLower, item.leadId);
      }
    });
  }

  if (ClientModel) {
    const existingClients = await ClientModel.find(
      { companyCode: code, normalizedCompanyName: { $in: companyList }, leadId: { $ne: '', $exists: true } },
      'normalizedCompanyName leadId'
    ).lean();

    existingClients.forEach((item) => {
      if (item.normalizedCompanyName && item.leadId && !companyMap.has(item.normalizedCompanyName)) {
        companyMap.set(item.normalizedCompanyName, item.leadId);
      }
    });
  }

  // 2. Identify companies needing new Lead IDs
  const unassigned = companyList.filter((norm) => !companyMap.has(norm));
  if (unassigned.length > 0) {
    const counter = await CounterModel.findOneAndUpdate(
      { companyCode: code, entity: 'lead' },
      { $inc: { seq: unassigned.length } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    const startSeq = counter.seq - unassigned.length + 1;
    unassigned.forEach((norm, idx) => {
      companyMap.set(norm, formatLeadId(startSeq + idx));
    });
  }

  return companyMap;
}

module.exports = {
  allocateLeadIdsForBatch,
  getLeadIdForCompany,
  getNextLeadId,
};
