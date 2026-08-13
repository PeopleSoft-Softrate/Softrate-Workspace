require('dotenv').config({ path: '../.env' });
const mongoose = require('mongoose');

async function migrate() {
  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error('MONGO_URI is missing');
    }
    
    await mongoose.connect(mongoUri);
    console.log('Connected to DB');

    const User = require('../models/User');

    const users = await User.find({});
    let updatedCount = 0;

    for (const user of users) {
      if (!user.leadStatuses.includes('Closed Lost')) {
        user.leadStatuses.push('Closed Lost');
        await user.save();
        updatedCount++;
      }
    }

    console.log(`Migration complete. Added 'Closed Lost' to ${updatedCount} users.`);
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrate();
