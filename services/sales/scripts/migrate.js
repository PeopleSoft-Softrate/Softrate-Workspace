require('../loadEnv');
const mongoose = require('mongoose');

const Employee = require('../models/Employee');
const Lead = require('../models/Lead');
const CallLog = require('../models/CallLog');
const CallDetail = require('../models/CallDetail');
const Bookmark = require('../models/Bookmark');
const BreakLog = require('../models/BreakLog');
const Quotation = require('../models/Quotation');
const Invoice = require('../models/Invoice');
const History = require('../models/History');

async function dropOldUniqueIndexes() {
  const collections = [
    { model: CallLog, index: 'companyCode_1_phone_1_date_1' },
    { model: CallDetail, index: 'companyCode_1_phone_1_timestamp_1_number_1' },
    { model: BreakLog, index: 'companyCode_1_employeePhone_1_date_1' }
  ];

  for (const { model, index } of collections) {
    try {
      await model.collection.dropIndex(index);
      console.log(`Dropped old unique index ${index} on ${model.modelName}`);
    } catch (err) {
      if (err.code === 27) {
        // Index not found
      } else {
        console.warn(`Could not drop index ${index} on ${model.modelName}:`, err.message);
      }
    }
  }
}

async function runMigration() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected.');

    await dropOldUniqueIndexes();

    const employees = await Employee.find({});
    console.log(`Found ${employees.length} employees to migrate.`);

    for (const emp of employees) {
      const phone = emp.mobile;
      if (!phone) continue;

      const empId = emp._id;

      // 1. Leads
      const leadRes = await Lead.collection.updateMany(
        { assignedEmployeePhone: phone },
        { $set: { assignedEmployeeId: empId }, $unset: { assignedEmployeePhone: 1 } }
      );
      if (leadRes.modifiedCount > 0) console.log(`[${phone}] Updated ${leadRes.modifiedCount} Leads`);

      // 2. CallLogs
      const callLogRes = await CallLog.collection.updateMany(
        { phone: phone },
        { $set: { employeeId: empId }, $unset: { phone: 1 } }
      );
      if (callLogRes.modifiedCount > 0) console.log(`[${phone}] Updated ${callLogRes.modifiedCount} CallLogs`);

      // 3. CallDetails
      const callDetailRes = await CallDetail.collection.updateMany(
        { phone: phone },
        { $set: { employeeId: empId }, $unset: { phone: 1 } }
      );
      if (callDetailRes.modifiedCount > 0) console.log(`[${phone}] Updated ${callDetailRes.modifiedCount} CallDetails`);

      // 4. Bookmarks
      const bookmarkRes = await Bookmark.collection.updateMany(
        { employeePhone: phone },
        { $set: { employeeId: empId }, $unset: { employeePhone: 1 } }
      );
      if (bookmarkRes.modifiedCount > 0) console.log(`[${phone}] Updated ${bookmarkRes.modifiedCount} Bookmarks`);

      // 5. BreakLogs
      const breakLogRes = await BreakLog.collection.updateMany(
        { employeePhone: phone },
        { $set: { employeeId: empId }, $unset: { employeePhone: 1 } }
      );
      if (breakLogRes.modifiedCount > 0) console.log(`[${phone}] Updated ${breakLogRes.modifiedCount} BreakLogs`);

      // 6. Quotations
      const quotationRes = await Quotation.collection.updateMany(
        { employeePhone: phone },
        { $set: { employeeId: empId }, $unset: { employeePhone: 1 } }
      );
      if (quotationRes.modifiedCount > 0) console.log(`[${phone}] Updated ${quotationRes.modifiedCount} Quotations`);

      const quotationCreatedRes = await Quotation.collection.updateMany(
        { createdByPhone: phone },
        { $set: { createdById: empId }, $unset: { createdByPhone: 1 } }
      );
      if (quotationCreatedRes.modifiedCount > 0) console.log(`[${phone}] Updated ${quotationCreatedRes.modifiedCount} Quotations (createdById)`);

      // 7. Invoices
      const invoiceRes = await Invoice.collection.updateMany(
        { employeePhone: phone },
        { $set: { employeeId: empId }, $unset: { employeePhone: 1 } }
      );
      if (invoiceRes.modifiedCount > 0) console.log(`[${phone}] Updated ${invoiceRes.modifiedCount} Invoices`);

      const invoiceCreatedRes = await Invoice.collection.updateMany(
        { createdByPhone: phone },
        { $set: { createdById: empId }, $unset: { createdByPhone: 1 } }
      );
      if (invoiceCreatedRes.modifiedCount > 0) console.log(`[${phone}] Updated ${invoiceCreatedRes.modifiedCount} Invoices (createdById)`);

      // 8. History
      const historyRes = await History.collection.updateMany(
        { changedBy: phone },
        { $set: { changedBy: empId } }
      );
      if (historyRes.modifiedCount > 0) console.log(`[${phone}] Updated ${historyRes.modifiedCount} History records`);
    }

    console.log('Syncing new indexes...');
    await Promise.all([
      Lead.syncIndexes(),
      CallLog.syncIndexes(),
      CallDetail.syncIndexes(),
      Bookmark.syncIndexes(),
      BreakLog.syncIndexes(),
      Quotation.syncIndexes(),
      Invoice.syncIndexes(),
      History.syncIndexes()
    ]);
    console.log('Indexes synced successfully.');

    console.log('Migration completed successfully.');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await mongoose.disconnect();
  }
}

runMigration();
