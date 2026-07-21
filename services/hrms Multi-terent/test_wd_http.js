const path = require('path');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
dotenv.config();

async function testHttp() {
  try {
    const { getMasterConnection } = require('./db');
    const User = require('./models/User'); // wait, User is proxy too? We can just sign a token directly if we know the secret!
    
    // sign a dummy token
    const token = jwt.sign(
      { user: { id: "650000000000000000000000", companyId: "650000000000000000000000", role: "admin" } },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '1h' }
    );
    
    const response = await fetch('http://localhost:5001/api/walkin-drives', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    console.log("Status:", response.status);
    const body = await response.text();
    console.log("Body:", body);
    
    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}
testHttp();
