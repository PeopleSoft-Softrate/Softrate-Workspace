require('dotenv').config({ path: '../../.env' });
const mongoose = require('mongoose');
const url = process.env.MONGO_URI || "mongodb://localhost:27017/salesdb_stp_1603_2026";
mongoose.connect(url).then(async () => {
  const payments = await mongoose.connection.collection('crmpayments').find({ invoiceNumber: "Invoice_2607003_v1" }).toArray();
  console.log("Payments for Invoice_2607003_v1:");
  console.dir(payments, { depth: null });
  process.exit(0);
});
