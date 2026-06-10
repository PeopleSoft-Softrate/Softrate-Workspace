const { MongoClient } = require('mongodb');

async function main() {
  const uri = "mongodb+srv://yovel2911_db_user:7xvu38g4QcFqFlQv@mainrepo.fkx0e4d.mongodb.net/";
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log("Connected to MongoDB.");

    const adminDb = client.db('admin');
    const { databases } = await adminDb.admin().listDatabases();
    
    for (const dbInfo of databases) {
      if (['admin', 'local', 'config'].includes(dbInfo.name)) continue;
      
      const db = client.db(dbInfo.name);
      const collections = await db.listCollections().toArray();
      
      for (const collInfo of collections) {
        if (collInfo.type === 'view') continue;
        
        const collection = db.collection(collInfo.name);
        
        try {
          const result = await collection.updateMany(
            { mobile: "9787797466" },
            { $set: { companyCode: "WEE-0306-2026" } }
          );
          
          if (result.modifiedCount > 0) {
            console.log(`Updated ${result.modifiedCount} documents in DB ${dbInfo.name}, collection ${collInfo.name}`);
          }
        } catch (e) {
            // ignore schema errors or view errors
        }
      }
    }
    
    console.log("Finished updating across all databases and collections.");
  } catch (err) {
    console.error(err);
  } finally {
    await client.close();
  }
}

main().catch(console.error);
