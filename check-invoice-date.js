const mongoose = require('mongoose');
require('dotenv').config({ path: './services/sales/.env' });

async function check() {
  await mongoose.connect(process.env.MONGO_URI);
  const Invoice = require('./services/sales/models/Invoice');
  const invoice = await Invoice.findOne({ clientId: 'CL-2607-0004' }).sort({ createdAt: -1 }).lean();
  console.log('Latest Invoice Created At:', invoice.createdAt);
  console.log('Latest Invoice GST:', invoice.clientSnapshot.gstNumber);
  console.log('Now:', new Date());
  process.exit(0);
}
check();
