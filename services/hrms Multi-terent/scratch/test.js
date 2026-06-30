const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

console.log('Testing mongoose default connection...');
const conn = mongoose.connection;
console.log('ReadyState:', conn.readyState);
