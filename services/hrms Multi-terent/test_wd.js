const dotenv = require('dotenv');
dotenv.config();

async function test() {
  const { getTenantConnection, waitForConnection } = require('./db');
  const { getModelsForConnection } = require('./utilities/modelLoader');

  const tenantDb = getTenantConnection('hrdb_softrateglobalcom');
  await waitForConnection(tenantDb);
  const models = getModelsForConnection(tenantDb);

  const drives = await models.WalkinDrive.find({});
  
  const now = new Date();
  
  drives.forEach(drive => {
    let active = false;
    if (drive.endDate && drive.endTime) {
      const dateStr = drive.endDate.toISOString().split('T')[0];
      const timeStr = drive.endTime;
      const endDateTime = new Date(`${dateStr}T${timeStr}:00`);
      active = endDateTime > now;
      console.log(`Drive: ${drive._id} | endDate: ${drive.endDate} | dateStr: ${dateStr} | timeStr: ${timeStr} | endDateTime: ${endDateTime} | now: ${now} | active: ${active}`);
    }
  });

  process.exit(0);
}

test().catch(console.error);
