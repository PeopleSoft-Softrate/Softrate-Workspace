/**
 * migrate-employees-to-tenants.js
 *
 * Copies all Employee, EmployeeRevenue, and EmployeeTarget documents
 * from the global/test database into each company's dedicated tenant database.
 *
 * Safe to run multiple times — uses upsert to avoid duplicates.
 *
 * Usage:
 *   node scripts/migrate-employees-to-tenants.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Employee = require('../models/Employee');
const EmployeeRevenue = require('../models/EmployeeRevenue');
const EmployeeTarget = require('../models/EmployeeTarget');
const User = require('../models/User');

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error('❌ MONGO_URI is not set in .env');
  process.exit(1);
}

async function getTenantDb(companyCode) {
  const parsedUri = new URL(MONGO_URI);
  const dbName = `salesdb_${companyCode.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
  parsedUri.pathname = `/${dbName}`;
  const tenantUri = parsedUri.toString();

  const conn = mongoose.createConnection(tenantUri);
  await conn.asPromise();
  return { conn, dbName };
}

async function run() {
  console.log('🔗 Connecting to master DB...');
  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected to:', MONGO_URI.split('@')[1]);

  // Get all distinct company codes from employees in global DB
  const companyCodes = await Employee.distinct('companyCode');
  console.log(`\n📦 Found ${companyCodes.length} company codes with employees: ${companyCodes.join(', ')}\n`);

  let totalEmployees = 0;
  let totalRevenues = 0;
  let totalTargets = 0;

  for (const companyCode of companyCodes) {
    console.log(`\n--- Processing company: ${companyCode} ---`);
    const { conn, dbName } = await getTenantDb(companyCode);
    const nativeDb = conn.db;

    // Migrate employees using native driver to bypass Mongoose timestamps
    const employees = await Employee.find({ companyCode }).lean();
    console.log(`  👥 ${employees.length} employees`);
    if (employees.length > 0) {
      try {
        await nativeDb.collection('employees').insertMany(employees, { ordered: false });
      } catch (e) {
        if (e.code !== 11000) throw e; // ignore duplicate key errors
        console.log(`     ↳ some already existed, skipped duplicates`);
      }
    }
    totalEmployees += employees.length;

    // Migrate EmployeeRevenue
    const revenues = await EmployeeRevenue.find({ companyCode }).lean();
    console.log(`  💰 ${revenues.length} revenue records`);
    if (revenues.length > 0) {
      try {
        await nativeDb.collection('employeerevenues').insertMany(revenues, { ordered: false });
      } catch (e) {
        if (e.code !== 11000) throw e;
        console.log(`     ↳ some already existed, skipped duplicates`);
      }
    }
    totalRevenues += revenues.length;

    // Migrate EmployeeTarget
    const targets = await EmployeeTarget.find({ companyCode }).lean();
    console.log(`  🎯 ${targets.length} target records`);
    if (targets.length > 0) {
      try {
        await nativeDb.collection('employeetargets').insertMany(targets, { ordered: false });
      } catch (e) {
        if (e.code !== 11000) throw e;
        console.log(`     ↳ some already existed, skipped duplicates`);
      }
    }
    totalTargets += targets.length;

    console.log(`  ✅ Done: ${dbName}`);
    await conn.close();
  }

  console.log(`\n🎉 Migration complete!`);
  console.log(`   Employees migrated : ${totalEmployees}`);
  console.log(`   Revenues migrated  : ${totalRevenues}`);
  console.log(`   Targets migrated   : ${totalTargets}`);

  await mongoose.disconnect();
}

run().catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
