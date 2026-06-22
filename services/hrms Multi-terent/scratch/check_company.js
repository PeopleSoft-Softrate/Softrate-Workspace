require('dotenv').config({ path: '../.env' });
const { getMasterConnection, waitForConnection } = require('../db');
const mongoose = require('mongoose');

async function check() {
  const masterDb = getMasterConnection();
  await waitForConnection(masterDb);
  const comp = await masterDb.db.collection('companies').findOne({ companyCode: 'SOFTRATE' });
  console.log('SOFTRATE company.dbName =', comp.dbName);
  process.exit(0);
}
check().catch(console.error);
