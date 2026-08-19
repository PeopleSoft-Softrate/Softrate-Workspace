require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const companyCode = 'STP-1603-2026';
  const id = 'b1301d26-39c3-4a22-a45d-084d45d7212a';
  
  mongoose.set('debug', true);
  
  console.time('Query');
  const result = await User.findOne(
    { companyCode, 'proposalTemplates._id': id },
    { 'proposalTemplates.$': 1 }
  ).lean();
  console.timeEnd('Query');
  
  console.log('Result payload length:', JSON.stringify(result).length);
  process.exit(0);
}
run();
