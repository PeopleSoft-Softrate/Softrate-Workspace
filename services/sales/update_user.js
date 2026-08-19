const { MongoClient } = require('mongodb');

async function main() {
  const uri = "mongodb://softrate:changeme@127.0.0.1:27027/?authSource=admin";
  const client = new MongoClient(uri);

  try {
    await client.connect();
    
    // Check all databases to find the user
    const adminDb = client.db('admin');
    const dbs = await adminDb.admin().listDatabases();
    
    for (let dbInfo of dbs.databases) {
      const db = client.db(dbInfo.name);
      
      // Look for a users collection
      const collections = await db.listCollections().toArray();
      const hasUsers = collections.some(c => c.name === 'users' || c.name === 'Users');
      
      if (hasUsers) {
        const users = db.collection('users');
        const user = await users.findOne({ email: 'corporatesecurity@softrateglobal.com' });
        
        if (user) {
          console.log(`Found user in db: ${dbInfo.name}`);
          console.log('Current user:', JSON.stringify(user, null, 2));
          
          const result = await users.updateOne(
            { _id: user._id },
            { $set: { role: 'crm_admin' } }
          );
          
          console.log('Update result:', result);
          return;
        }
      }
    }
    console.log('User not found in any database.');
  } finally {
    await client.close();
  }
}

main().catch(console.error);
