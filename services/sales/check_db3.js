const mongoose = require('mongoose');
const Lead = require('./models/Lead');

mongoose.connect('mongodb://127.0.0.1:27017/softrate')
.then(async () => {
  const total = await Lead.countDocuments();
  console.log('Total leads in DB:', total);
  
  const stages = await Lead.aggregate([
    { $group: { _id: '$pipelineStage', count: { $sum: 1 } } }
  ]);
  console.log('Pipeline stages distribution:', stages);
  
  process.exit(0);
});
