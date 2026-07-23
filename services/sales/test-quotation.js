const mongoose = require('mongoose');
require('dotenv').config({ path: './.env' });
const Quotation = require('./models/Quotation');

async function testQuotation() {
  await mongoose.connect(process.env.MONGO_URI);
  
  const quotation = await Quotation.findOne({ clientId: 'CL1000' }).sort({ createdAt: -1 }).lean();
  if (quotation) {
    console.log('Latest quotation for CL1000:', quotation.quotationNumber);
    console.log('Latest quotation clientSnapshot:', quotation.clientSnapshot);
  } else {
    console.log('No quotations found for CL1000');
  }
  
  process.exit(0);
}
testQuotation();
