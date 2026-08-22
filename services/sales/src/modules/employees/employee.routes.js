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

// PATCH employee profile photo — uses tenant DB
router.patch('/:id/profile-photo', async (req, res) => {
  try {
    const { profilePhoto } = req.body;
    
    // We allow empty string to remove the photo
    if (profilePhoto === undefined) {
      return res.status(400).json({ success: false, message: 'profilePhoto is required.' });
    }

    const EmployeeModel = req.models?.Employee || Employee;
    const employee = await EmployeeModel.findByIdAndUpdate(
      req.params.id,
      { $set: { profilePhoto } },
      { returnDocument: 'after' }
    );

    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found.' });
    }

    return res.status(200).json({ success: true, employee });
  } catch (err) {
    console.error('[patch employee profile photo]', err);
    return res.status(500).json({ success: false, message: 'Server error updating profile photo.' });
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

const speakeasy = require('speakeasy');
const QRCode = require('qrcode');

// Employee Login — checks credentials and returns 2FA challenge / QR setup
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

    // If 2FA is already enabled and secret exists, require 6-digit TOTP code
    if (employee.twoFactorEnabled && employee.twoFactorSecret) {
      return res.status(200).json({
        success: true,
        require2FA: true,
        employeeId: String(employee._id),
        employeeName: employee.name,
        companyCode,
        message: 'Two-factor authentication code required.',
      });
    }

    // Otherwise, generate a new TOTP secret & QR code for mandatory setup
    const secret = speakeasy.generateSecret({
      name: `DealVoice:${employee.name}`,
      issuer: 'DealVoice',
      length: 20,
    });

    employee.twoFactorTempSecret = secret.base32;
    await employee.save();

    const qrCode = await QRCode.toDataURL(secret.otpauth_url);

    return res.status(200).json({
      success: true,
      require2FASetup: true,
      qrCode,
      secret: secret.base32,
      otpauthUrl: secret.otpauth_url,
      employeeId: String(employee._id),
      employeeName: employee.name,
      companyCode,
      message: 'Please configure your authenticator app using the QR code.',
    });
  } catch (err) {
    console.error('[employee login]', err);
    return res.status(500).json({ success: false, message: 'Server error during employee login' });
  }
});

// Verify 2FA Setup (First-time QR scan)
router.post('/2fa/verify-setup', async (req, res) => {
  try {
    const { employeeId, companyCode, token } = req.body;
    if (!employeeId || !token) {
      return res.status(400).json({ success: false, message: 'Employee ID and 6-digit verification code are required.' });
    }

    const EmployeeModel = req.models?.Employee || null;
    let employee = null;
    if (EmployeeModel) {
      employee = await EmployeeModel.findById(employeeId);
    }
    if (!employee) {
      employee = await Employee.findById(employeeId);
    }
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found.' });
    }

    if (!employee.twoFactorTempSecret) {
      return res.status(400).json({ success: false, message: 'No pending 2FA setup found. Please sign in again.' });
    }

    const verified = speakeasy.totp.verify({
      secret: employee.twoFactorTempSecret,
      encoding: 'base32',
      token: String(token).trim(),
      window: 2, // Allow ±1 minute clock drift
    });

    if (!verified) {
      return res.status(400).json({ success: false, message: 'Invalid 6-digit verification code. Please check your Authenticator app and try again.' });
    }

    employee.twoFactorEnabled = true;
    employee.twoFactorSecret = employee.twoFactorTempSecret;
    employee.twoFactorTempSecret = '';
    employee.lastLoginDate = new Date().toISOString().slice(0, 10);
    await employee.save();

    const jwtToken = signToken({ employeeId: String(employee._id), companyCode: employee.companyCode || companyCode, role: 'employee' });

    return res.status(200).json({
      success: true,
      message: 'Two-factor authentication verified and enabled successfully.',
      employee,
      token: jwtToken,
      loginDate: employee.lastLoginDate,
    });
  } catch (err) {
    console.error('[2fa verify-setup]', err);
    return res.status(500).json({ success: false, message: 'Server error verifying authenticator setup.' });
  }
});

// Verify 2FA (Subsequent daily logins)
router.post('/2fa/verify', async (req, res) => {
  try {
    const { employeeId, companyCode, token } = req.body;
    if (!employeeId || !token) {
      return res.status(400).json({ success: false, message: 'Employee ID and 6-digit verification code are required.' });
    }

    const EmployeeModel = req.models?.Employee || null;
    let employee = null;
    if (EmployeeModel) {
      employee = await EmployeeModel.findById(employeeId);
    }
    if (!employee) {
      employee = await Employee.findById(employeeId);
    }
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found.' });
    }

    if (!employee.twoFactorSecret) {
      return res.status(400).json({ success: false, message: '2FA is not configured. Please sign in to set up.' });
    }

    const verified = speakeasy.totp.verify({
      secret: employee.twoFactorSecret,
      encoding: 'base32',
      token: String(token).trim(),
      window: 2,
    });

    if (!verified) {
      return res.status(400).json({ success: false, message: 'Invalid 6-digit code. Please check your Authenticator app and try again.' });
    }

    employee.lastLoginDate = new Date().toISOString().slice(0, 10);
    await employee.save();

    const jwtToken = signToken({ employeeId: String(employee._id), companyCode: employee.companyCode || companyCode, role: 'employee' });

    return res.status(200).json({
      success: true,
      message: 'Employee authenticated successfully.',
      employee,
      token: jwtToken,
      loginDate: employee.lastLoginDate,
    });
  } catch (err) {
    console.error('[2fa verify]', err);
    return res.status(500).json({ success: false, message: 'Server error during 2FA verification.' });
  }
});

// Admin: Reset 2FA for an employee
router.post('/:id/reset-2fa', async (req, res) => {
  try {
    const EmployeeModel = req.models?.Employee || Employee;
    const employee = await EmployeeModel.findByIdAndUpdate(
      req.params.id,
      { $set: { twoFactorEnabled: false, twoFactorSecret: '', twoFactorTempSecret: '' } },
      { new: true }
    );
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found.' });
    return res.status(200).json({ success: true, message: '2FA reset successfully. Employee will be prompted to set up a new QR code on next login.', employee });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error resetting 2FA.' });
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
