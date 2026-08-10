const mongoose = require('mongoose');
mongoose.connect('mongodb+srv://peoplesoft_db_user:xVttah0M8dAZHr69@cluster0.lztsvhx.mongodb.net/STP-1603-2026')
  .then(async () => {
    const db = mongoose.connection.db;
    const items = await db.collection('deals').find({ dealName: { $regex: /eCommerce Website/i } }).toArray();
    console.log(JSON.stringify(items, null, 2));
    const historyLogs = await db.collection('histories').find({ action: 'Pipeline Stage Changed' }).limit(5).toArray();
    console.log("HISTORY LOGS:");
    console.log(JSON.stringify(historyLogs, null, 2));
    process.exit(0);
  });
