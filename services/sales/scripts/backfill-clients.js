require('../loadEnv');
const mongoose = require('mongoose');
const Lead = require('../models/Lead');
const User = require('../models/User');
const { ensureClientForLead } = require('../services/clientService');

async function main() {
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/softrate_record';
  await mongoose.connect(mongoUri);

  const companies = await User.find({}, 'companyCode convertedPageStatuses').lean();
  let createdOrUpdated = 0;

  for (const company of companies) {
    const statuses = Array.isArray(company.convertedPageStatuses) && company.convertedPageStatuses.length
      ? company.convertedPageStatuses
      : ['Converted'];
    const leads = await Lead.find({
      companyCode: company.companyCode,
      isArchived: { $ne: true },
      $or: [
        { status: { $in: statuses } },
        { status: { $regex: /convert/i } },
      ],
    });

    for (const lead of leads) {
      const client = await ensureClientForLead(lead);
      if (client) createdOrUpdated += 1;
    }
  }

  console.log(`Backfilled onboarded clients from ${createdOrUpdated} converted lead records.`);
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('Client backfill failed:', err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
