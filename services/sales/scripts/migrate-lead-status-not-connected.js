require('../loadEnv');
const mongoose = require('mongoose');

// Connect to MongoDB
const dbUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/softrate_sales';
mongoose.connect(dbUri).then(() => console.log('MongoDB connected'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

const Lead = require('../models/Lead');
const User = require('../models/User');

const OLD_STATUSES = ['DNP / Not Reachable', 'Busy', 'Switch off', 'Switch Off', 'Dnp', 'Not Reachable', 'Dnp/ not reachable'];
const NEW_STATUS = 'Not Connected';

async function migrateStatuses() {
  try {
    console.log('--- Starting Data Migration: Consolidation to "Not Connected" ---');

    // 1. Update Lead documents
    console.log(`\nMigrating Lead statuses...`);
    const leadResult = await Lead.updateMany(
      { status: { $in: OLD_STATUSES } },
      { $set: { status: NEW_STATUS } }
    );
    console.log(`Leads matched: ${leadResult.matchedCount}, modified: ${leadResult.modifiedCount}`);

    // 2. Update User (Tenant/Company Settings) documents
    console.log(`\nMigrating User (Company Settings) statuses...`);
    
    // First, remove old statuses
    let userResult = await User.updateMany(
      {},
      { 
        $pullAll: { 
          leadStatuses: OLD_STATUSES,
          dnpPageStatuses: OLD_STATUSES
        } 
      }
    );
    console.log(`Users updated (pulled old statuses): ${userResult.modifiedCount}`);

    // Second, add the new status
    userResult = await User.updateMany(
      {},
      {
        $addToSet: {
          leadStatuses: NEW_STATUS,
          dnpPageStatuses: NEW_STATUS
        }
      }
    );
    console.log(`Users updated (added 'Not Connected'): ${userResult.modifiedCount}`);

    console.log('\n--- Migration Complete ---');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrateStatuses();
