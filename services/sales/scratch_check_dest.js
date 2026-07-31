const { MongoClient } = require('mongodb');

async function main() {
  const destUri = 'mongodb+srv://peoplesoft_db_user:xVttah0M8dAZHr69@cluster0.lztsvhx.mongodb.net/';
  const destClient = new MongoClient(destUri);
  try {
    await destClient.connect();
    const testDb = destClient.db('test');
    const testCols = await testDb.listCollections().toArray();
    console.log("Collections in destination test DB:");
    console.log(testCols.map(c => c.name));
    
    const salesDb = destClient.db('sales_db');
    const salesCols = await salesDb.listCollections().toArray();
    console.log("Collections in destination sales_db:");
    console.log(salesCols.map(c => c.name));
  } finally {
    await destClient.close();
  }
}
main().catch(console.error);
