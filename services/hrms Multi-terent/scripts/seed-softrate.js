const mongoose = require('mongoose');
require('dotenv').config();
const { getTenantConnection } = require('../db');
const { getModelsForConnection } = require('../utilities/modelLoader');

const DB_NAME = 'hrdb_softrateglobalcom';

async function disableMFA() {
  try {
    const tenantDb = getTenantConnection(DB_NAME);
    const models = getModelsForConnection(tenantDb);
    const { Employee } = models;

    const empId = '262001';
    const emp = await Employee.findOne({ EmployeeId: empId });
    
    if (emp) {
      console.log(`Found ${emp.fullName} (${emp.EmployeeId}), Current MFA: ${emp.mfaEnabled}`);
      emp.mfaEnabled = false;
      await emp.save();
      console.log(`Disabled MFA for ${emp.fullName} (${emp.EmployeeId})`);
    } else {
      console.log(`Employee with ID ${empId} not found.`);
    }

    process.exit(0);
  } catch (err) {
    console.error('Update error:', err);
    process.exit(1);
  }
}

disableMFA();
