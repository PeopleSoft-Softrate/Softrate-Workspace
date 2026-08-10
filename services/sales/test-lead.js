const mongoose = require('mongoose');
const { getTenantConnection } = require('./src/common/tenantMiddleware');

async function testQuery() {
  // Try finding a lead from the first tenant
  const dbName = 'salesdb_surya_sri_manyam_products_opc_private_limited'; // Just guessing based on the screenshot company name
  // Actually, wait, the companyCode is probably short.
  // Let's just list all databases and find the lead!
  console.log('Querying...');
}

testQuery();
