const mongoose = require('mongoose');
require('dotenv').config({ path: './.env' });
const Client = require('./models/Client');
const { mapClient } = require('./services/clientService');

async function testInvoiceGen() {
  await mongoose.connect(process.env.MONGO_URI);
  
  const client = await Client.findOne({ clientId: 'CL-2607-0004' });
  if (!client) { console.log('Client not found'); process.exit(1); }

  console.log('Client GST directly from DB:', client.gstNumber);

  const clientDto = mapClient(client);
  console.log('Client DTO GST:', clientDto.gstNumber);
  
  process.exit(0);
}
testInvoiceGen();
