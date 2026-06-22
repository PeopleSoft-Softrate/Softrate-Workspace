require('dotenv').config({ path: '../.env' });
const { getMasterConnection, waitForConnection } = require('../db');
async function run() {
  const masterDb = getMasterConnection();
  await waitForConnection(masterDb);
  const db = masterDb.useDb('hrdb_softrateglobalcom', { useCache: true });
  
  const emp = await db.collection('employees').findOne({ EmployeeId: '251001' });
  console.log("Employee found:", !!emp);
  if (emp) console.log("CompanyId in emp:", emp.companyId);
  
  const intern = await db.collection('interns').findOne({ internid: '251001' });
  console.log("Intern found:", !!intern);
  if (intern) console.log("CompanyId in intern:", intern.companyId);
  
  process.exit(0);
}
run();
