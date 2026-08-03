require('dotenv').config();
const mongoose = require('mongoose');

const EmployeeSchema = new mongoose.Schema({
  mobile: String,
}, { strict: false, collection: 'employees' });

const LeadSchema = new mongoose.Schema({}, { strict: false, collection: 'leads' });
const CallLogSchema = new mongoose.Schema({}, { strict: false, collection: 'calllogs' });
const CallDetailSchema = new mongoose.Schema({}, { strict: false, collection: 'calldetails' });
const BookmarkSchema = new mongoose.Schema({}, { strict: false, collection: 'bookmarks' });
const BreakLogSchema = new mongoose.Schema({}, { strict: false, collection: 'breaklogs' });
const InvoiceSchema = new mongoose.Schema({}, { strict: false, collection: 'invoices' });
const QuotationSchema = new mongoose.Schema({}, { strict: false, collection: 'quotations' });
const ClientSchema = new mongoose.Schema({}, { strict: false, collection: 'clients' });

async function migrate() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error('MONGO_URI not found');

  await mongoose.connect(uri);
  console.log('Connected to global central DB');
  
  const adminDb = mongoose.connection.db.admin();
  const dbs = await adminDb.listDatabases();
  const tenantDbs = dbs.databases.map(d => d.name).filter(n => n.startsWith('salesdb_'));
  
  const Employee = mongoose.model('Employee', EmployeeSchema);
  const employees = await Employee.find({}).lean();
  console.log(`Found ${employees.length} employees in central DB.`);

  const phoneToId = {};
  for (const emp of employees) {
    if (emp.mobile) phoneToId[emp.mobile] = emp._id;
  }
  await mongoose.disconnect();

  const baseUrl = uri.substring(0, uri.lastIndexOf('/'));
  
  for (const dbName of tenantDbs) {
    console.log(`Migrating DB: ${dbName}`);
    let tenantUri;
    if (uri.endsWith('/')) {
      tenantUri = uri + dbName;
    } else {
      tenantUri = uri.substring(0, uri.lastIndexOf('/') + 1) + dbName;
    }

    const tenantConn = await mongoose.createConnection(tenantUri).asPromise();
    
    const Lead = tenantConn.model('Lead', LeadSchema);
    const CallLog = tenantConn.model('CallLog', CallLogSchema);
    const CallDetail = tenantConn.model('CallDetail', CallDetailSchema);
    const Bookmark = tenantConn.model('Bookmark', BookmarkSchema);
    const BreakLog = tenantConn.model('BreakLog', BreakLogSchema);
    const Invoice = tenantConn.model('Invoice', InvoiceSchema);
    const Quotation = tenantConn.model('Quotation', QuotationSchema);
    const Client = tenantConn.model('Client', ClientSchema);

    async function migrateField(Model, oldField, newField) {
      let count = 0;
      for (const [phone, id] of Object.entries(phoneToId)) {
        const result1 = await Model.updateMany(
          { [newField]: phone },
          { $set: { [newField]: id } }
        );
        const result2 = await Model.updateMany(
          { [oldField]: phone },
          { 
            $set: { [newField]: id },
            $unset: { [oldField]: "" }
          }
        );
        count += (result1.modifiedCount || 0) + (result2.modifiedCount || 0);
      }
      return count;
    }

    // Migrate standard string fields
    console.log(`  Leads: Migrated ${await migrateField(Lead, 'assignedEmployeePhone', 'assignedEmployeeId')} records.`);
    console.log(`  CallLogs: Migrated ${await migrateField(CallLog, 'employeePhone', 'employeeId')} records.`);
    console.log(`  CallDetails: Migrated ${await migrateField(CallDetail, 'employeePhone', 'employeeId')} records.`);
    console.log(`  Bookmarks: Migrated ${await migrateField(Bookmark, 'employeePhone', 'employeeId')} records.`);
    console.log(`  BreakLogs: Migrated ${await migrateField(BreakLog, 'employeePhone', 'employeeId')} records.`);
    
    console.log(`  Invoices (employee): Migrated ${await migrateField(Invoice, 'employeePhone', 'employeeId')} records.`);
    console.log(`  Invoices (creator): Migrated ${await migrateField(Invoice, 'createdByPhone', 'createdById')} records.`);
    
    console.log(`  Quotations (employee): Migrated ${await migrateField(Quotation, 'employeePhone', 'employeeId')} records.`);
    console.log(`  Quotations (creator): Migrated ${await migrateField(Quotation, 'createdByPhone', 'createdById')} records.`);

    // Migrate Client array fields
    let clientCount = 0;
    const allClients = await Client.find({ assignedEmployeePhones: { $exists: true, $not: { $size: 0 } } }).lean();
    for (const client of allClients) {
      const phones = client.assignedEmployeePhones || [];
      const ids = phones.map(p => phoneToId[p] || null).filter(Boolean);
      if (ids.length > 0) {
        await Client.updateOne(
          { _id: client._id },
          { 
            $set: { assignedEmployeeIds: ids },
            $unset: { assignedEmployeePhones: "" }
          }
        );
        clientCount++;
      }
    }
    console.log(`  Clients: Migrated ${clientCount} records.`);

    await tenantConn.close();
  }

  console.log('Global fix migration complete.');
}

migrate().catch(console.error);
