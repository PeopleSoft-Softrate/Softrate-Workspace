const mongoose = require('mongoose');
const User = require('./services/sales/models/User');

async function run() {
  await mongoose.connect('mongodb://localhost:27017/softrate');
  console.log('Connected.');
  
  console.time('findUser');
  const user = await User.findOne({ 'proposalTemplates': { $exists: true, $not: { $size: 0 } } }, 'companyCode proposalTemplates._id');
  console.timeEnd('findUser');
  
  if (!user) {
    console.log('No user with proposal templates found.');
    return process.exit(0);
  }
  
  const companyCode = user.companyCode;
  const id = user.proposalTemplates[0]._id;
  console.log(`Found: company=${companyCode}, templateId=${id}`);
  
  console.time('fetchTemplate');
  const user2 = await User.findOne(
    { companyCode, 'proposalTemplates._id': id },
    { 'proposalTemplates.$': 1 }
  ).lean();
  console.timeEnd('fetchTemplate');
  
  console.log('Template pages length:', user2.proposalTemplates[0].pages?.length);
  process.exit(0);
}
run();
