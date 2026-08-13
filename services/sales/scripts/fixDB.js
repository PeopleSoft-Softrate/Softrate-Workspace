require('../loadEnv');
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const User = require('../models/User');
  const res = await User.updateMany(
    { leadStatuses: { $size: 1, $all: ['Not Connected'] } },
    { $unset: { leadStatuses: '', dnpPageStatuses: '' } }
  );
  console.log('Fixed users:', res.modifiedCount);
  process.exit(0);
});
