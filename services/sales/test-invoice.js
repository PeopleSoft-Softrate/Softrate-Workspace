const mongoose = require('mongoose');
require('dotenv').config({ path: './.env' });
const Invoice = require('./models/Invoice');
const Client = require('./models/Client');
const Lead = require('./models/Lead');
const invoiceRoutes = require('./src/modules/invoices/invoice.routes');

async function testInvoiceGen() {
  await mongoose.connect(process.env.MONGO_URI);
  const client = await Client.findOne({ clientId: 'CL-2607-0004' });
  if (!client) { console.log('Client not found'); process.exit(1); }

  console.log('Client GST in DB before invoice generation:', client.gstNumber);

  // We need to simulate the POST /api/invoices
  // Or we can just run the logic directly or fetch the latest invoice
  const latestInvoice = await Invoice.findOne({ clientId: 'CL-2607-0004' }).sort({ createdAt: -1 }).lean();
  console.log('Latest invoice:', latestInvoice.invoiceNumber);
  console.log('Latest invoice clientSnapshot:', latestInvoice.clientSnapshot);
  process.exit(0);
}
testInvoiceGen();
