const mongoose = require('mongoose');
require('dotenv').config({ path: './.env' });
const Invoice = require('./models/Invoice');

async function testAllInvoices() {
  await mongoose.connect(process.env.MONGO_URI);
  
  const invoices = await Invoice.find().sort({ createdAt: -1 }).limit(5).lean();
  console.log('Last 5 invoices:');
  invoices.forEach(inv => {
    console.log(`- ${inv.invoiceNumber} | publicToken: ${inv.publicToken} | publicUrl: ${inv.publicUrl}`);
  });
  
  process.exit(0);
}
testAllInvoices();
