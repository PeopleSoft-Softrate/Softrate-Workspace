require('dotenv').config({ path: '../.env' });
const { getTenantConnection, waitForConnection } = require('../db');

async function check() {
  const tenantDb = getTenantConnection('hrdb');
  await waitForConnection(tenantDb);
  const user = await tenantDb.db.collection('employees').findOne({ EmployeeId: '251001' });
  console.log('Employee 251001 in hrdb:', !!user);
  process.exit(0);
}
check().catch(console.error);
