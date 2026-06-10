const { MongoClient } = require('mongodb');

async function main() {
  const sourceUri = "mongodb+srv://peoplesoft_db_user:OznQn0BetkMYfHO1@peoplesoft.xfh0vqd.mongodb.net/";
  const destUri = "mongodb+srv://peoplesoft_db_user:jdaKGQQTcmvIFyCl@peoplesoft.rjdu5de.mongodb.net/";

  const sourceClient = new MongoClient(sourceUri);
  const destClient = new MongoClient(destUri);

  try {
    console.log("Connecting to databases...");
    await sourceClient.connect();
    await destClient.connect();

    const sourceDb = sourceClient.db("hrdb");
    const destMasterDb = destClient.db("hrdb_master");

    console.log("Clearing destination hrdb_master.companies...");
    await destMasterDb.collection("companies").deleteMany({});

    const companies = await sourceDb.collection("companies").find({}).toArray();
    console.log(`Found ${companies.length} companies in Source.`);

    // 1. Process Companies
    for (const company of companies) {
      const cleanCode = (company.companyCode || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      const dbName = company.dbName || `hrdb_${cleanCode}`;
      
      console.log(`\n--- Processing Company: ${company.name} (DB: ${dbName}) ---`);
      
      // Insert to master
      company.dbName = dbName;
      await destMasterDb.collection("companies").insertOne(company);
      console.log(`Inserted company into hrdb_master.companies`);

      // 2. Clear Tenant DB
      const tenantDb = destClient.db(dbName);
      console.log(`Clearing existing collections in tenant DB ${dbName}...`);
      await tenantDb.dropDatabase();

      // 3. Migrate Collections
      const sourceCollections = await sourceDb.listCollections().toArray();
      
      for (const collInfo of sourceCollections) {
        const collName = collInfo.name;
        if (collName === 'companies' || collName.startsWith('system.')) continue;

        const sourceColl = sourceDb.collection(collName);
        const destColl = tenantDb.collection(collName);

        // Fetch documents for this company (or all if no companyId exists and there's only 1 company)
        let query = {
          $or: [
            { companyId: company._id },
            { companyId: String(company._id) }
          ]
        };

        let docs = await sourceColl.find(query).toArray();
        
        // If no docs matched companyId, maybe the collection doesn't use companyId.
        // If there is only 1 company globally, just copy everything.
        if (docs.length === 0 && companies.length === 1) {
          const allDocs = await sourceColl.find({}).toArray();
          // Check if they actually lack companyId or if they belong to another company?
          // Since there is 1 company, they belong to this one.
          const docsWithoutCompanyId = allDocs.filter(d => !d.companyId);
          if (docsWithoutCompanyId.length > 0) {
            docs = docsWithoutCompanyId;
          }
        }

        if (docs.length > 0) {
          // Ensure companyId is set on all docs to the ObjectId
          docs.forEach(d => {
            if (!d.companyId) d.companyId = company._id;
          });
          
          await destColl.insertMany(docs);
          console.log(`  -> Migrated ${docs.length} documents into '${collName}'`);
        }
      }
    }

    console.log("\nMigration completed successfully.");

    // Verification
    console.log("\n--- Verification ---");
    const masterCount = await destMasterDb.collection("companies").countDocuments();
    console.log(`Master DB Companies Count: ${masterCount}`);
    
    for (const company of companies) {
      const dbName = company.dbName;
      const tenantDb = destClient.db(dbName);
      const employeesCount = await tenantDb.collection("employees").countDocuments();
      const usersCount = await tenantDb.collection("users").countDocuments();
      console.log(`Tenant ${dbName} - Employees: ${employeesCount}, Users: ${usersCount}`);
    }

  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await sourceClient.close();
    await destClient.close();
  }
}

main();
