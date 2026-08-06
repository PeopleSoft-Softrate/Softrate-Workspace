require('dotenv').config();
const mongoose = require('mongoose');
const Employee = require('./models/Employee');

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    const employees = await Employee.find({ companyCode: "STP-1603-2026" }).sort({ createdAt: -1 });
    console.log("Employees length:", employees.length);
    employees.forEach(emp => {
      console.log(emp.name, emp.mobile, "Allowed:", emp.allowedCompanies);
    });
    process.exit(0);
  });
