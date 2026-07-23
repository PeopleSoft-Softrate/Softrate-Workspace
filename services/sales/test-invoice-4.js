const mongoose = require('mongoose');
require('dotenv').config({ path: './.env' });
const Invoice = require('./models/Invoice');

async function testInvoiceGen() {
  await mongoose.connect(process.env.MONGO_URI);
  
  const invoice = await Invoice.findOne({ invoiceNumber: 'Invoice_2607002_v3' }).lean();
  if (!invoice) { console.log('Not found'); process.exit(1); }

  console.log('Invoice date:', invoice.createdAt);
  console.log('Invoice clientSnapshot:', invoice.clientSnapshot);
  
  process.exit(0);
}
testInvoiceGen();
