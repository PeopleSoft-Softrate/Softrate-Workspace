require('../loadEnv');
const mongoose = require('mongoose');
const User = require('../models/User');
const leadSchema = require('../models/Lead').schema;
const clientSchema = require('../models/Client').schema;
const counterSchema = require('../models/Counter').schema;
const { formatLeadId, normalizeText } = require('../services/leadNormalization');

async function backfillTenantLeadIds(conn, companyCode) {
  const code = String(companyCode || '').trim().toUpperCase();
  const TenantLead = conn.model('Lead', leadSchema);
  const TenantClient = conn.model('Client', clientSchema);
  const TenantCounter = conn.model('Counter', counterSchema);

  // 1. Get current counter if any
  const existingCounter = await TenantCounter.findOne({ companyCode: code, entity: 'lead' }).lean();
  let currentSeq = existingCounter ? (Number(existingCounter.seq) || 0) : 0;

  // 2. Fetch all leads ordered by earliest creation
  const allLeads = await TenantLead.find({}).sort({ createdAt: 1, sheetOrder: 1, _id: 1 }).lean();
  console.log(`  Found ${allLeads.length} total leads for tenant ${code}.`);

  if (allLeads.length === 0) {
    return { companyCode: code, totalLeads: 0, distinctCompanies: 0, maxSeq: currentSeq };
  }

  // 3. Group leads by company
  const companyGroups = new Map(); // normName -> Array<lead>
  let maxAssignedSeq = 0;

  for (const lead of allLeads) {
    const norm = normalizeText(lead.leadCompanyName || lead.leadCompanyNameLower);
    if (!norm) continue;

    if (!companyGroups.has(norm)) {
      companyGroups.set(norm, []);
    }
    companyGroups.get(norm).push(lead);

    // Track any existing leadId format
    if (lead.leadId && /^L\d+$/i.test(lead.leadId)) {
      const parsed = parseInt(lead.leadId.slice(1), 10);
      if (!Number.isNaN(parsed) && parsed > maxAssignedSeq) {
        maxAssignedSeq = parsed;
      }
    }
  }

  // Also check existing clients for leadId
  const allClients = await TenantClient.find({}).lean();
  const clientMap = new Map();
  for (const client of allClients) {
    const norm = normalizeText(client.companyName || client.normalizedCompanyName);
    if (norm) {
      clientMap.set(norm, client);
      if (client.leadId && /^L\d+$/i.test(client.leadId)) {
        const parsed = parseInt(client.leadId.slice(1), 10);
        if (!Number.isNaN(parsed) && parsed > maxAssignedSeq) {
          maxAssignedSeq = parsed;
        }
      }
    }
  }

  currentSeq = Math.max(currentSeq, maxAssignedSeq);

  const leadBulkOps = [];
  const clientBulkOps = [];
  let companiesAssigned = 0;

  // 4. Assign leadId per company
  for (const [normName, leads] of companyGroups.entries()) {
    let leadId = leads.find((l) => l.leadId && l.leadId.trim())?.leadId || clientMap.get(normName)?.leadId || '';

    if (!leadId) {
      currentSeq += 1;
      leadId = formatLeadId(currentSeq);
      companiesAssigned += 1;
    }

    const leadIdsToUpdate = leads.filter((l) => l.leadId !== leadId).map((l) => l._id);
    if (leadIdsToUpdate.length > 0) {
      leadBulkOps.push({
        updateMany: {
          filter: { _id: { $in: leadIdsToUpdate } },
          update: { $set: { leadId } },
        },
      });
    }

    const matchingClient = clientMap.get(normName);
    if (matchingClient && matchingClient.leadId !== leadId) {
      clientBulkOps.push({
        updateOne: {
          filter: { _id: matchingClient._id },
          update: { $set: { leadId } },
        },
      });
    }
  }

  // Execute bulk operations in batches
  const CHUNK_SIZE = 1000;
  for (let i = 0; i < leadBulkOps.length; i += CHUNK_SIZE) {
    const slice = leadBulkOps.slice(i, i + CHUNK_SIZE);
    await TenantLead.bulkWrite(slice, { ordered: false });
  }

  for (let i = 0; i < clientBulkOps.length; i += CHUNK_SIZE) {
    const slice = clientBulkOps.slice(i, i + CHUNK_SIZE);
    await TenantClient.bulkWrite(slice, { ordered: false });
  }

  // 5. Update or set Counter
  await TenantCounter.findOneAndUpdate(
    { companyCode: code, entity: 'lead' },
    { $set: { seq: currentSeq } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  console.log(`  -> Assigned ${companiesAssigned} new company Lead IDs across ${companyGroups.size} unique companies. Final sequence counter: ${currentSeq}`);

  return {
    companyCode: code,
    totalLeads: allLeads.length,
    distinctCompanies: companyGroups.size,
    bulkOpsCount: leadBulkOps.length,
    maxSeq: currentSeq,
  };
}

async function run() {
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/softrate_record';
  console.log('=== Starting Fast Bulk Lead ID Backfill & Migration ===');
  console.log(`Connecting to Master DB: ${mongoUri}`);
  await mongoose.connect(mongoUri);

  const users = await User.find({}).lean();
  console.log(`Found ${users.length} registered tenants/users.`);

  const results = [];

  for (const user of users) {
    if (!user.companyCode) continue;
    const companyCode = user.companyCode.trim().toUpperCase();
    const dbName = `salesdb_${companyCode.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;

    console.log(`\nProcessing tenant [${companyCode}] -> Database: ${dbName}`);
    try {
      const tenantUri = new URL(mongoUri);
      tenantUri.pathname = `/${dbName}`;
      const conn = await mongoose.createConnection(tenantUri.toString()).asPromise();

      const result = await backfillTenantLeadIds(conn, companyCode);
      results.push(result);

      await conn.close();
    } catch (err) {
      console.error(`Error processing tenant ${companyCode}:`, err);
    }
  }

  // Also check master db Softrate records if any
  try {
    const MasterLead = mongoose.models.Lead || mongoose.model('Lead', leadSchema);
    const masterCount = await MasterLead.countDocuments();
    if (masterCount > 0) {
      console.log(`\nProcessing Master DB softrate_record (${masterCount} leads)...`);
      const masterResult = await backfillTenantLeadIds(mongoose.connection, 'SOFTRATE');
      results.push({ ...masterResult, companyCode: 'MASTER_SOFTRATE' });
    }
  } catch (err) {
    console.error('Error checking master db:', err);
  }

  console.log('\n=== Lead ID Backfill Completed Successfully ===');
  console.table(results);

  await mongoose.disconnect();
  process.exit(0);
}

run().catch(async (err) => {
  console.error('Fatal backfill error:', err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
