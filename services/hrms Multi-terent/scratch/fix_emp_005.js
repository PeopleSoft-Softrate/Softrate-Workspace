const mongoose = require('mongoose');
require('dotenv').config({ path: __dirname + '/../.env' });

async function fixWebAccess() {
  try {
    const connection = await mongoose.createConnection(process.env.MONGO_URI).asPromise();
    const db = connection.useDb('hrdb_softrateglobalcom');
    
    const empCollection = db.collection('employees');
    const targetEmail = "yovel2911@gmail.com";

    await empCollection.updateOne(
      { email: targetEmail },
      { $set: { webAccess: true } }
    );
    console.log(`✅ Fixed webAccess for ${targetEmail}`);

    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

fixWebAccess();
