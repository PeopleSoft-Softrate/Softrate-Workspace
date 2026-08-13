require('../loadEnv');
const mongoose = require('mongoose');
const User = require('../models/User');

const leadSchema = require('../models/Lead').schema;

const OLD_STATUSES = ['DNP / Not Reachable', 'Busy', 'Switch off', 'Switch Off', 'Dnp', 'Not Reachable', 'Dnp/ not reachable'];
const NEW_STATUS = 'Not Connected';

async function run() {
  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      console.error('Error: MONGO_URI not set in environment.');
      process.exit(1);
    }

    console.log('--- Starting Tenant-Aware Migration: Consolidation to "Not Connected" ---');
    console.log(`Connecting to MongoDB (master)...`);
    await mongoose.connect(mongoUri);
    console.log('Connected to master DB.');

    const users = await User.find({}).lean();
    console.log(`Found ${users.length} tenants (Users).`);

    let totalUpdated = 0;

    for (const user of users) {
      if (!user.companyCode) continue;
      
      const dbName = `salesdb_${user.companyCode.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
      console.log(`Processing tenant DB: ${dbName}`);
      
      const tenantUri = new URL(mongoUri);
      tenantUri.pathname = `/${dbName}`;
      const conn = await mongoose.createConnection(tenantUri.toString()).asPromise();
      
      const TenantLead = conn.model('Lead', leadSchema);
      
      const leadResult = await TenantLead.updateMany(
        { status: { $in: OLD_STATUSES } },
        { $set: { status: NEW_STATUS } }
      );
      
      if (leadResult.modifiedCount > 0) {
        console.log(` -> Updated ${leadResult.modifiedCount} Leads in ${dbName}`);
        totalUpdated += leadResult.modifiedCount;
      }
      
      await conn.close();
    }

    console.log(`Migration completed successfully. Total Leads updated: ${totalUpdated}`);
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

run();
