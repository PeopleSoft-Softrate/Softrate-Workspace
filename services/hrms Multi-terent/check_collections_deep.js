const { MongoClient } = require('mongodb');

async function main() {
  const uri = "mongodb+srv://yovel2911_db_user:7xvu38g4QcFqFlQv@mainrepo.fkx0e4d.mongodb.net/";
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db('test');
    
    const collections = await db.listCollections().toArray();
    let foundAnywhereElse = false;
    
    for (const collInfo of collections) {
      if (collInfo.type === 'view') continue;
      const collection = db.collection(collInfo.name);
      
      const docs = await collection.find({}).toArray();
      
      for (const doc of docs) {
        const jsonStr = JSON.stringify(doc);
        if (jsonStr.includes("9787797466")) {
          console.log(`- Found in collection '${collInfo.name}', document ID: ${doc._id}`);
          if (collInfo.name !== 'employees') foundAnywhereElse = true;
        }
      }
    }
    
    if (!foundAnywhereElse) {
      console.log("No, the phone number 9787797466 was ONLY found in the 'employees' collection.");
    }
  } catch (err) {
    console.error(err);
  } finally {
    await client.close();
  }
}

main().catch(console.error);
