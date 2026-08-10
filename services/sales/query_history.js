const mongoose = require('mongoose');
mongoose.connect('mongodb+srv://peoplesoft_db_user:xVttah0M8dAZHr69@cluster0.lztsvhx.mongodb.net/')
  .then(async () => {
    const db = mongoose.connection.db;
    const items = await db.collection('histories').find({ companyName: { $regex: /^SURYA SRI MANYAM PRODUCTS/i } }).toArray();
    console.log(JSON.stringify(items, null, 2));
    process.exit(0);
  });
