const mongoose = require('mongoose');
const Client = require('./models/Client');
require('dotenv').config({ path: './.env' });

async function check() {
  await mongoose.connect(process.env.MONGO_URI);
  const client = await Client.findOne({ _id: '6a48f9966129139cb161d023' });
  console.log('Client GST in DB currently:', client.gstNumber);
  const Invoice = require('./models/Invoice');
  const invoices = await Invoice.find({ clientId: client.clientId }).sort({ createdAt: -1 }).limit(1).lean();
  if (invoices.length > 0) {
    console.log('Latest Invoice GST:', invoices[0].clientSnapshot.gstNumber);
  } else {
    console.log('No invoices found for client');
  }
  process.exit(0);
}
check();
