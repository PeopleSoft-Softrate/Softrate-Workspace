const mongoose = require('mongoose');

async function test() {
  try {
    await mongoose.connect('mongodb+srv://peoplesoft_db_user:OznQn0BetkMYfHO1@peoplesoft.xfh0vqd.mongodb.net/hrdb_master');
    const Company = mongoose.connection.collection('companies');
    const company = await Company.findOne({}); // Get the first company
    console.log("Company Name:", company.name);
    console.log("Leave Policies:", JSON.stringify(company.leavePolicies, null, 2));
    console.log("Settings Leave Policies:", JSON.stringify(company.settings?.leavePolicies, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    mongoose.disconnect();
  }
}
test();
