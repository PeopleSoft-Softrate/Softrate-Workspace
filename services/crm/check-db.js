const mongoose = require('mongoose');
const Client = require('./models/Client');
require('dotenv').config({ path: './.env' });

async function check() {
  await mongoose.connect(process.env.MONGO_URI);
  const client = await Client.findOne({ _id: '6a48f9966129139cb161d023' });
  console.log('Client GST in DB:', client.gstNumber);
  console.log('Client Address in DB:', client.address);
  console.log('Client Email in DB:', client.primaryEmail);
  process.exit(0);
}
check();
