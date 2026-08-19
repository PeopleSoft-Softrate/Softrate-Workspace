const mongoose = require('mongoose');
const uri = "mongodb+srv://peoplesoft_db_user:xVttah0M8dAZHr69@cluster0.lztsvhx.mongodb.net/salesdb_stp_1603_2026";
async function run() {
  console.time('Connect');
  const conn = await mongoose.createConnection(uri).asPromise();
  console.timeEnd('Connect');
  
  const Invoice = conn.model('Invoice', new mongoose.Schema({}, {strict: false}), 'invoices');
  
  console.time('Query 1');
  await Invoice.find({ companyCode: 'STP-1603-2026' }).sort({ invoiceDate: -1, createdAt: -1 }).lean();
  console.timeEnd('Query 1');

  console.time('Query 2');
  await Invoice.find({}).sort({ invoiceDate: -1, createdAt: -1 }).lean();
  console.timeEnd('Query 2');

  conn.close();
}
run().catch(console.error);
