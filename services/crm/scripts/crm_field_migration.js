require('../loadEnv');
const mongoose = require('mongoose');

const User = require('../models/User'); 
const Client = require('../models/Client');
const CrmProject = require('../models/CrmProject');
const Lead = require('../models/Lead');

async function getEmployeeId(phone, companyCode) {
  const db = mongoose.connection;
  const Employee = db.collection('employees');
  const emp = await Employee.findOne({ phone: phone, companyCode: companyCode });
  return emp ? emp._id : null;
}

async function runFieldMigration() {
  try {
    const masterUri = process.env.MONGO_URI;
    console.log('Connecting to Master DB...');
    await mongoose.connect(masterUri);
    console.log('Connected to Master DB.');

    const companies = await User.find({}).lean();
    console.log(`Found ${companies.length} companies.`);

    for (const company of companies) {
      if (!company.companyCode) continue;
      
      const companyCode = company.companyCode;
      const dbName = `salesdb_${companyCode.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
      
      const parsedUri = new URL(masterUri);
      parsedUri.pathname = `/${dbName}`;
      const tenantUri = parsedUri.toString();
      
      console.log(`\n--- Migrating CRM Fields for ${companyCode} to ${dbName} ---`);
      const tenantConn = await mongoose.createConnection(tenantUri).asPromise();
      
      const TenantClient = tenantConn.model('Client', Client.schema);
      const TenantProject = tenantConn.model('CrmProject', CrmProject.schema);
      const TenantLead = tenantConn.model('Lead', Lead.schema);

      // Drop old indexes in Client
      try {
        await tenantConn.collection('clients').dropIndex('companyCode_1_assignedEmployeePhones_1_updatedAt_-1');
        console.log(`  Dropped old Client index`);
      } catch (e) {
        // ignore
      }

      // Drop old indexes in CrmProject
      try {
        await tenantConn.collection('crmprojects').dropIndex('companyCode_1_projectManagerPhone_1');
        console.log(`  Dropped old CrmProject index`);
      } catch (e) {
        // ignore
      }

      // Sync new indexes
      await TenantClient.syncIndexes();
      await TenantProject.syncIndexes();

      // 1. Clients
      const clients = await TenantClient.find({}).lean();
      let clientUpdates = 0;
      for (const client of clients) {
        if (client.assignedEmployeePhones && client.assignedEmployeePhones.length > 0) {
          const ids = [];
          for (const phone of client.assignedEmployeePhones) {
            const empId = await getEmployeeId(phone, companyCode);
            if (empId) ids.push(empId);
          }
          await TenantClient.updateOne({ _id: client._id }, {
            $set: { assignedEmployeeIds: ids },
            $unset: { assignedEmployeePhones: 1 }
          });
          clientUpdates++;
        }
      }
      console.log(`  Client: Updated ${clientUpdates} records.`);

      // 2. Projects
      const projects = await TenantProject.find({}).lean();
      let projectUpdates = 0;
      for (const proj of projects) {
        if (proj.projectManagerPhone) {
          const empId = await getEmployeeId(proj.projectManagerPhone, companyCode);
          if (empId) {
            await TenantProject.updateOne({ _id: proj._id }, {
              $set: { projectManagerId: empId },
              $unset: { projectManagerPhone: 1 }
            });
            projectUpdates++;
          }
        }
      }
      console.log(`  CrmProject: Updated ${projectUpdates} records.`);

      // 3. Leads (if any exist in this tenant DB with old fields)
      const leads = await TenantLead.find({ assignedEmployeePhone: { $exists: true } }).lean();
      let leadUpdates = 0;
      for (const lead of leads) {
        const empId = await getEmployeeId(lead.assignedEmployeePhone, companyCode);
        if (empId) {
          await TenantLead.updateOne({ _id: lead._id }, {
            $set: { assignedEmployeeId: empId },
            $unset: { assignedEmployeePhone: 1 }
          });
          leadUpdates++;
        }
      }
      console.log(`  Lead: Updated ${leadUpdates} records.`);

      await tenantConn.close();
    }

    console.log('\nCRM Field Migration Complete!');
    await mongoose.disconnect();
    process.exit(0);

  } catch (err) {
    console.error('CRM Field Migration failed:', err);
    process.exit(1);
  }
}

runFieldMigration();
