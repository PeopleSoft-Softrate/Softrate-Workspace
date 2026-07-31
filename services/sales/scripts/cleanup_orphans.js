require('../loadEnv');
const mongoose = require('mongoose');

const CallLog = require('../models/CallLog');
const CallDetail = require('../models/CallDetail');
const BreakLog = require('../models/BreakLog');
const Lead = require('../models/Lead');
const Bookmark = require('../models/Bookmark');
const Quotation = require('../models/Quotation');
const Invoice = require('../models/Invoice');
const History = require('../models/History');

async function cleanup() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected. Cleaning up orphaned records (missing employeeId/assignedEmployeeId)...');

    const collections = [
      { model: CallLog, field: 'employeeId' },
      { model: CallDetail, field: 'employeeId' },
      { model: BreakLog, field: 'employeeId' },
      { model: Lead, field: 'assignedEmployeeId' },
      { model: Bookmark, field: 'employeeId' },
      { model: Quotation, field: 'employeeId' },
      { model: Invoice, field: 'employeeId' },
      { model: History, field: 'changedBy' },
    ];

    for (const { model, field } of collections) {
      const res = await model.collection.deleteMany({ [field]: { $exists: false } });
      console.log(`Deleted ${res.deletedCount} orphaned records from ${model.modelName}`);
    }

    console.log('Syncing indexes...');
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
    console.log('All indexes synced.');

  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}

cleanup();
