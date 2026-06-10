const { MongoClient } = require('mongodb');

async function main() {
  const uri = "mongodb+srv://yovel2911_db_user:7xvu38g4QcFqFlQv@mainrepo.fkx0e4d.mongodb.net/";
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db('test');
    
    const collections = await db.listCollections().toArray();
    let totalUpdated = 0;
    
    for (const collInfo of collections) {
      if (collInfo.type === 'view') continue;
      const collection = db.collection(collInfo.name);
      
      const docs = await collection.find({}).toArray();
      let updatedInCollection = 0;
      
      for (const doc of docs) {
        const jsonStr = JSON.stringify(doc);
        // If the document contains the phone number and has a companyCode to update
        if (jsonStr.includes("9787797466") && doc.companyCode) {
          if (doc.companyCode !== "WEE-0306-2026") {
            await collection.updateOne(
              { _id: doc._id },
              { $set: { companyCode: "WEE-0306-2026" } }
            );
            updatedInCollection++;
            totalUpdated++;
          }
        }
      }
      if (updatedInCollection > 0) {
        console.log(`Updated ${updatedInCollection} documents in collection '${collInfo.name}'`);
      }
    }
    
    console.log(`Finished! Total documents updated across all collections: ${totalUpdated}`);

  } catch (err) {
    console.error(err);
  } finally {
    await client.close();
  }
}

main().catch(console.error);
