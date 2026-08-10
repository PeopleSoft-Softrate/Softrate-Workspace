const mongoose = require('mongoose');
mongoose.connect('mongodb+srv://peoplesoft_db_user:xVttah0M8dAZHr69@cluster0.lztsvhx.mongodb.net/')
  .then(async () => {
    const History = mongoose.model('History', new mongoose.Schema({}, { strict: false }));
    const companyCode = 'STP-1603-2026';
    const companyName = 'SURYA SRI MANYAM PRODUCTS (OPC) PRIVATE LIMITED';
    const query = { companyCode, companyName };
    const logs = await History.find(query).sort({ timestamp: -1, createdAt: -1 });
    console.log(`Found ${logs.length} logs for companyName: ${companyName}`);
    process.exit(0);
  });
