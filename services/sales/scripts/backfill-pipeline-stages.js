/**
 * Pipeline Stage Backfill Script
 * ================================
 * Maps existing Lead.status values to the new pipelineStage / connectionOutcome /
 * qualificationOutcome / qualificationReason fields.
 *
 * Usage:
 *   node scripts/backfill-pipeline-stages.js            # Run and write
 *   node scripts/backfill-pipeline-stages.js --dry-run  # Preview without writing
 *
 * Safe to re-run: skips leads that already have pipelineStage set.
 * Never modifies: status, remarks, _id, createdAt, updatedAt, or any other existing field.
 */

require('../loadEnv');
const mongoose = require('mongoose');

const DRY_RUN = process.argv.includes('--dry-run');
const BATCH_SIZE = 500;

// ── Status → Pipeline mapping ──────────────────────────────────
const STATUS_MAP = {
  'New':              { pipelineStage: 'NEW' },
  'Contacted':        { pipelineStage: 'CONNECTED' },
  'Follow Up':        { pipelineStage: 'QUALIFICATION' },
  'Details Shared':   { pipelineStage: 'QUALIFICATION' },
  'Future Needs':     { pipelineStage: 'QUALIFICATION' },
  'Call Later':       { pipelineStage: 'QUALIFICATION' },
  'Converted':        { pipelineStage: 'CLOSED_WON' },
  'Not Interested':   { pipelineStage: 'QUALIFICATION', qualificationOutcome: 'NOT_QUALIFIED', qualificationReason: 'NOT_INTERESTED' },
  'Invalid':          { pipelineStage: 'QUALIFICATION', qualificationOutcome: 'NOT_QUALIFIED', qualificationReason: 'INVALID' },
  'Not Connected':    { pipelineStage: 'NEW', connectionOutcome: 'NOT_CONNECTED' },
  // Fallback: any unrecognized status → NEW
  '__DEFAULT__':      { pipelineStage: 'NEW' },
};

function getMapping(status) {
  return STATUS_MAP[status] || STATUS_MAP['__DEFAULT__'];
}

async function run() {
  const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/softrate_record';
  console.log(`\n🔗 Connecting to MongoDB...`);
  await mongoose.connect(MONGO_URI);
  console.log(`✅ Connected\n`);

  if (DRY_RUN) {
    console.log('🔍 DRY RUN MODE — no writes will be made\n');
  }

  // ── Step 1: Scan all tenant DBs ────────────────────────────
  const adminDb = mongoose.connection.db;
  const dbList = await adminDb.admin().listDatabases();
  const tenantDbs = dbList.databases
    .map(d => d.name)
    .filter(n => n.startsWith('salesdb_'));

  console.log(`📦 Found ${tenantDbs.length} tenant databases\n`);

  let totalLeads = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;
  const statusSummary = {};

  for (const dbName of tenantDbs) {
    const db = mongoose.connection.useDb(dbName, { useCache: true });
    const Lead = db.collection('leads');

    // Only process leads where pipelineStage is not yet set
    const cursor = Lead.find({ pipelineStage: { $in: [null, undefined] } });
    let batch = [];

    while (await cursor.hasNext()) {
      const lead = await cursor.next();
      batch.push(lead);
      totalLeads++;

      if (batch.length >= BATCH_SIZE) {
        await processBatch(Lead, batch, statusSummary, DRY_RUN);
        totalUpdated += batch.length;
        batch = [];
      }
    }

    if (batch.length > 0) {
      await processBatch(Lead, batch, statusSummary, DRY_RUN);
      totalUpdated += batch.length;
    }
  }

  // ── Step 2: Report ──────────────────────────────────────────
  console.log('\n══════════════════════════════════════');
  console.log(DRY_RUN ? '📋 DRY RUN SUMMARY (no writes made)' : '✅ BACKFILL COMPLETE');
  console.log('══════════════════════════════════════');
  console.log(`Tenant databases processed : ${tenantDbs.length}`);
  console.log(`Leads processed            : ${totalLeads}`);
  console.log(`Leads updated              : ${DRY_RUN ? 'N/A (dry run)' : totalUpdated}`);
  console.log('\nStatus → Stage mapping breakdown:');
  for (const [status, count] of Object.entries(statusSummary).sort((a, b) => b[1] - a[1])) {
    const mapping = getMapping(status);
    console.log(`  "${status}" (${count}) → pipelineStage: ${mapping.pipelineStage}${mapping.connectionOutcome ? ', connectionOutcome: ' + mapping.connectionOutcome : ''}${mapping.qualificationOutcome ? ', qualificationOutcome: ' + mapping.qualificationOutcome : ''}`);
  }

  await mongoose.disconnect();
  console.log('\n🔌 Disconnected from MongoDB');
  process.exit(0);
}

async function processBatch(Lead, batch, statusSummary, dryRun) {
  const ops = batch.map(lead => {
    const status = lead.status || 'New';
    statusSummary[status] = (statusSummary[status] || 0) + 1;

    const mapping = getMapping(status);
    const $set = {
      pipelineStage: mapping.pipelineStage,
      stageChangedAt: lead.updatedAt || lead.createdAt || new Date(),
    };
    if (mapping.connectionOutcome)    $set.connectionOutcome = mapping.connectionOutcome;
    if (mapping.qualificationOutcome) $set.qualificationOutcome = mapping.qualificationOutcome;
    if (mapping.qualificationReason)  $set.qualificationReason = mapping.qualificationReason;

    return {
      updateOne: {
        filter: { _id: lead._id, pipelineStage: { $in: [null, undefined] } }, // idempotent
        update: { $set },
      },
    };
  });

  if (!dryRun && ops.length > 0) {
    await Lead.bulkWrite(ops, { ordered: false });
  }
}

run().catch(err => {
  console.error('❌ Backfill failed:', err);
  process.exit(1);
});
