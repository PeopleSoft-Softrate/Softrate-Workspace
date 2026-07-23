const mongoose = require('mongoose');
require('dotenv').config({ path: './.env' });
const Client = require('./models/Client');
const Lead = require('./models/Lead');
const { ensureClientForLead, mapClient } = require('./services/clientService');

async function testInvoiceGen() {
  await mongoose.connect(process.env.MONGO_URI);
  
  const lead = await Lead.findOne({ leadCompanyName: 'KEVS INFRASTRUCTURE PRIVATE LIMITED' }).sort({ createdAt: -1 });
  if (!lead) { console.log('Lead not found'); process.exit(1); }

  console.log('Lead found:', lead._id);
  
  const client = await ensureClientForLead(lead);
  console.log('Client from ensureClientForLead GST:', client.gstNumber);

  const clientDto = mapClient(client);
  console.log('Client DTO GST:', clientDto.gstNumber);
  
  process.exit(0);
}
testInvoiceGen();
