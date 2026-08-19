const mongoose = require('mongoose');
mongoose.connect('mongodb://localhost:27017/softrate_record').then(async () => {
  try {
    const user = await mongoose.connection.db.collection('users').findOne(
      {}, 
      { projection: { 'proposalTemplates.pages.rawPdfBase64': 0 } }
    );
    console.log("Success with MongoDB native Driver projection");
  } catch (e) {
    console.error("Native Error:", e.message);
  }
  process.exit(0);
});
