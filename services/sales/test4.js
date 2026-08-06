require('dotenv').config();
const mongoose = require('mongoose');
const Employee = require('./models/Employee');

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    let emp = await Employee.findByIdAndUpdate("69f981e2365234ec9c7bed35", { $set: { allowedCompanies: ["WEE-0306-2026"] } }, { returnDocument: 'after' });
    console.log("Updated via mongoose:", emp.allowedCompanies);
    
    emp = await Employee.findById("69f981e2365234ec9c7bed35");
    console.log("Read via mongoose:", emp.allowedCompanies);
    process.exit(0);
  });
