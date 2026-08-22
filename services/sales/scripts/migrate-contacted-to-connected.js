require('../loadEnv');
const { MongoClient } = require('mongodb');

const masterUri = process.env.MONGO_URI || 'mongodb://localhost:27017/softrate_record';
const client = new MongoClient(masterUri);

async function run() {
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB at:', masterUri.replace(/:[^:@]+@/, ':****@'));

    const adminDb = client.db().admin();
    const dbsInfo = await adminDb.listDatabases();
    console.log(`Found ${dbsInfo.databases.length} databases.`);

    let totalLeadsUpdated = 0;
    let totalUsersUpdated = 0;
    let totalDealsUpdated = 0;

    for (const dbInfo of dbsInfo.databases) {
      const dbName = dbInfo.name;
      if (['admin', 'local', 'config'].includes(dbName)) continue;

      console.log(`\n--- Processing database: [${dbName}] ---`);
      const db = client.db(dbName);
      const collections = (await db.listCollections().toArray()).map(c => c.name);

      // 1. Migrate leads
      if (collections.includes('leads')) {
        const leadsCol = db.collection('leads');
        const res = await leadsCol.updateMany(
          { status: { $in: ['Contacted', 'contacted'] } },
          { $set: { status: 'Connected' } }
        );
        if (res.modifiedCount > 0) {
          console.log(`  ✓ Updated ${res.modifiedCount} leads to status: 'Connected' in ${dbName}`);
          totalLeadsUpdated += res.modifiedCount;
        }
      }

      // 2. Migrate users / company settings
      if (collections.includes('users')) {
        const usersCol = db.collection('users');

        // Replace 'Contacted' in leadStatuses array
        const u1 = await usersCol.updateMany(
          { leadStatuses: { $in: ['Contacted', 'contacted'] } },
          { $set: { 'leadStatuses.$[elem]': 'Connected' } },
          { arrayFilters: [{ elem: { $in: ['Contacted', 'contacted'] } }] }
        );

        // Replace in interestedPageStatuses
        await usersCol.updateMany(
          { interestedPageStatuses: { $in: ['Contacted', 'contacted'] } },
          { $set: { 'interestedPageStatuses.$[elem]': 'Connected' } },
          { arrayFilters: [{ elem: { $in: ['Contacted', 'contacted'] } }] }
        );

        // Replace in dnpPageStatuses
        await usersCol.updateMany(
          { dnpPageStatuses: { $in: ['Contacted', 'contacted'] } },
          { $set: { 'dnpPageStatuses.$[elem]': 'Connected' } },
          { arrayFilters: [{ elem: { $in: ['Contacted', 'contacted'] } }] }
        );

        // Replace in convertedPageStatuses
        await usersCol.updateMany(
          { convertedPageStatuses: { $in: ['Contacted', 'contacted'] } },
          { $set: { 'convertedPageStatuses.$[elem]': 'Connected' } },
          { arrayFilters: [{ elem: { $in: ['Contacted', 'contacted'] } }] }
        );

        if (u1.modifiedCount > 0) {
          console.log(`  ✓ Updated ${u1.modifiedCount} users leadStatuses array in ${dbName}`);
          totalUsersUpdated += u1.modifiedCount;
        }
      }

      // 3. Migrate deals if any
      if (collections.includes('deals')) {
        const dealsCol = db.collection('deals');
        const d1 = await dealsCol.updateMany(
          { stage: { $in: ['Contacted', 'contacted'] } },
          { $set: { stage: 'Connected' } }
        );
        const d2 = await dealsCol.updateMany(
          { status: { $in: ['Contacted', 'contacted'] } },
          { $set: { status: 'Connected' } }
        );
        const count = d1.modifiedCount + d2.modifiedCount;
        if (count > 0) {
          console.log(`  ✓ Updated ${count} deals in ${dbName}`);
          totalDealsUpdated += count;
        }
      }
    }

    console.log('\n========================================');
    console.log(' Migration Summary:');
    console.log(`  - Total Leads Updated: ${totalLeadsUpdated}`);
    console.log(`  - Total Users Updated: ${totalUsersUpdated}`);
    console.log(`  - Total Deals Updated: ${totalDealsUpdated}`);
    console.log('========================================\n');
  } catch (error) {
    console.error('Migration error:', error);
  } finally {
    await client.close();
    console.log('MongoDB connection closed.');
  }
}

run();
