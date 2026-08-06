require('dotenv').config();
const mongoose = require('mongoose');
const Employee = require('./models/Employee');

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    const emp = await Employee.findOne({ name: "Yovel Testing" });
    console.log(emp._id.toString());
    process.exit(0);
  });
