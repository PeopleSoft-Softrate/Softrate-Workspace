const { MongoClient } = require('mongodb');

async function main() {
  const sourceUri = "mongodb+srv://peoplesoft_db_user:OznQn0BetkMYfHO1@peoplesoft.xfh0vqd.mongodb.net/";
  const targetUri = "mongodb+srv://yovel2911_db_user:x3BIDPEMrPrbN68M@cluster0.kyxao9c.mongodb.net/";
  const destUri = "mongodb+srv://peoplesoft_db_user:jdaKGQQTcmvIFyCl@peoplesoft.rjdu5de.mongodb.net/";

  const sourceClient = new MongoClient(sourceUri);
  const targetClient = new MongoClient(targetUri);
  const destClient = new MongoClient(destUri);

  try {
    await sourceClient.connect();
    await targetClient.connect();
    await destClient.connect();

    // 1. Analyze Source
    console.log("=== Source Data ===");
    const sourceDb = sourceClient.db("hrdb");
    const companies = await sourceDb.collection("companies").find({}).toArray();
    console.log(`Found ${companies.length} companies in Source:`);
    companies.forEach(c => console.log(`  - ${c.name} (Code: ${c.companyCode}, ID: ${c._id})`));
    
    const employeesCount = await sourceDb.collection("employees").countDocuments();
    const usersCount = await sourceDb.collection("users").countDocuments();
    console.log(`Total employees: ${employeesCount}, Total users: ${usersCount}`);

    // 2. Analyze Target Structure
    console.log("\n=== Target Structure DBs ===");
    const targetAdmin = targetClient.db().admin();
    const targetDbs = await targetAdmin.listDatabases();
    console.log(targetDbs.databases.map(d => d.name).join(', '));

    // 3. Analyze Destination
    console.log("\n=== Destination DBs ===");
    const destAdmin = destClient.db().admin();
    const destDbs = await destAdmin.listDatabases();
    console.log(destDbs.databases.map(d => d.name).join(', '));

  } catch (err) {
    console.error(err);
  } finally {
    await sourceClient.close();
    await targetClient.close();
    await destClient.close();
  }
}

main();
