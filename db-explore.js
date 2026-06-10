const { MongoClient } = require('mongodb');

async function exploreCluster(name, uri) {
  console.log(`\n=== Exploring ${name} ===`);
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const adminDb = client.db().admin();
    const listDatabases = await adminDb.listDatabases();
    
    for (const dbInfo of listDatabases.databases) {
      if (['admin', 'local', 'config'].includes(dbInfo.name)) continue;
      
      console.log(`\nDatabase: ${dbInfo.name}`);
      const db = client.db(dbInfo.name);
      const collections = await db.listCollections().toArray();
      
      for (const coll of collections) {
        console.log(`  - Collection: ${coll.name}`);
        // Get one document to see structure
        const sampleDoc = await db.collection(coll.name).findOne({});
        if (sampleDoc) {
           console.log(`    Fields: ${Object.keys(sampleDoc).join(', ')}`);
        } else {
           console.log(`    (Empty)`);
        }
      }
    }
  } catch (err) {
    console.error(`Error exploring ${name}:`, err.message);
  } finally {
    await client.close();
  }
}

async function main() {
  await exploreCluster("Source Data", "mongodb+srv://peoplesoft_db_user:OznQn0BetkMYfHO1@peoplesoft.xfh0vqd.mongodb.net/");
  await exploreCluster("Target Structure", "mongodb+srv://yovel2911_db_user:x3BIDPEMrPrbN68M@cluster0.kyxao9c.mongodb.net/");
  await exploreCluster("Destination", "mongodb+srv://peoplesoft_db_user:jdaKGQQTcmvIFyCl@peoplesoft.rjdu5de.mongodb.net/");
}

main().catch(console.error);
