require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const ProposalTemplate = require('../models/ProposalTemplate');

async function migrate() {
  try {
    const MONGO_URI = process.env.MONGO_URI;
    console.log('Connecting to MongoDB Atlas...');
    await mongoose.connect(MONGO_URI);
    console.log('Connected.');
    
    // Find users with proposal templates directly
    console.log('Querying users...');
    const users = await User.find({ 'proposalTemplates.0': { $exists: true } }).lean();
    console.log(`Found ${users.length} users with proposal templates to migrate.`);
    
    let totalMigrated = 0;
    
    for (const user of users) {
      const templates = user.proposalTemplates || [];
      if (templates.length === 0) continue;
      
      console.log(`Migrating ${templates.length} templates for company: ${user.companyCode}`);
      
      const bulkOps = templates.map(t => {
         const doc = {
            _id: t._id || require('crypto').randomUUID(),
            companyCode: user.companyCode,
            name: t.name,
            pages: t.pages,
            createdAt: t.createdAt || new Date(),
            updatedAt: t.updatedAt || new Date()
         };
         
         return {
            updateOne: {
               filter: { _id: doc._id },
               update: { $set: doc },
               upsert: true
            }
         };
      });
      
      await ProposalTemplate.bulkWrite(bulkOps);
      totalMigrated += templates.length;
    }
    
    console.log(`Migration complete! Successfully migrated ${totalMigrated} templates.`);
    
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }
}

migrate();
