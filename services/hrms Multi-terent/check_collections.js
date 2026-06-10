const { MongoClient } = require('mongodb');

async function main() {
  const uri = "mongodb+srv://yovel2911_db_user:7xvu38g4QcFqFlQv@mainrepo.fkx0e4d.mongodb.net/";
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db('test');
    
    const collections = await db.listCollections().toArray();
    console.log(`Found ${collections.length} collections. Checking for employee 26021 or mobile 9787797466...`);
    
    for (const collInfo of collections) {
      if (collInfo.type === 'view') continue;
      const collection = db.collection(collInfo.name);
      
      // Look for mobile
      const hasMobile = await collection.findOne({ mobile: "9787797466" });
      const hasEmployeeCode = await collection.findOne({ employeeCode: "26021" });
      
      if (hasMobile) {
        console.log(`- Collection '${collInfo.name}' has documents with mobile: "9787797466"`);
      }
      if (hasEmployeeCode && !hasMobile) {
        console.log(`- Collection '${collInfo.name}' has documents with employeeCode: "26021" (but no mobile field matching)`);
      }
    }
  } catch (err) {
    console.error(err);
  } finally {
    await client.close();
  }
}

main().catch(console.error);
