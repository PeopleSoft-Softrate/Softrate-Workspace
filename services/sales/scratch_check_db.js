const { MongoClient } = require('mongodb');

async function main() {
  const sourceUri = 'mongodb+srv://yovel2911_db_user:7xvu38g4QcFqFlQv@mainrepo.fkx0e4d.mongodb.net/';
  const destUri = 'mongodb+srv://peoplesoft_db_user:xVttah0M8dAZHr69@cluster0.lztsvhx.mongodb.net/';
  
  const sourceClient = new MongoClient(sourceUri);
  const destClient = new MongoClient(destUri);
  
  try {
    await sourceClient.connect();
    await destClient.connect();
    
    const sourceDbs = await sourceClient.db().admin().listDatabases();
    console.log("=== Source DBs ===");
    console.log(sourceDbs.databases.map(d => d.name));
    
    const destDbs = await destClient.db().admin().listDatabases();
    console.log("\n=== Dest DBs ===");
    console.log(destDbs.databases.map(d => d.name));
    
  } finally {
    await sourceClient.close();
    await destClient.close();
  }
}

main().catch(console.error);
