require('dotenv').config();
const mongoose = require('mongoose');
const Intern = require('./models/Intern');
const Employee = require('./models/EmployeeModel');
const AuthController = require('./controllers/AuthController');

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const req = {
    body: {
      identifier: 'yovel4002@gmail.com',
      password: 'password123' // Fake password to trigger the hash check and potentially fail, but we just want to see the role assignment before password check.
    }
  };
  
  const res = {
    status: (code) => {
      console.log("Status:", code);
      return {
        json: (data) => {
          console.log("JSON:", data);
          process.exit(0);
        }
      };
    },
    json: (data) => {
      console.log("JSON:", data);
      process.exit(0);
    }
  };
  
  await AuthController.login(req, res);
});
