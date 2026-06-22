require('dotenv').config({ path: '../.env' });
const { getMasterConnection, getTenantConnection, waitForConnection } = require('../db');
const mongoose = require('mongoose');

async function cleanup() {
  const masterDb = getMasterConnection();
  await waitForConnection(masterDb);
  const tenantDb = getTenantConnection('hrdb_softrateglobalcom');
  await waitForConnection(tenantDb);
  
  // Remove the test leave just applied
  const result = await tenantDb.db.collection('employeeleaves').deleteOne({ 
    reason: 'Test leave application',
    employeeId: '262004'
  });
  console.log('Deleted test leave:', result.deletedCount, 'docs');
  process.exit(0);
}
cleanup().catch(e => { console.error(e); process.exit(1); });
