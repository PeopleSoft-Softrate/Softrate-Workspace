const { MongoClient } = require('mongodb');

async function main() {
  const uri = "mongodb+srv://yovel2911_db_user:7xvu38g4QcFqFlQv@mainrepo.fkx0e4d.mongodb.net/";
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db('test');
    
    console.log("=== CALLDETAILS ===");
    const calldetail = await db.collection('calldetails').find().toArray();
    const match1 = calldetail.find(doc => JSON.stringify(doc).includes("9787797466"));
    console.log(JSON.stringify(match1, null, 2));
    
    console.log("=== INVOICES ===");
    const invoice = await db.collection('invoices').find().toArray();
    const match2 = invoice.find(doc => JSON.stringify(doc).includes("9787797466"));
    console.log(JSON.stringify(match2, null, 2));

  } catch (err) {
    console.error(err);
  } finally {
    await client.close();
  }
}

main().catch(console.error);
