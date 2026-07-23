const mongoose = require('mongoose');
require('dotenv').config({ path: './.env' });
const Client = require('./models/Client');
const Invoice = require('./models/Invoice');

async function testClient1000() {
  await mongoose.connect(process.env.MONGO_URI);
  
  const client = await Client.findOne({ clientId: 'CL1000' }).lean();
  if (!client) { console.log('Client CL1000 not found'); process.exit(1); }

  console.log('Client CL1000 GST in DB:', client.gstNumber);

  const invoice = await Invoice.findOne({ clientId: 'CL1000' }).sort({ createdAt: -1 }).lean();
  if (invoice) {
    console.log('Latest invoice for CL1000:', invoice.invoiceNumber);
    console.log('Latest invoice clientSnapshot:', invoice.clientSnapshot);
  } else {
    console.log('No invoices found for CL1000');
  }
  
  process.exit(0);
}
testClient1000();
