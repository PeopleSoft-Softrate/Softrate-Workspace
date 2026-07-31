require('../loadEnv');
const mongoose = require('mongoose');

// Schemas
const leadSchema = require('../models/Lead').schema;
const callLogSchema = require('../models/CallLog').schema;
const callDetailSchema = require('../models/CallDetail').schema;
const bookmarkSchema = require('../models/Bookmark').schema;
const breakLogSchema = require('../models/BreakLog').schema;
const quotationSchema = require('../models/Quotation').schema;
const invoiceSchema = require('../models/Invoice').schema;
const historySchema = require('../models/History').schema;

const collectionsToMove = [
  { name: 'Lead', schema: leadSchema },
  { name: 'CallLog', schema: callLogSchema },
  { name: 'CallDetail', schema: callDetailSchema },
  { name: 'Bookmark', schema: bookmarkSchema },
  { name: 'BreakLog', schema: breakLogSchema },
  { name: 'Quotation', schema: quotationSchema },
  { name: 'Invoice', schema: invoiceSchema },
  { name: 'History', schema: historySchema }
];

async function runTenantMigration() {
  try {
    const masterUri = process.env.MONGO_URI;
    console.log('Connecting to Master DB...');
    const masterConn = await mongoose.createConnection(masterUri).asPromise();
    console.log('Connected to Master DB.');

    // We don't move Users or Employees, they stay in Master DB
    const User = masterConn.model('User', new mongoose.Schema({}, { strict: false }));
    const companies = await User.find({}).lean();
    console.log(`Found ${companies.length} companies.`);

    for (const company of companies) {
      if (!company.companyCode) continue;
      
      const companyCode = company.companyCode;
      const dbName = `salesdb_${companyCode.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
      
      const parsedUri = new URL(masterUri);
      parsedUri.pathname = `/${dbName}`;
      const tenantUri = parsedUri.toString();
      
      console.log(`\n--- Migrating ${companyCode} to ${dbName} ---`);
      const tenantConn = await mongoose.createConnection(tenantUri).asPromise();

      for (const col of collectionsToMove) {
        const MasterModel = masterConn.model(col.name, col.schema);
        const TenantModel = tenantConn.model(col.name, col.schema);

        const records = await MasterModel.find({ companyCode }).lean();
        if (records.length === 0) {
          console.log(`  ${col.name}: 0 records to move.`);
          continue;
        }

        console.log(`  ${col.name}: found ${records.length} records in master DB.`);

        try {
          await TenantModel.insertMany(records, { ordered: false });
          console.log(`    -> Inserted into tenant DB.`);
        } catch (err) {
          // Ignore duplicate key errors if we run script multiple times
          if (err.code === 11000 || (err.writeErrors && err.writeErrors.some(e => e.code === 11000))) {
            console.log(`    -> Some or all records already exist in tenant DB.`);
          } else {
            console.error(`    -> Error inserting into tenant DB:`, err.message);
            continue;
          }
        }

        // After successful copy, delete from master DB
        const delRes = await MasterModel.deleteMany({ companyCode });
        console.log(`    -> Deleted ${delRes.deletedCount} records from master DB.`);
      }

      await tenantConn.close();
    }

    console.log('\nTenant Migration Complete!');
    await masterConn.close();
    process.exit(0);

  } catch (err) {
    console.error('Tenant Migration failed:', err);
    process.exit(1);
  }
}

runTenantMigration();
