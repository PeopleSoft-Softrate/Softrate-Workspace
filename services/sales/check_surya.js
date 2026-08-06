const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config({ path: '/Users/yovelr/Softrate/softrate-workspace/Softrate-Workspace/services/sales/.env' });

async function run() {
  try {
    // Connect to the specific tenant DB
    const uri = process.env.MONGO_URI.replace(/\/[^\/]*\?/, '/salesdb_wee_0306_2026?');
    console.log('Connecting to:', uri);
    await mongoose.connect(uri);
    console.log('Connected');

    const db = mongoose.connection.db;
    const leads = await db.collection('leads').find({
      leadCompanyNameLower: /surya/i
    }).toArray();

    console.log(`Found ${leads.length} leads:`);
    console.log(JSON.stringify(leads, null, 2));

  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}

run();
