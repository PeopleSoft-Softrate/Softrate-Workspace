const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const { getMasterConnection, getTenantConnection, waitForConnection } = require('../db');
const { getModelsForConnection } = require('../utilities/modelLoader');
const CompanyModelExport = require('../models/CompanyModel');

/**
 * @route POST /api/onboarding/register
 * @desc Register a new SaaS tenant/company and the initial HR admin
 * @access Public
 */
router.post('/register', async (req, res) => {
  try {
    const { companyName, companyCode, hrName, hrEmail, hrPassword } = req.body;

    if (!companyName || !companyCode || !hrName || !hrEmail || !hrPassword) {
      return res.status(400).json({ success: false, msg: 'All fields are required.' });
    }

    // companyCode is stored AS-IS (can contain dots for domains like softrateglobal.com)
    // dbName is derived by stripping all non-alphanumeric chars (MongoDB DB names cannot contain '.')
    const cleanCode = companyCode.trim();
    const dbSuffix = cleanCode.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    if (!dbSuffix) {
      return res.status(400).json({ success: false, msg: 'Invalid Company Code.' });
    }
    const dbName = `hrdb_${dbSuffix}`;

    const masterDb = getMasterConnection();
    await waitForConnection(masterDb);
    const MasterCompany = masterDb.models.Company || masterDb.model('Company', CompanyModelExport.schema);

    // 1. Check if Company Code is already taken (by exact code OR by dbName collision)
    const existingCompany = await MasterCompany.findOne({
      $or: [
        { companyCode: { $regex: new RegExp(`^${cleanCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } },
        { dbName: dbName }
      ]
    });
    if (existingCompany) {
      return res.status(400).json({ success: false, msg: 'Company Code is already taken. Please choose another.' });
    }

    // 3. Create Company — store original code + sanitized dbName
    const newCompany = new MasterCompany({
      name: companyName,
      companyCode: cleanCode,         // e.g. "softrateglobal.com"
      dbName: dbName,                 // e.g. "hrdb_softrateglobalcom"
      subscriptionStatus: 'trial',
      settings: {
        internRoles: ['Other'],
        employeeRoles: ['Other']
      }
    });

    const savedCompany = await newCompany.save();

    // Now connect to the new tenant database
    const tenantDb = getTenantConnection(dbName);
    await waitForConnection(tenantDb);
    const { User, Role } = getModelsForConnection(tenantDb);

    // 2. Check if HR email is already taken inside this tenant
    const existingUser = await User.findOne({ email: { $regex: new RegExp(`^${hrEmail}$`, 'i') } });
    if (existingUser) {
      return res.status(400).json({ success: false, msg: 'Email is already registered. Please use another.' });
    }

    // 4. Create the System Default HR_ADMIN Role
    const adminRole = new Role({
      companyId: savedCompany._id,
      name: 'HR_ADMIN',
      description: 'Master administrator with full system access',
      permissions: ['*'], // Full access
      isSystemDefined: true
    });
    const savedAdminRole = await adminRole.save();

    // 4b. Create the Standard HR Role
    const hrRole = new Role({
      companyId: savedCompany._id,
      name: 'HR',
      description: 'Standard HR staff with limited access',
      permissions: [
        'VIEW_EMPLOYEES', 'MANAGE_LEAVES', 'VIEW_INTERNS', 
        'MANAGE_ATTENDANCE', 'VIEW_DOCUMENTS'
      ],
      isSystemDefined: true
    });
    await hrRole.save();

    // 4c. Create the Manager Role
    const managerRole = new Role({
      companyId: savedCompany._id,
      name: 'MANAGER',
      description: 'Team manager with approval permissions',
      permissions: [
        'APPROVE_LEAVES', 'APPROVE_ATTENDANCE', 'VIEW_TEAM',
        'CONVERT_INTERN'
      ],
      isSystemDefined: true
    });
    await managerRole.save();

    // 4d. Create the Employee Role
    const employeeRole = new Role({
      companyId: savedCompany._id,
      name: 'EMPLOYEE',
      description: 'Standard employee permissions',
      permissions: ['VIEW_DASHBOARD', 'REQUEST_LEAVE'],
      isSystemDefined: true
    });
    await employeeRole.save();

    // 4e. Create the Intern Role
    const internRole = new Role({
      companyId: savedCompany._id,
      name: 'INTERN',
      description: 'Standard intern permissions',
      permissions: ['VIEW_DASHBOARD', 'REQUEST_LEAVE'],
      isSystemDefined: true
    });
    await internRole.save();

    // 5. Hash HR Password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(hrPassword, salt);

    // 6. Create HR Admin User tied to Company
    const newUser = new User({
      companyId: savedCompany._id,
      email: hrEmail.toLowerCase(),
      password: hashedPassword,
      roleId: savedAdminRole._id, // Assign HR_ADMIN to the initial user
      profile: {
        firstName: hrName
      },
      employment: {
        type: 'FULL_TIME',
        designation: 'HR Administrator'
      }
    });

    const savedUser = await newUser.save();

    // 7. Generate JWT Token for immediate login
    const token = jwt.sign(
      { user: { id: savedUser._id, companyId: savedCompany._id, dbName: dbName, role: 'hr_admin' } },
      process.env.JWT_SECRET || 'fallback_secret_key',
      { expiresIn: '1d' }
    );

    res.status(201).json({
      success: true,
      msg: 'Company and HR Admin registered successfully!',
      token,
      user: {
        id: savedUser._id,
        firstName: savedUser.profile.firstName,
        email: savedUser.email,
        companyId: savedCompany._id,
        role: 'hr_admin'
      },
      company: {
        id: savedCompany._id,
        name: savedCompany.name,
        companyCode: savedCompany.companyCode
      }
    });

  } catch (error) {
    console.error('Registration Error:', error);
    res.status(500).json({ success: false, msg: 'Server error during registration.', error: error.message });
  }
});

/**
 * @route GET /api/onboarding/verify/:code
 * @desc Verify if a company code is valid and return company name
 * @access Public
 */
router.get('/verify/:code', async (req, res) => {
  try {
    const code = req.params.code;
    const masterDb = getMasterConnection();
    await waitForConnection(masterDb);
    const MasterCompany = masterDb.models.Company || masterDb.model('Company', CompanyModelExport.schema);

    // Escape dots and other special regex chars before building the pattern
    const escapedCode = code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const company = await MasterCompany.findOne({ 
      companyCode: { $regex: new RegExp(`^${escapedCode}$`, 'i') } 
    }).select('name companyCode dbName settings');

    if (!company) {
      return res.status(404).json({ success: false, msg: 'Invalid Company Code.' });
    }

    const companyObj = company.toObject();
    const settings = companyObj.settings || {};
    const sortRoles = (roles) => {
      const filtered = roles.filter(r => r !== 'Other').sort((a, b) => a.localeCompare(b));
      return [...filtered, 'Other'];
    };

    const internRoles = sortRoles(Array.from(new Set([...(settings.internRoles || []), 'Other'])));
    const employeeRoles = sortRoles(Array.from(new Set([...(settings.employeeRoles || []), 'Other'])));

    const responseBody = {
      success: true,
      company: {
        id: company._id,
        name: company.name,
        companyCode: company.companyCode,
        settings: {
          themeColor: settings.themeColor || '#00657F',
          internRoles: internRoles,
          employeeRoles: employeeRoles
        }
      }
    };

    res.json(responseBody);
  } catch (error) {
    console.error('Verify Error:', error);
    res.status(500).json({ success: false, msg: 'Server error during verification.' });
  }
});

module.exports = router;
