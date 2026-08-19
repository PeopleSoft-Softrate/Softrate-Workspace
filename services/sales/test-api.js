const mongoose = require('mongoose');
const User = require('./models/User');

async function run() {
  await mongoose.connect('mongodb://localhost:27017/softrate');
  
  const user = await User.findOne({ 'proposalTemplates.0': { $exists: true } }, 'companyCode proposalTemplates._id');
  if (!user) {
    console.log('No templates found.');
    process.exit(0);
  }
  
  const companyCode = user.companyCode;
  const id = user.proposalTemplates[0]._id;
  console.log(`Testing companyCode=${companyCode}, templateId=${id}`);
  
  console.time('DB Query Time');
  const result = await User.findOne(
    { companyCode, 'proposalTemplates._id': id },
    { 'proposalTemplates.$': 1 }
  ).lean();
  console.timeEnd('DB Query Time');
  
  console.log('Found template ID:', result.proposalTemplates[0]._id);
  
  process.exit(0);
}
run();
