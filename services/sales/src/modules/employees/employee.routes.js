const express = require('express');
const Employee = require('../../../models/Employee'); // Global model — used ONLY for login (no JWT yet)
const { signToken } = require('../../common/jwtHelper');
const { companyMiddleware } = require('../../common/tenantMiddleware');
const router = express.Router();

// All admin CRUD routes attach tenant DB via companyMiddleware
router.use(companyMiddleware);

// GET employees for a given company code — uses tenant DB
router.get('/', async (req, res) => {
  try {
    const { companyCode } = req.query;
    if (!companyCode) {
      return res.status(400).json({ success: false, message: 'companyCode is required' });
    }
    const EmployeeModel = req.models?.Employee || Employee;
    const employees = await EmployeeModel.find({ companyCode }).sort({ createdAt: -1 });
    return res.status(200).json({ success: true, employees });
  } catch (err) {
    console.error('[get employees]', err);
    return res.status(500).json({ success: false, message: 'Server error fetching employees' });
  }
});

// POST a new employee — uses tenant DB
router.post('/', async (req, res) => {
  try {
    const { name, mobile, companyCode, countryCode } = req.body;
    if (!name || !mobile || !companyCode) {
      return res.status(400).json({ success: false, message: 'Name, mobile, and companyCode are required.' });
    }
    const EmployeeModel = req.models?.Employee || Employee;
    const newEmployee = await EmployeeModel.create({ name, mobile, companyCode, countryCode: countryCode || '+91' });
    return res.status(201).json({ success: true, employee: newEmployee, message: 'Employee added successfully.' });
  } catch (err) {
    console.error('[post employee]', err);
    return res.status(500).json({ success: false, message: 'Server error saving employee' });
  }
});

// PATCH employee code — uses tenant DB
router.patch('/:id/code', async (req, res) => {
  try {
    const { employeeCode, companyCode } = req.body;
    if (!employeeCode || !employeeCode.trim()) {
      return res.status(400).json({ success: false, message: 'Employee code is required.' });
    }
    const EmployeeModel = req.models?.Employee || Employee;
    const employee = await EmployeeModel.findByIdAndUpdate(
      req.params.id,
      { employeeCode: employeeCode.trim() },
      { returnDocument: 'after' },
    );
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found.' });
    }
    return res.status(200).json({ success: true, employee });
  } catch (err) {
    console.error('[patch employee code]', err);
    return res.status(500).json({ success: false, message: 'Server error updating employee code.' });
  }
});

// PATCH employee allowedCompanies — uses tenant DB
router.patch('/:id/allowed-companies', async (req, res) => {
  try {
    const { allowedCompanies } = req.body;
    if (!Array.isArray(allowedCompanies)) {
      return res.status(400).json({ success: false, message: 'allowedCompanies must be an array.' });
    }
    const EmployeeModel = req.models?.Employee || Employee;
    const employee = await EmployeeModel.findByIdAndUpdate(
      req.params.id,
      { allowedCompanies },
      { returnDocument: 'after' },
    );
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found.' });
    }
    return res.status(200).json({ success: true, employee });
  } catch (err) {
    console.error('[patch employee allowedCompanies]', err);
    return res.status(500).json({ success: false, message: 'Server error updating allowed companies.' });
  }
});

// PATCH employee tags — uses tenant DB
router.patch('/:id/tags', async (req, res) => {
  try {
    const { tags, companyCode } = req.body;
    if (!tags || !Array.isArray(tags)) {
      return res.status(400).json({ success: false, message: 'Tags array is required.' });
    }

    const EmployeeModel = req.models?.Employee || Employee;
    const employee = await EmployeeModel.findByIdAndUpdate(
      req.params.id,
      { $set: { tags: tags } },
      { returnDocument: 'after' }
    );
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found.' });
    }

    // Add new tags to the company profile uniquely
    if (companyCode) {
      const User = require('../../../models/User');
      await User.findOneAndUpdate(
        { companyCode },
        { $addToSet: { tags: { $each: tags } } }
      );
    }

    return res.status(200).json({ success: true, employee });
  } catch (err) {
    console.error('[patch employee tags]', err);
    return res.status(500).json({ success: false, message: 'Server error updating employee tags.' });
  }
});

