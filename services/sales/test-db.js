require('dotenv').config();
const mongoose = require('mongoose');
const Lead = require('./models/Lead');
async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const count = await Lead.countDocuments({ pipelineStage: { $ne: null } });
  console.log("Leads with pipelineStage:", count);
  const sample = await Lead.findOne({ pipelineStage: { $ne: null } }).select('companyCode status pipelineStage');
  console.log("Sample lead:", sample);
  process.exit();
}
run();
