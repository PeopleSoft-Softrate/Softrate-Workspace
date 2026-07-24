const mongoose = require('mongoose');
mongoose.connect('mongodb://localhost:27017/softrate_sales');
const Lead = require('./services/sales/models/Lead');
async function run() {
  const lead = await Lead.findOne({ contactNumber: '918089095941' });
  console.log('Lead found by exact phone:', lead ? lead.directorEmailAddress : 'null');
  
  const lead2 = await Lead.findOne({ contactNumberNormalized: '+918089095941' });
  console.log('Lead found by norm phone:', lead2 ? lead2.directorEmailAddress : 'null');

  const lead3 = await Lead.findOne({ leadCompanyName: /IZABEL/i });
  console.log('Lead found by name:', lead3 ? lead3.directorEmailAddress : 'null');
  
  process.exit(0);
}
run();
