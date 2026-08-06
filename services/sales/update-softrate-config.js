const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');

dotenv.config();

async function updateSoftrateConfig() {
  console.log('🔄 Connecting to database...');
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ Connected.');

  const companyCode = 'STP-1603-2026';
  
  const user = await User.findOne({ companyCode });
  if (!user) {
    console.error(`❌ User with companyCode ${companyCode} not found!`);
    process.exit(1);
  }
  
  const apiKey = process.env.RESEND_API_KEY_CLIENT_MAIL;
  let domain = process.env.RESEND_SENDER_DOMAIN || 'support.softrateglobal.com';
  if (domain.includes('@')) {
    domain = domain.split('@')[1];
  }
  
  // Update the database record
  user.resendApiKey = apiKey;
  user.resendSenderDomain = domain;
  
  await user.save();
  console.log(`✅ Successfully updated the Admin Database for ${user.companyName}!`);
  console.log(`   - API Key: ${apiKey}`);
  console.log(`   - Domain: ${domain}`);
  
  await mongoose.disconnect();
  console.log('🏁 Done.');
}

updateSoftrateConfig().catch(console.error);
