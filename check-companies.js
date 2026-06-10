const { MongoClient } = require('mongodb');

async function main() {
  const sourceUri = "mongodb+srv://peoplesoft_db_user:OznQn0BetkMYfHO1@peoplesoft.xfh0vqd.mongodb.net/";
  const destUri = "mongodb+srv://peoplesoft_db_user:jdaKGQQTcmvIFyCl@peoplesoft.rjdu5de.mongodb.net/";

  const sourceClient = new MongoClient(sourceUri);
  const destClient = new MongoClient(destUri);

  try {
    await sourceClient.connect();
    await destClient.connect();

    const sourceDb = sourceClient.db("hrdb");
    const sourceCompanies = await sourceDb.collection("companies").find({}).toArray();
    console.log(`Source Companies:`);
    sourceCompanies.forEach(c => console.log(`  - ${c.name} (${c.companyCode}) - _id: ${c._id}`));

    const destDb = destClient.db("hrdb_master");
    const destCompanies = await destDb.collection("companies").find({}).toArray();
    console.log(`\nDestination Companies:`);
    destCompanies.forEach(c => console.log(`  - ${c.name} (${c.companyCode}) - dbName: ${c.dbName} - _id: ${c._id}`));

  } catch (err) {
    console.error(err);
  } finally {
    await sourceClient.close();
    await destClient.close();
  }
}

main();
