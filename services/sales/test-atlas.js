require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to Atlas.');
  
  const user = await User.findOne({ 'proposalTemplates.0': { $exists: true } }, 'companyCode proposalTemplates._id');
  if (!user) {
    console.log('No templates found.');
    process.exit(0);
  }
  
  const companyCode = user.companyCode;
  const id = user.proposalTemplates[0]._id;
  console.log(`Testing companyCode=${companyCode}, templateId=${id}`);
  
  console.time('DB Query Time (Atlas)');
  const result = await User.findOne(
    { companyCode, 'proposalTemplates._id': id },
    { 'proposalTemplates.$': 1 }
  ).lean();
  console.timeEnd('DB Query Time (Atlas)');
  
  const size = JSON.stringify(result).length;
  console.log(`Payload size: ${(size / 1024 / 1024).toFixed(2)} MB`);
  
  process.exit(0);
}
run();
