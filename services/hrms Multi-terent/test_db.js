require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const usersWithPhotos = await User.find({ "profilePhoto.data": { $exists: true } }).select('email');
  console.log("Users with photos:", usersWithPhotos.map(u => u.email));
  process.exit(0);
});
