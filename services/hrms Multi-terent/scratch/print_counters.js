require('dotenv').config({ path: '../.env' });
const { getMasterConnection, waitForConnection } = require('../db');
async function run() {
  const masterDb = getMasterConnection();
  await waitForConnection(masterDb);
  const db = masterDb.useDb('hrdb_softrateglobalcom', { useCache: true });
  const counters = await db.collection('leavecounters').find({ employeeId: '251001' }).toArray();
  console.log(JSON.stringify(counters, null, 2));
  process.exit(0);
}
run();
