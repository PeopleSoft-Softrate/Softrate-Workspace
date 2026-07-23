const mongoose = require('mongoose');
require('dotenv').config({ path: './.env' });
const Invoice = require('./models/Invoice');

// mock req
const req = { headers: { 'x-forwarded-host': 'localhost:4200' } };

function frontendBaseUrl(req) {
  return req.headers['x-forwarded-host'] 
    ? `https://${req.headers['x-forwarded-host']}` 
    : 'http://localhost:4200';
}
function publicInvoiceUrl(req, publicToken) {
  return `${frontendBaseUrl(req)}/invoice/${encodeURIComponent(publicToken || '')}`;
}

async function testSerializer() {
  await mongoose.connect(process.env.MONGO_URI);
  const invoice = await Invoice.findOne({ invoiceNumber: 'Invoice_2607002_v3' }).lean();
  
  if (invoice) {
    const publicToken = invoice.publicToken || '';
    console.log('Public token:', publicToken);
    const url = publicToken ? publicInvoiceUrl(req, publicToken) : '';
    console.log('Public URL:', url);
  } else {
    console.log('Not found');
  }
  process.exit(0);
}
testSerializer();
