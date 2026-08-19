require('dotenv').config({ path: '../../.env' });
const mongoose = require('mongoose');
const url = process.env.MONGO_URI || "mongodb://localhost:27017/salesdb_stp_1603_2026";
mongoose.connect(url).then(async () => {
  const invoice = await mongoose.connection.collection('invoices').findOne({ paymentStatus: { $ne: null } });
  console.log("Keys of an invoice:");
  console.dir(Object.keys(invoice), { depth: null });
  console.dir({ paymentStatus: invoice.paymentStatus, status: invoice.status, amountPaid: invoice.amountPaid, advancePaid: invoice.advancePaid, paidAmount: invoice.paidAmount }, { depth: null });
  process.exit(0);
});
