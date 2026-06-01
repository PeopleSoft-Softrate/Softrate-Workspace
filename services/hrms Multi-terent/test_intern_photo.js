require('dotenv').config();
const mongoose = require('mongoose');
const Intern = require('./models/Intern');

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    const interns = await Intern.find().limit(1);
    console.log(interns[0].profilePhoto);
    process.exit(0);
  });
