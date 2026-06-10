const { MongoClient, ObjectId } = require('mongodb');

async function main() {
  const uri = "mongodb+srv://yovel2911_db_user:7xvu38g4QcFqFlQv@mainrepo.fkx0e4d.mongodb.net/";
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db('test');
    
    const collections = await db.listCollections().toArray();
    
    for (const collInfo of collections) {
      if (collInfo.type === 'view') continue;
      const collection = db.collection(collInfo.name);
      
      const hasStringId = await collection.findOne({ employeeId: "69b7867163515d37e3da7ddb" });
      const hasObjectId = await collection.findOne({ employeeId: new ObjectId("69b7867163515d37e3da7ddb") });
      const hasEmpCode = await collection.findOne({ employeeCode: "26021" });
      
      if (hasStringId || hasObjectId || hasEmpCode) {
        console.log(`- Collection '${collInfo.name}' has data for employeeId/employeeCode`);
      }
    }
    console.log("Done checking employee associations.");
  } catch (err) {
    console.error(err);
  } finally {
    await client.close();
  }
}

main().catch(console.error);
