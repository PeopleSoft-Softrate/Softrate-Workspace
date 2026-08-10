const mongoose = require('mongoose');
mongoose.connect('mongodb+srv://peoplesoft_db_user:xVttah0M8dAZHr69@cluster0.lztsvhx.mongodb.net/')
  .then(async () => {
    const db = mongoose.connection.db;
    const items = await db.collection('leads').find({ leadCompanyName: { $regex: /^SURYA SRI MANYAM PRODUCTS/i } }).toArray();
    console.log(Object.keys(items[0]));
    process.exit(0);
  });
