require('../loadEnv');
const mongoose = require('mongoose');
const User = require('../models/User');

async function run() {
  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      console.error('Error: MONGO_URI not set in environment.');
      process.exit(1);
    }

    console.log(`Connecting to MongoDB (master)...`);
    await mongoose.connect(mongoUri);
    console.log('Connected to master DB.');

    const users = await User.find({});
    console.log(`Found ${users.length} tenants (Users).`);

    let totalUpdated = 0;

    for (const user of users) {
      let modified = false;

      if (user.leadStatuses && user.leadStatuses.includes('Details Shared')) {
        user.leadStatuses = user.leadStatuses.filter(s => s !== 'Details Shared' && s !== 'Detail Share');
        modified = true;
      }
      
      if (user.interestedPageStatuses && user.interestedPageStatuses.includes('Details Shared')) {
        user.interestedPageStatuses = user.interestedPageStatuses.filter(s => s !== 'Details Shared' && s !== 'Detail Share');
        modified = true;
      }

      if (modified) {
        await user.save();
        totalUpdated++;
      }
    }

    console.log(`Migration completed successfully. Total Users updated: ${totalUpdated}`);
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

run();
