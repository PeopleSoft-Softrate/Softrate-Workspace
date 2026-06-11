require('dotenv').config({ path: '../.env' });
const { getMasterConnection, waitForConnection } = require('../db');
const mongoose = require('mongoose');

const LeaveCounterSchema = require('../models/leaveCounter.model').schema || require('mongoose').Schema({
  companyId: String,
  employeeId: String,
  leaveType: String,
  totalAllowed: Number,
  used: Number,
  balance: Number,
  cycleStartDate: Date,
  nextResetDate: Date
}, { collection: 'leavecounters' });

async function check() {
  const masterDb = getMasterConnection();
  await waitForConnection(masterDb);
  
  const Company = masterDb.model('Company', new mongoose.Schema({ companyCode: String, leavePolicies: Array, settings: Object }));
  const companies = await Company.find({});
  
  for (const c of companies) {
    console.log(`Company ${c.companyCode}:`, c.leavePolicies);
    const tenantDb = masterDb.useDb(c.companyCode, { useCache: true });
    
    // Check Employee
    const Employee = tenantDb.model('Employee', new mongoose.Schema({ EmployeeId: String, fullName: String }, { collection: 'employees' }));
    const emps = await Employee.find({});
    console.log(`Employees in ${c.companyCode}:`, emps.map(e => e.EmployeeId));
    
    // Check LeaveCounter
    const LeaveCounter = tenantDb.model('LeaveCounter', LeaveCounterSchema);
    const docs = await LeaveCounter.find({});
    console.log(`Leave counters in ${c.companyCode}:`, docs);
  }
  process.exit(0);
}
check();
