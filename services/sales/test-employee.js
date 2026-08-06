require('dotenv').config();
const mongoose = require('mongoose');
const Employee = require('./models/Employee');

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    const emp = await Employee.findOne({ companyCode: "STP-1603-2026" });
    if (!emp) {
      console.log("No employee found");
    } else {
      console.log("Employee found:", emp.name, emp.mobile, emp.allowedCompanies);
    }
    process.exit(0);
  });
