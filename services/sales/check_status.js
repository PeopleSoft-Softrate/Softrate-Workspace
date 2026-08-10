const mongoose = require('mongoose');
const { Lead } = require('./models/Lead');
mongoose.connect('mongodb://localhost:27017/softrate_tenant_db').then(async () => {
  const statuses = await mongoose.connection.db.collection('leads').distinct('status');
  console.log(statuses);
  process.exit(0);
});
