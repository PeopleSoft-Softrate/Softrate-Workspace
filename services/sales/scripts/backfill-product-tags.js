require('../loadEnv');
const mongoose = require('mongoose');
const User = require('../models/User');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/softrate_record';

async function backfillProductTags() {
  await mongoose.connect(MONGO_URI);

  const users = await User.find({ products: { $exists: true, $ne: [] } });
  let updated = 0;

  for (const user of users) {
    let changed = false;
    user.products = (user.products || []).map((product) => {
      if (!Array.isArray(product.tags)) {
        product.tags = [];
        changed = true;
      }
      return product;
    });

    if (changed) {
      await user.save();
      updated += 1;
    }
  }

  console.log(`Backfilled product tags for ${updated} companies.`);
  await mongoose.disconnect();
}

backfillProductTags().catch(async (error) => {
  console.error('[backfill product tags]', error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
