const { MongoClient } = require('mongodb');

const uri = "mongodb://softrate:changeme@127.0.0.1:27027/?authSource=admin";
const client = new MongoClient(uri);

async function run() {
  try {
    await client.connect();
    console.log("Connected to MongoDB.");
    
    const adminDb = client.db('admin');
    const dbsInfo = await adminDb.admin().listDatabases();
    
    for (const dbInfo of dbsInfo.databases) {
      const dbName = dbInfo.name;
      if (['admin', 'local', 'config'].includes(dbName)) continue;
      
      console.log(`Processing database: ${dbName}`);
      const db = client.db(dbName);
      
      // Update leads
      const leadsCol = db.collection('leads');
      const leadsRes = await leadsCol.updateMany(
        { status: 'Contacted' },
        { $set: { status: 'Connected' } }
      );
      if (leadsRes.modifiedCount > 0) {
        console.log(`  Updated ${leadsRes.modifiedCount} leads in ${dbName}`);
      }
      
      // Update users leadStatuses array
      const usersCol = db.collection('users');
      // If Contacted is in leadStatuses, replace it with Connected.
      // Easiest is to push Connected and pull Contacted, but we want to maintain order if possible? 
      // Actually replacing element in array directly is: { $set: { "leadStatuses.$": "Connected" } } with query { leadStatuses: "Contacted" }
      const usersRes = await usersCol.updateMany(
        { leadStatuses: 'Contacted' },
        { $set: { "leadStatuses.$": "Connected" } }
      );
      if (usersRes.modifiedCount > 0) {
        console.log(`  Updated ${usersRes.modifiedCount} users in ${dbName}`);
      }
    }
  } catch (error) {
    console.error(error);
  } finally {
    await client.close();
    console.log("MongoDB connection closed.");
  }
}
run();
