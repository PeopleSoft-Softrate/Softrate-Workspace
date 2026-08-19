const mongoose = require('mongoose');
mongoose.connect('mongodb://localhost:27017/softrate_record').then(async () => {
  const User = require('./models/User');
  try {
    const user = await User.findOne(
      {}, 
      { 'proposalTemplates.pages.rawPdfBase64': 0 }
    ).lean();
    console.log("Success with Mongoose projection", user ? user.companyCode : "null user");
  } catch (e) {
    console.error("Mongoose Error:", e.message);
  }
  process.exit(0);
});
