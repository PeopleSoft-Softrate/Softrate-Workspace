const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config({ path: '/Users/yovelr/Softrate/softrate-workspace/Softrate-Workspace/services/sales/.env' });

async function check() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to DB');

    // Get collections
    const db = mongoose.connection.db;
    
    const invoice = await db.collection('invoices').findOne({ invoiceNumber: 'WEE-0306-2026' });
    if (invoice) {
      console.log('--- FOUND INVOICE ---');
      console.log(JSON.stringify(invoice, null, 2));
    } else {
      console.log('Invoice WEE-0306-2026 not found.');
    }

    const quotation = await db.collection('quotations').findOne({ quotationNumber: 'WEE-0306-2026' });
    if (quotation) {
      console.log('--- FOUND QUOTATION ---');
      console.log(JSON.stringify(quotation, null, 2));
    } else {
      console.log('Quotation WEE-0306-2026 not found.');
    }
    
    // Also check generic docs just in case the field is different
    const anyDoc = await db.collection('invoices').findOne({ $or: [{ number: 'WEE-0306-2026' }, { invoiceId: 'WEE-0306-2026' }] });
    if (anyDoc) {
        console.log('--- FOUND INVOICE (other field) ---');
        console.log(JSON.stringify(anyDoc, null, 2));
    }

  } catch (err) {
    console.error(err);
  } finally {
    mongoose.disconnect();
  }
}

check();
