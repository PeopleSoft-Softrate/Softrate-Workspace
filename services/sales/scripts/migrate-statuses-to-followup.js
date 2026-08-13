require('../loadEnv');
const mongoose = require('mongoose');
const Lead = require('../models/Lead');
const User = require('../models/User');

async function run() {
  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      console.error('Error: MONGO_URI not set in environment.');
      process.exit(1);
    }

    console.log(`Connecting to MongoDB...`);
    await mongoose.connect(mongoUri);
    console.log('Connected.');

    console.log('Updating Leads...');
    const leadResult = await Lead.updateMany(
      { status: { $in: ['Future Needs', 'Call Later'] } },
      { $set: { status: 'Follow Up' } }
    );
    console.log(`Updated ${leadResult.modifiedCount} Leads.`);

    console.log('Updating User status lists...');
    const users = await User.find({});
    let usersUpdated = 0;

    for (const user of users) {
      let changed = false;

      // Migrate leadStatuses
      if (user.leadStatuses && user.leadStatuses.length) {
        const statuses = user.leadStatuses;
        const mapped = statuses.map(s => (s === 'Future Needs' || s === 'Call Later') ? 'Follow Up' : s);
        const unique = [...new Set(mapped)];
        if (unique.length !== statuses.length || statuses.some(s => s === 'Future Needs' || s === 'Call Later')) {
          user.leadStatuses = unique;
          changed = true;
        }
      }

      if (changed) {
        await user.save();
        usersUpdated++;
      }
    }
    console.log(`Updated custom status arrays for ${usersUpdated} Users.`);

    console.log('Migration completed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

run();
