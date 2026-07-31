const express = require('express');
const mongoose = require('mongoose');
const BreakLog = require('../../../models/BreakLog');
const User = require('../../../models/User');
const { companyMiddleware } = require('../../common/tenantMiddleware');
const router = express.Router();
router.use(companyMiddleware);

// Helper — today's date string in IST (YYYY-MM-DD)
function todayIST() {
  const now = new Date();
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  return ist.toISOString().slice(0, 10);
}

function toObjectId(id) {
  if (!id) return id;
  try {
    return mongoose.Types.ObjectId.isValid(String(id)) ? new mongoose.Types.ObjectId(String(id)) : id;
  } catch { return id; }
}

/* ─────────────────────────────────────────────
   POST /api/breaklog/mark
   Employee hits "Break" button — adds a break entry for today.
   Body: { companyCode, employeeId, employeeName, durationSeconds }
─────────────────────────────────────────────── */
router.post('/mark', async (req, res) => {
  try {
    const { companyCode, employeeId, employeeName, durationSeconds } = req.body;
    if (!companyCode || !employeeId || durationSeconds === undefined) {
      return res.status(400).json({ success: false, message: 'companyCode, employeeId, durationSeconds required.' });
    }

    const dur = Number(durationSeconds);
    if (isNaN(dur) || dur < 0) {
      return res.status(400).json({ success: false, message: 'durationSeconds must be a non-negative number.' });
    }

    const date = todayIST();
    const empId = toObjectId(employeeId);

    // Upsert: find today's record or create it; push new break entry and update total
    const log = await req.models.BreakLog.findOneAndUpdate(
      { companyCode, employeeId: empId, date },
      {
        $push: { breaks: { startedAt: new Date(), durationSeconds: dur } },
        $inc:  { totalSeconds: dur },
        $setOnInsert: { employeeName: employeeName || String(employeeId) },
      },
      { upsert: true, returnDocument: 'after' }
    );

    if (log && employeeName) {
      log.employeeName = employeeName;
      await log.save();
    }

    const company = await User.findOne({ companyCode }, 'breakHourLimit');
    const limitMin = company?.breakHourLimit ?? 60;
    const limitSec = limitMin * 60;

    return res.json({
      success: true,
      totalSeconds: log.totalSeconds,
      overLimit: log.totalSeconds > limitSec,
      limitSeconds: limitSec,
    });
  } catch (err) {
    console.error('[breaklog mark]', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

/* ─────────────────────────────────────────────
   GET /api/breaklog/today?companyCode=XXX
   Admin: get today's break summary for all employees.
─────────────────────────────────────────────── */
router.get('/today', async (req, res) => {
  try {
    const { companyCode } = req.query;
    if (!companyCode) return res.status(400).json({ success: false, message: 'companyCode required.' });

    const date = todayIST();
    const logs = await req.models.BreakLog.find({ companyCode, date }).sort({ totalSeconds: -1 });

    const company = await User.findOne({ companyCode }, 'breakHourLimit');
    const limitMin = company?.breakHourLimit ?? 60;
    const limitSec = limitMin * 60;

    const overLimit = logs.filter(l => l.totalSeconds > limitSec).map(l => ({
      employeeId: l.employeeId,
      employeeName: l.employeeName,
      totalSeconds: l.totalSeconds,
      limitSeconds: limitSec,
    }));

    return res.json({ success: true, logs, overLimit, limitSeconds: limitSec });
  } catch (err) {
    console.error('[breaklog today]', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

/* ─────────────────────────────────────────────
   GET /api/breaklog/employee-today?companyCode=XXX&employeeId=YYY
   Employee: get own today's break total.
─────────────────────────────────────────────── */
router.get('/employee-today', async (req, res) => {
  try {
    const { companyCode, employeeId } = req.query;
    if (!companyCode || !employeeId) {
      return res.status(400).json({ success: false, message: 'companyCode and employeeId required.' });
    }
    const date = todayIST();
    const empId = toObjectId(employeeId);
    const log = await req.models.BreakLog.findOne({ companyCode, employeeId: empId, date });
    const company = await User.findOne({ companyCode }, 'breakHourLimit');
    const limitMin = company?.breakHourLimit ?? 60;
    const limitSec = limitMin * 60;

    return res.json({
      success: true,
      totalSeconds: log?.totalSeconds ?? 0,
      limitSeconds: limitSec,
      overLimit: (log?.totalSeconds ?? 0) > limitSec,
    });
  } catch (err) {
    console.error('[breaklog employee-today]', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
