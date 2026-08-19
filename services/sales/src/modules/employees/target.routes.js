const express = require('express');
const mongoose = require('mongoose');
const EmployeeTargetGlobal = require('../../../models/EmployeeTarget');
const EmployeeRevenueGlobal = require('../../../models/EmployeeRevenue');
const EmployeeGlobal = require('../../../models/Employee');
const { companyMiddleware } = require('../../common/tenantMiddleware');

const router = express.Router();
router.use(companyMiddleware);

function normalize(value) {
  return String(value || '').trim();
}

// GET targets for all employees in a given month
router.get('/', async (req, res) => {
  try {
    const companyCode = normalize(req.query.companyCode);
    const year = Number(req.query.year);
    const month = Number(req.query.month);

    if (!companyCode || !year || !month) {
      return res.status(400).json({ success: false, message: 'companyCode, year, and month are required' });
    }

    const Employee = req.models?.Employee || EmployeeGlobal;
    const EmployeeTarget = req.models?.EmployeeTarget || EmployeeTargetGlobal;
    const EmployeeRevenue = req.models?.EmployeeRevenue || EmployeeRevenueGlobal;

    const [employees, targets, revenues] = await Promise.all([
      Employee.find({ companyCode }).select('_id name').lean(),
      EmployeeTarget.find({ companyCode, year, month }).lean(),
      EmployeeRevenue.find({ companyCode, year, month }).lean(),
    ]);

    const targetMap = new Map(targets.map(t => [t.employeeId.toString(), t.targetAmount]));
    const revenueMap = new Map(revenues.map(r => [r.employeeId.toString(), r.achievedAmount]));

    const results = employees.map(emp => ({
      employeeId: emp._id,
      employeeName: emp.name,
      targetAmount: targetMap.get(emp._id.toString()) || 0,
      achievedAmount: revenueMap.get(emp._id.toString()) || 0,
    }));

    return res.status(200).json({ success: true, data: results });
  } catch (err) {
    console.error('[get targets]', err);
    return res.status(500).json({ success: false, message: 'Server error fetching targets' });
  }
});

// GET targets for a single employee (annual view)
router.get('/employee/:id', async (req, res) => {
  try {
    const companyCode = normalize(req.query.companyCode);
    const year = Number(req.query.year);
    const employeeId = req.params.id;

    if (!companyCode || !year || !employeeId) {
      return res.status(400).json({ success: false, message: 'companyCode, year, and employeeId are required' });
    }

    const EmployeeTarget = req.models?.EmployeeTarget || EmployeeTargetGlobal;
    const EmployeeRevenue = req.models?.EmployeeRevenue || EmployeeRevenueGlobal;

    const [targets, revenues] = await Promise.all([
      EmployeeTarget.find({ companyCode, employeeId, year }).lean(),
      EmployeeRevenue.find({ companyCode, employeeId, year }).lean(),
    ]);

    const targetMap = new Map(targets.map(t => [t.month, t.targetAmount]));
    const revenueMap = new Map(revenues.map(r => [r.month, r.achievedAmount]));

    const monthlyData = [];
    for (let m = 1; m <= 12; m++) {
      monthlyData.push({
        month: m,
        targetAmount: targetMap.get(m) || 0,
        achievedAmount: revenueMap.get(m) || 0,
      });
    }

    return res.status(200).json({ success: true, year, data: monthlyData });
  } catch (err) {
    console.error('[get employee target]', err);
    return res.status(500).json({ success: false, message: 'Server error fetching employee target' });
  }
});

// POST set/update a target
router.post('/', async (req, res) => {
  try {
    const { companyCode, employeeId, year, month, targetAmount } = req.body;

    if (!companyCode || !employeeId || !year || !month || targetAmount === undefined) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const EmployeeTarget = req.models?.EmployeeTarget || EmployeeTargetGlobal;

    const target = await EmployeeTarget.findOneAndUpdate(
      { companyCode, employeeId, year, month },
      { $set: { targetAmount: Number(targetAmount) } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return res.status(200).json({ success: true, target });
  } catch (err) {
    console.error('[post target]', err);
    return res.status(500).json({ success: false, message: 'Server error saving target' });
  }
});

module.exports = router;
