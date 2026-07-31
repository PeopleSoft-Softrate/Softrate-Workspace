const { MongoClient } = require('mongodb');

async function main() {
  const sourceUri = 'mongodb+srv://yovel2911_db_user:7xvu38g4QcFqFlQv@mainrepo.fkx0e4d.mongodb.net/';
  const destUri = 'mongodb+srv://peoplesoft_db_user:xVttah0M8dAZHr69@cluster0.lztsvhx.mongodb.net/';

  console.log('Connecting to clusters...');
  const sourceClient = new MongoClient(sourceUri);
  const destClient = new MongoClient(destUri);

  try {
    await sourceClient.connect();
    await destClient.connect();

    console.log('Connected to both clusters.');
    
    // Drop existing sales databases on destination
    console.log('Dropping existing tenant sales databases on destination...');
    const destDbs = await destClient.db().admin().listDatabases();
    for (const dbInfo of destDbs.databases) {
      if (dbInfo.name.startsWith('salesdb_')) {
        console.log(`Dropping destination tenant database: ${dbInfo.name}`);
        await destClient.db(dbInfo.name).dropDatabase();
      }
    }

    const sourceDb = sourceClient.db('test');
    const destMainDb = destClient.db('test');

    const globalCollections = [
      'users', 'employees', 'admins', 'emailtemplates'
    ];
    
    const tenantCollections = [
      'leads', 'calllogs', 'calldetails', 'bookmarks', 'breaklogs',
      'quotations', 'invoices', 'histories', 'clients', 'counters', 'leadimportbatches', 'leadcompanyprofiles'
    ];

    console.log('\n--- Clearing Existing Global/Tenant Collections in Destination test DB ---');
    for (const collName of [...globalCollections, ...tenantCollections]) {
      try {
        await destMainDb.collection(collName).drop();
        console.log(`Dropped collection '${collName}' from destination test DB`);
      } catch (err) {
        // Ignore if collection doesn't exist
      }
    }

    // Helper for DB names
    const getTenantDbName = (companyCode) => {
      if (!companyCode) return 'salesdb_unknown';
      return `salesdb_${companyCode.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    };

    // 1. Migrate Global Collections
    console.log('\n--- Migrating Global Collections (from test to test) ---');
    for (const collName of globalCollections) {
      const docs = await sourceDb.collection(collName).find({}).toArray();
      if (docs.length > 0) {
        await destMainDb.collection(collName).insertMany(docs);
        console.log(`Migrated ${docs.length} documents for '${collName}' to main DB`);
      } else {
        console.log(`No documents found for '${collName}'`);
      }
    }

    // 2. Migrate Tenant Collections
    console.log('\n--- Migrating Tenant Collections (from test to salesdb_<companyCode>) ---');
    for (const collName of tenantCollections) {
      const docs = await sourceDb.collection(collName).find({}).toArray();
      if (docs.length === 0) {
        console.log(`No documents found for '${collName}'`);
        continue;
      }

      // Group by companyCode
      const docsByCompany = {};
      for (const doc of docs) {
        // Some collections like Quotation/Invoice might have companyCode, some might not depending on schema
        // Default to 'unknown' if not present
        const companyCode = doc.companyCode || 'UNKNOWN';
        if (!docsByCompany[companyCode]) {
          docsByCompany[companyCode] = [];
        }
        docsByCompany[companyCode].push(doc);
      }

      for (const [companyCode, companyDocs] of Object.entries(docsByCompany)) {
        const destDbName = getTenantDbName(companyCode);
        await destClient.db(destDbName).collection(collName).insertMany(companyDocs);
        console.log(`Migrated ${companyDocs.length} documents for '${collName}' to ${destDbName}`);
      }
    }

    console.log('\n✅ Migration completed successfully!');

  } catch (err) {
    console.error('❌ Migration failed:', err);
  } finally {
    await sourceClient.close();
    await destClient.close();
  }
}

main().catch(console.error);
