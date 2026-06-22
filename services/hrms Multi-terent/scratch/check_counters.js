require('dotenv').config({ path: '../.env' });
const { getTenantConnection, waitForConnection } = require('../db');

async function check() {
  const tenantDb = getTenantConnection('hrdb_softrateglobalcom');
  await waitForConnection(tenantDb);
  const counters = await tenantDb.db.collection('leavecounters').find({ employeeId: '262004' }).toArray();
  console.log('Counters for 262004:', counters);
  process.exit(0);
}
check().catch(console.error);
