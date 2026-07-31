const { MongoClient } = require('mongodb');

async function main() {
  const sourceUri = 'mongodb+srv://yovel2911_db_user:7xvu38g4QcFqFlQv@mainrepo.fkx0e4d.mongodb.net/';
  const sourceClient = new MongoClient(sourceUri);
  try {
    await sourceClient.connect();
    const db = sourceClient.db('softrate_record');
    const cols = await db.listCollections().toArray();
    console.log("Collections in softrate_record:");
    console.log(cols.map(c => c.name));
    
    // Check if test db has collections
    const testDb = sourceClient.db('test');
    const testCols = await testDb.listCollections().toArray();
    console.log("Collections in test:");
    console.log(testCols.map(c => c.name));
  } finally {
    await sourceClient.close();
  }
}
main().catch(console.error);
