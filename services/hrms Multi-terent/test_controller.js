const walkinDriveController = require('./controllers/walkinDriveController');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

async function test() {
  const { getTenantConnection, waitForConnection } = require('./db');
  const { getModelsForConnection } = require('./utilities/modelLoader');

  const tenantDb = getTenantConnection('hrdb_softrateglobalcom');
  await waitForConnection(tenantDb);
  const models = getModelsForConnection(tenantDb);

  const req = {
    tenant: { companyId: '6a16a279b6cbac52ba3f726d' },
    models: models,
    query: { activeOnly: 'true' },
    originalUrl: '/api/public/walkin-drives'
  };

  const res = {
    status: function(code) {
      console.log('Status:', code);
      return this;
    },
    json: function(data) {
      console.log('JSON returned drives length:', data.length);
      console.log('Drives:', data);
    }
  };

  await walkinDriveController.getWalkinDrives(req, res);
  process.exit(0);
}

test().catch(console.error);
