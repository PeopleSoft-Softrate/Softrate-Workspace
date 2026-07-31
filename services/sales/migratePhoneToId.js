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

    async function migrateCollection(Model, oldField, newField) {
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

    const c1 = await migrateCollection(CallLog, 'phone', 'employeeId');
    console.log(`  Migrated ${c1} CallLogs.`);
    
    const c2 = await migrateCollection(CallDetail, 'phone', 'employeeId');
    console.log(`  Migrated ${c2} CallDetails.`);
    
    const c3 = await migrateCollection(Bookmark, 'phone', 'employeeId');
    console.log(`  Migrated ${c3} Bookmarks.`);
    
    const c4 = await migrateCollection(BreakLog, 'phone', 'employeeId');
    console.log(`  Migrated ${c4} BreakLogs.`);
    
    const c5 = await migrateCollection(Lead, 'phone', 'assignedEmployeeId');
    console.log(`  Migrated ${c5} Leads.`);

    const c6 = await migrateCollection(Invoice, 'phone', 'employeeId');
    console.log(`  Migrated ${c6} Invoices.`);

    const c7 = await migrateCollection(Quotation, 'phone', 'employeeId');
    console.log(`  Migrated ${c7} Quotations.`);

    let leadCount = 0;
    for (const [phone, id] of Object.entries(phoneToId)) {
       const result = await Lead.updateMany(
         { assignedEmployeeId: phone },
         { $set: { assignedEmployeeId: id } }
       );
       leadCount += result.modifiedCount || 0;
    }
    console.log(`  Migrated ${leadCount} Leads (assignedEmployeeId).`);

    await tenantConn.close();
  }

  console.log('Migration complete.');
}

migrate().catch(console.error);
