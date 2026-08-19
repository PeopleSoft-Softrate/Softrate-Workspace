const mongoose = require('mongoose');
mongoose.connect('mongodb://localhost:27017/softrate_record').then(async () => {
  const User = require('./services/sales/models/User');
  try {
    const user = await User.findOne(
      {}, 
      { 'proposalTemplates.pages.rawPdfBase64': 0 }
    ).lean();
    console.log("Success");
  } catch (e) {
    console.error("Error:", e.message);
  }
  process.exit(0);
});
