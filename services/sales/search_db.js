const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config({ path: '/Users/yovelr/Softrate/softrate-workspace/Softrate-Workspace/services/sales/.env' });

async function check() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to DB');

    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    let found = false;

    for (let c of collections) {
        const collection = db.collection(c.name);
        
        // Search in all text fields if we created a text index, but we don't have that.
        // Instead, let's just find any document where JSON.stringify has the string
        // This is slow, but fine for a small DB.
        
        const docs = await collection.find({}).toArray();
        for (let doc of docs) {
            const str = JSON.stringify(doc);
            if (str.includes('WEE-0306-2026')) {
                console.log(`\n--- FOUND IN COLLECTION: ${c.name} ---`);
                console.log(JSON.stringify(doc, null, 2));
                found = true;
            }
        }
    }
    
    if (!found) {
        console.log('\nCould not find "WEE-0306-2026" anywhere in the database.');
    }

  } catch (err) {
    console.error(err);
  } finally {
    mongoose.disconnect();
  }
}

check();
