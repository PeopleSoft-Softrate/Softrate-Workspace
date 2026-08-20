const Lead = require('../models/Lead');
const LeadImportBatch = require('../models/LeadImportBatch');
const { logChange } = require('./historyService');
const { invalidateLeadCaches } = require('./leadCache');
const { buildLeadDedupKey, enrichLeadForStorage, normalizeText } = require('./leadNormalization');
const { allocateLeadIdsForBatch } = require('./leadIdService');
const eventBus = require('./eventBus');
const History = require('../models/History');
const { getTenantConnection } = require('../src/common/tenantMiddleware');

const INSERT_CHUNK_SIZE = 1000;

async function createLeadImportBatch({ companyCode, assignedEmployeeId, originalFileName, setLabel, rowCount }) {
  return LeadImportBatch.create({
    companyCode,
    assignedEmployeeId: assignedEmployeeId || null,
    originalFileName: originalFileName || '',
    setLabel: setLabel || '',
    rowCount: rowCount || 0,
    status: 'queued',
  });
}

function prepareLeadDocs(leads, importBatchId, companyMap = new Map()) {
  const dedupe = new Set();
  const docs = [];
  let duplicateCount = 0;
  let errorCount = 0;

  leads.forEach((lead, index) => {
    const norm = normalizeText(lead.leadCompanyName || lead.leadCompanyNameLower);
    const leadId = (companyMap && companyMap.get(norm)) || lead.leadId || '';

    const enriched = enrichLeadForStorage(
      {
        ...lead,
        leadId,
        sheetOrder: Number.isFinite(lead.sheetOrder) ? lead.sheetOrder : index,
      },
      { importBatchId, leadId }
    );

    if (!enriched.companyCode || !enriched.assignedEmployeeId || !enriched.contactNumber || !enriched.leadCompanyName) {
      errorCount += 1;
      return;
    }

    const dedupKey = buildLeadDedupKey(enriched);
    if (dedupe.has(dedupKey)) {
      duplicateCount += 1;
      return;
    }

    dedupe.add(dedupKey);
    docs.push(enriched);
  });

  return { docs, duplicateCount, errorCount };
}

async function insertLeadChunks(docs, TenantLead) {
  let insertedCount = 0;

  for (let index = 0; index < docs.length; index += INSERT_CHUNK_SIZE) {
    const chunk = docs.slice(index, index + INSERT_CHUNK_SIZE);
    const insertedDocs = await TenantLead.insertMany(chunk, { ordered: false });
    insertedCount += insertedDocs.length;
  }

  return insertedCount;
}

async function logBulkImportHistory(docs, TenantHistory) {
  setImmediate(() => {
    docs.forEach((lead) => {
      logChange({
        HistoryModel: TenantHistory,
        companyCode: lead.companyCode,
        contactNumber: lead.contactNumber,
        contactName: lead.contactName,
        companyName: lead.leadCompanyName,
        action: 'Lead Created (Bulk)',
        newValue: lead.status,
        changedBy: lead.assignedEmployeeId || null,
      }).catch((err) => {
        console.error('[history bulk error]:', err);
      });
    });
  });
}

async function processLeadImportBatch(batchId, leads) {
  const batch = await LeadImportBatch.findById(batchId);
  if (!batch) {
    throw new Error('Lead import batch not found.');
  }

  batch.status = 'processing';
  batch.startedAt = new Date();
  await batch.save();

  try {
    const dbName = `salesdb_${batch.companyCode.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    const db = getTenantConnection(dbName);
    const TenantLead = db.model('Lead');
    const TenantHistory = db.model('History');
    const TenantCounter = db.model('Counter');
    const TenantClient = db.model('Client');

    const companyMap = await allocateLeadIdsForBatch(
      { LeadModel: TenantLead, ClientModel: TenantClient, CounterModel: TenantCounter },
      batch.companyCode,
      leads
    );

    const { docs, duplicateCount, errorCount } = prepareLeadDocs(leads, batch._id, companyMap);
    const insertedCount = await insertLeadChunks(docs, TenantLead);

    batch.status = 'completed';
    batch.insertedCount = insertedCount;
    batch.duplicateCount = duplicateCount;
    batch.errorCount = errorCount;
    batch.completedAt = new Date();
    await batch.save();

    await invalidateLeadCaches({
      companyCode: batch.companyCode,
      employeeId: batch.assignedEmployeeId || undefined,
    });

    if (docs.length > 0) {
      eventBus.emitToCompany(batch.companyCode, {
        type: 'LEADS_REFRESH',
        importBatchId: String(batch._id),
      });
      eventBus.emitToCompany(batch.companyCode, {
        type: 'LEAD_IMPORT_COMPLETED',
        importBatchId: String(batch._id),
        insertedCount,
      });
      logBulkImportHistory(docs, TenantHistory);
    }

    return {
      batchId: String(batch._id),
      count: insertedCount,
      duplicateCount,
      errorCount,
    };
  } catch (err) {
    batch.status = 'failed';
    batch.errorSummary = err.message;
    batch.completedAt = new Date();
    await batch.save();
    throw err;
  }
}

async function getLeadImportBatch(batchId) {
  return LeadImportBatch.findById(batchId).lean();
}

module.exports = {
  createLeadImportBatch,
  getLeadImportBatch,
  processLeadImportBatch,
};
