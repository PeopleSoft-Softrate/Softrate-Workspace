const mongoose = require('mongoose');
const Lead = require('./models/Lead');

mongoose.connect('mongodb://127.0.0.1:27017/softrate')
.then(async () => {
  const leadWithStage = await Lead.findOne({ pipelineStage: { $exists: true, $ne: null } });
  if (leadWithStage) {
    console.log('Found a lead with pipelineStage!');
    console.log('assignedEmployeeId:', leadWithStage.assignedEmployeeId);
    console.log('assignedEmployeeIds:', leadWithStage.assignedEmployeeIds);
  } else {
    console.log('No leads with pipelineStage found at all!');
  }
  process.exit(0);
});
