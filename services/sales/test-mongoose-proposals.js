const mongoose = require('mongoose');
mongoose.connect('mongodb://localhost:27017/softrate_record').then(async () => {
  const User = require('./src/modules/auth/user.model') || require('./src/modules/auth/models/User') || require('./src/modules/auth/user');
  // I need to find the exact path
});
