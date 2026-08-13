require('./loadEnv');
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const Lead = require('./models/Lead');
  
  const res = await Lead.aggregate([
    { $limit: 100 },
    { 
      $group: { 
        _id: '$leadCompanyName', 
        spocStatuses: { 
          $push: { $cond: [{ $eq: ['$isStarred', true] }, '$status', null] } 
        },
        allStatuses: { $push: '$status' }
      } 
    },
    {
      $project: {
        spocStatuses: {
          $filter: {
            input: '$spocStatuses',
            as: 'status',
            cond: { $ne: ['$$status', null] }
          }
        },
        allStatuses: 1
      }
    },
    {
      $project: {
        effectiveStatuses: {
          $cond: [
            { $gt: [{ $size: '$spocStatuses' }, 0] },
            '$spocStatuses',
            '$allStatuses'
          ]
        }
      }
    },
    { $limit: 2 }
  ]);
  
  console.log(JSON.stringify(res, null, 2));
  process.exit(0);
});