// PUT update employee details — uses tenant DB
router.put('/:id', async (req, res) => {
  try {
    const { name, mobile, countryCode, tags, allowedCompanies } = req.body;
    console.log("UPDATE EMPLOYEE BODY:", req.body);
    const updateData = {};
    if (name) updateData.name = name;
    if (mobile) updateData.mobile = mobile;
    if (countryCode) updateData.countryCode = countryCode;
    if (tags && Array.isArray(tags)) updateData.tags = tags;
    if (allowedCompanies && Array.isArray(allowedCompanies)) updateData.allowedCompanies = allowedCompanies;

    const EmployeeModel = req.models?.Employee || Employee;
    const employee = await EmployeeModel.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { returnDocument: 'after' }
    );

    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found.' });
    }

    return res.status(200).json({ success: true, employee, message: 'Employee updated successfully.' });
  } catch (err) {
    console.error('[update employee]', err);
    return res.status(500).json({ success: false, message: 'Server error updating employee.' });
  }
});

// Employee Login — MUST use the global Employee model since no JWT exists yet.
// The login looks up the employee by mobile+companyCode and issues a JWT.
router.post('/login', async (req, res) => {
  try {
    const { companyCode, mobile, countryCode } = req.body;
    if (!companyCode || !mobile) {
      return res.status(400).json({ success: false, message: 'Company code and mobile number are required.' });
    }

    // First try the tenant DB (preferred — employee should live in their own DB)
    const EmployeeModel = req.models?.Employee || null;
    let employee = null;
    if (EmployeeModel) {
      const query = { companyCode, mobile };
      if (countryCode) query.countryCode = countryCode;
      employee = await EmployeeModel.findOne(query);
    }

    // Fallback: check the global (test) DB for employees not yet migrated
    if (!employee) {
      const query = { companyCode, mobile };
      if (countryCode) query.countryCode = countryCode;
      employee = await Employee.findOne(query);
    }

    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found with this number & company code.' });
    }

    // Issue JWT — employeeId + companyCode embedded in token
    const token = signToken({ employeeId: String(employee._id), companyCode, role: 'employee' });

    return res.status(200).json({ success: true, message: 'Employee authenticated', employee, token });
  } catch (err) {
    console.error('[employee login]', err);
    return res.status(500).json({ success: false, message: 'Server error during employee login' });
  }
});

// Admin: Trigger sync for a specific employee — uses tenant DB
router.post('/:id/trigger-sync', async (req, res) => {
  try {
    const EmployeeModel = req.models?.Employee || Employee;
    const employee = await EmployeeModel.findByIdAndUpdate(req.params.id, { $set: { forceSync: true } });
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found.' });
    return res.status(200).json({ success: true, message: 'Sync triggered.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// Admin: Trigger sync for all employees in a company — uses tenant DB
router.post('/trigger-sync-all', async (req, res) => {
  try {
    const { companyCode } = req.body;
    if (!companyCode) return res.status(400).json({ success: false, message: 'companyCode required.' });
    const EmployeeModel = req.models?.Employee || Employee;
    await EmployeeModel.updateMany({ companyCode }, { $set: { forceSync: true } });
    return res.status(200).json({ success: true, message: 'Sync triggered for all employees.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// Mobile App: Poll for sync trigger — uses tenant DB (falls back to global)
router.get('/sync-status', async (req, res) => {
  try {
    const { employeeId } = req.query;
    if (!employeeId) return res.status(400).json({ success: false, message: 'employeeId required.' });

    const EmployeeModel = req.models?.Employee || Employee;
    const employee = await EmployeeModel.findOneAndUpdate(
      { _id: employeeId, forceSync: true },
      { $set: { forceSync: false } }
    );

    if (employee) {
      return res.status(200).json({ success: true, triggerSync: true });
    } else {
      return res.status(200).json({ success: true, triggerSync: false });
    }
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
