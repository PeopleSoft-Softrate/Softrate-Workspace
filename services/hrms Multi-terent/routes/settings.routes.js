const express = require('express');
const router = express.Router();
const { getMasterConnection, waitForConnection } = require('../db');
const CompanyModelExport = require('../models/CompanyModel');
const verifyTenant = require('../middleware/tenant.middleware');

/**
 * Helper: get the Company model from the master connection
 */
const getMasterCompany = async () => {
  const masterDb = getMasterConnection();
  await waitForConnection(masterDb);
  return masterDb.models.Company || masterDb.model('Company', CompanyModelExport.schema);
};

/**
 * @route GET /api/settings/company
 * @desc Get current company settings
 * @access Private (HR Admin)
 */
router.get('/company', verifyTenant, async (req, res) => {
  try {
    const Company = await getMasterCompany();
    const company = await Company.findById(req.tenant.companyId);
    if (!company) {
      return res.status(404).json({ success: false, msg: 'Company not found' });
    }

    const companyObj = company.toObject();
    const settings = companyObj.settings || {};
    const sortRoles = (roles) => {
      const filtered = roles.filter(r => r !== 'Other').sort((a, b) => a.localeCompare(b));
      return [...filtered, 'Other'];
    };

    const employeeRoles = sortRoles(Array.from(new Set([...(settings.employeeRoles || []), 'Other'])));
    const internRoles = sortRoles(Array.from(new Set([...(settings.internRoles || []), 'Other'])));

    res.json({
      success: true,
      settings: {
        ...settings,
        leavePolicies: companyObj.leavePolicies || settings.leavePolicies || [],
        internRoles: internRoles,
        employeeRoles: employeeRoles
      },
      workDurationSettings: companyObj.workDurationSettings || { hr: 8, manager: 8, employee: 8, intern: 6 },
      offerLetterSettings: company.settings?.offerLetterSettings || {},
      company: {
        name: company.name,
        companyCode: company.companyCode
      }
    });
  } catch (error) {
    console.error('Fetch Settings Error:', error);
    res.status(500).json({ success: false, msg: 'Server error fetching settings' });
  }
});

/**
 * @route PUT /api/settings/company
 * @desc Update company settings
 * @access Private (HR Admin)
 */
router.put('/company', verifyTenant, async (req, res) => {
  try {
    const { receivingEmail, themeColor, locations, communication, employeeRoles, internRoles, offerLetterSettings, payrollSettings, workDurationSettings, leavePolicies } = req.body;
    
    const Company = await getMasterCompany();
    const company = await Company.findById(req.tenant.companyId);
    if (!company) {
      return res.status(404).json({ success: false, message: 'Company not found' });
    }

    if (!company.settings) {
      company.settings = {};
    }

    if (receivingEmail !== undefined) company.settings.receivingEmail = receivingEmail;
    if (themeColor !== undefined) company.settings.themeColor = themeColor;
    if (locations !== undefined) company.settings.locations = locations;
    if (communication !== undefined) company.settings.communication = communication;
    if (employeeRoles !== undefined) company.settings.employeeRoles = employeeRoles;
    if (internRoles !== undefined) company.settings.internRoles = internRoles;
    
    if (leavePolicies !== undefined) {
      company.leavePolicies = leavePolicies;
      company.markModified('leavePolicies');

      try {
        const Employee = require('../models/EmployeeModel.js');
        const Intern = require('../models/Intern.js');
        const LeaveCounter = require('../models/leaveCounter.model.js');
        
        const employees = await Employee.find({ companyId: req.tenant.companyId, status: { $in: ['approved', 'ongoing'] } });
        const interns = await Intern.find({ companyId: req.tenant.companyId, status: { $in: ['approved', 'ongoing'] } });
        
        const now = new Date();
        
        const syncCounters = async (users, userType) => {
          for (const user of users) {
            const userId = userType === 'employee' ? user.EmployeeId : user.internid;
            if (!userId) continue;
            
            const existingCounters = await LeaveCounter.find({ companyId: req.tenant.companyId, employeeId: userId });
            
            for (const policy of leavePolicies) {
              if (policy.appliesTo === 'both' || policy.appliesTo === userType) {
                const existing = existingCounters.find(c => c.leaveType === policy.name);
                if (existing) {
                  if (existing.totalAllowed !== policy.allowance) {
                    const diff = policy.allowance - existing.totalAllowed;
                    existing.totalAllowed = policy.allowance;
                    existing.balance = existing.balance + diff;
                    await existing.save();
                  }
                } else {
                  const startDate = user.onboardingDate ? new Date(user.onboardingDate) : now;
                  const nextResetDate = new Date(startDate);
                  if (policy.frequency === 'monthly') {
                    nextResetDate.setMonth(now.getMonth() + 1);
                  } else {
                    nextResetDate.setFullYear(now.getFullYear() + 1);
                  }
                  
                  await LeaveCounter.create({
                    companyId: req.tenant.companyId,
                    employeeId: userId,
                    leaveType: policy.name,
                    totalAllowed: policy.allowance,
                    used: 0,
                    balance: policy.allowance,
                    cycleStartDate: startDate,
                    nextResetDate: nextResetDate
                  });
                }
              }
            }
          }
        };
        
        await syncCounters(employees, 'employee');
        await syncCounters(interns, 'intern');
        console.log(`[DEBUG] Synced leave policies for ${employees.length} employees and ${interns.length} interns.`);
      } catch (syncErr) {
        console.error('[DEBUG] Error syncing leave counters:', syncErr);
      }
    }
    
    if (offerLetterSettings !== undefined) {
      company.settings.offerLetterSettings = {
        ...company.settings.offerLetterSettings,
        ...offerLetterSettings
      };
      company.markModified('settings.offerLetterSettings');
    }

    if (payrollSettings !== undefined) {
      company.settings.payrollSettings = {
        ...company.settings.payrollSettings,
        ...payrollSettings
      };
      company.markModified('settings.payrollSettings');
    }

    // Work Duration Settings (stored at top-level, not inside settings)
    if (workDurationSettings !== undefined) {
      company.workDurationSettings = {
        ...company.workDurationSettings?.toObject?.() || company.workDurationSettings || {},
        ...workDurationSettings
      };
      company.markModified('workDurationSettings');
    }

    company.markModified('settings');
    await company.save();

    res.json({
      success: true,
      message: 'Settings updated successfully',
      settings: {
        ...company.settings,
        leavePolicies: company.leavePolicies
      },
      workDurationSettings: company.workDurationSettings,
      offerLetterSettings: company.settings.offerLetterSettings
    });
  } catch (error) {
    console.error('Update Settings Error:', error);
    res.status(500).json({ success: false, message: 'Server error updating settings' });
  }
});

/**
 * @route GET /api/settings/public
 * @desc Get public settings (locations) for mobile app
 * @access Private (Any Auth User)
 */
router.get('/public', verifyTenant, async (req, res) => {
  try {
    const Company = await getMasterCompany();
    const company = await Company.findById(req.tenant.companyId);
    if (!company) {
      return res.status(404).json({ success: false, message: 'Company not found' });
    }

    res.json({
      success: true,
      locations: company.settings?.locations || [],
      themeColor: company.settings?.themeColor || '#00657F',
      leavePolicies: company.settings?.leavePolicies || []
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
