require('dotenv').config();
const mongoose = require('mongoose');
const Intern = require('./models/Intern');
const Employee = require('./models/EmployeeModel');

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    const interns = await Intern.find({ email: 'yovel4002@gmail.com' });
    console.log("Interns:", interns.map(i => ({ email: i.email, status: i.status })));
    
    const employees = await Employee.find({ email: 'yovel4002@gmail.com' });
    console.log("Employees:", employees.map(e => ({ email: e.email, status: e.status })));
    
    process.exit(0);
  });
