require('dotenv').config({ path: '../.env' });
const { getMasterConnection, getTenantConnection, waitForConnection } = require('../db');
const mongoose = require('mongoose');

async function check() {
  const masterDb = getMasterConnection();
  await waitForConnection(masterDb);
  
  // Connect to the real tenant DB
  const tenantDb = getTenantConnection('hrdb_softrateglobalcom');
  await waitForConnection(tenantDb);
  
  const collections = await tenantDb.db.listCollections().toArray();
  console.log('Collections in hrdb_softrateglobalcom:', collections.map(c => c.name));

  for (const coll of collections) {
    const count = await tenantDb.db.collection(coll.name).countDocuments();
    console.log(`  ${coll.name}: ${count} docs`);
  }

  // Check leaves
  const EmployeeLeave = tenantDb.model('EmployeeLeave_real', new mongoose.Schema({}, { strict: false, collection: 'employeeleaves' }));
  const leaves = await EmployeeLeave.find({}).limit(5).lean();
  console.log('\nEmployeeLeave samples:', JSON.stringify(leaves.map(l => ({
    employeeId: l.employeeId,
    leaveType: l.leaveType,
    managerStatus: l.managerStatus,
    hrStatus: l.hrStatus,
    fromDate: l.fromDate
  })), null, 2));

  // Employee 262004
  const Employee = tenantDb.model('Employee_real', new mongoose.Schema({}, { strict: false, collection: 'employees' }));
  const emp = await Employee.findOne({ EmployeeId: '262004' }).lean();
  console.log('\nEmployee 262004:', { id: emp?.EmployeeId, name: emp?.fullName, assignedManager: emp?.assignedManager });

  process.exit(0);
}
check().catch(e => { console.error(e); process.exit(1); });
