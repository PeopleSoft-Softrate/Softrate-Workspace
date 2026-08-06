require('dotenv').config();
const mongoose = require('mongoose');

async function checkToken() {
  try {
    const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/softrate_record';
    await mongoose.connect(uri);
    
    const EmailConnection = require('./src/modules/email/model/email-connection.model');
    const connections = await EmailConnection.find({ connected: true }).lean();
    
    console.log('Connections found:', connections.length);
    for (const conn of connections) {
      console.log(`Company: ${conn.companyCode}, User: ${conn.userId}, Email: ${conn.email}`);
      console.log(`Refresh Token Present: ${!!conn.refreshToken}, Length: ${conn.refreshToken.length}`);
      
      if (conn.refreshToken) {
        try {
          const { decrypt } = require('./src/modules/email/service/email.service');
          const decrypted = decrypt(conn.refreshToken);
          console.log(`Decrypted Token Length: ${decrypted.length}, Starts with: ${decrypted.substring(0, 5)}...`);
        } catch (e) {
          console.log('Decryption failed:', e.message);
        }
      }
    }

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

checkToken();
