const mongoose = require('mongoose');
mongoose.connect('mongodb+srv://peoplesoft_db_user:xVttah0M8dAZHr69@cluster0.lztsvhx.mongodb.net/')
  .then(async () => {
    const db = mongoose.connection.db;
    const lead = await db.collection('leads').findOne({ leadCompanyName: { $regex: /SURYA SRI MANYAM/i } });
    console.log(JSON.stringify(lead, null, 2));
    process.exit(0);
  });
