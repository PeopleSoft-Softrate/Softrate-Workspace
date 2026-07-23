const mongoose = require('mongoose');
require('dotenv').config({ path: './.env' });
const Client = require('./models/Client');

async function checkClient() {
  await mongoose.connect(process.env.MONGO_URI);
  const client = await Client.findOne({ clientId: 'CL1000' }).lean();
  console.log(client);
  process.exit(0);
}
checkClient();
