const express = require('express');
const router = express.Router();
const verifyTenant = require('../middleware/tenant.middleware');
const User = require('../models/User');
const Role = require('../models/Role');
const Intern = require('../models/Intern');
const Employee = require('../models/EmployeeModel');
const Counter = require('../models/counter.model');
const { getMasterConnection, waitForConnection } = require('../db');
const CompanyModelExport = require('../models/CompanyModel');

/**
 * Helper: Generate Employee ID
 */
async function generateEmployeeId(companyId) {
  const masterDb = getMasterConnection();
  await waitForConnection(masterDb);
  const Company = masterDb.models.Company || masterDb.model('Company', CompanyModelExport.schema);
  const company = await Company.findById(companyId);
  const companyCode = company ? company.companyCode : "UNKNOWN";
  const counter = await Counter.findOneAndUpdate(
    { companyId: companyId, type: 'employee' },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return `${companyCode}-EMP-${String(counter.seq).padStart(3, "0")}`;
}

/**
 * @route POST /api/convert/intern-to-employee/:id
 * @desc Convert an Intern to a Full-time Employee
 * @access Manager, HR, HR_ADMIN
 */
router.post('/intern-to-employee/:id', verifyTenant, async (req, res) => {
  try {
    const { id } = req.params;
    let intern;

    // 1. Try finding by MongoDB ObjectId first
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      intern = await Intern.findOne({ _id: id, companyId: req.tenant.companyId });
    }

    // 2. Try finding by custom internid
    if (!intern) {
      intern = await Intern.findOne({ internid: id, companyId: req.tenant.companyId });
    }

    if (!intern) return res.status(404).json({ message: "Intern not found" });

    // 1. Create Employee Record
    const newEmployeeId = await generateEmployeeId(req.tenant.companyId);
    const employeeData = {
      companyId: req.tenant.companyId,
      EmployeeId: newEmployeeId,
      fullName: intern.fullName || "Unknown",
      email: intern.email || "no-email@provided.com",
      phone: intern.contact || intern.phone || "0000000000",
      department: intern.department || "General",
      role: intern.role || "Employee",
      status: 'approved',
      onboardingDate: new Date(),
      gender: intern.gender,
      nationality: intern.nationality,
      maritalStatus: intern.maritalStatus,
      qualification: intern.qualification,
      specialization: intern.specialization,
      college: intern.college,
      passingYear: intern.passingYear,
      address: intern.address
    };

    const newEmployee = new Employee(employeeData);
    await newEmployee.save();

    // 2. Update User Role to EMPLOYEE
    const employeeRole = await Role.findOne({ companyId: req.tenant.companyId, name: 'EMPLOYEE' });
    if (employeeRole && intern.email) {
      await User.findOneAndUpdate(
        { email: intern.email, companyId: req.tenant.companyId },
        { 
          roleId: employeeRole._id,
          'employment.type': 'FULL_TIME',
          'employment.status': 'approved'
        }
      );
    }

    // 3. Mark Intern as Completed/Archived
    intern.status = 'completed';
    await intern.save();

    res.json({ success: true, message: "Intern converted to employee successfully", employeeId: newEmployeeId });
  } catch (err) {
    console.error("Conversion Error:", err);
    res.status(500).json({ message: "Server error during conversion", error: err.message });
  }
});

/**
 * @route POST /api/convert/employee-to-manager/:id
 * @desc Convert an Employee to a Manager
 * @access HR, HR_ADMIN
 */
router.post('/employee-to-manager/:id', verifyTenant, async (req, res) => {
  try {
    const { id } = req.params;
    let employee;

    // 1. Try finding by MongoDB ObjectId first
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      employee = await Employee.findOne({ _id: id, companyId: req.tenant.companyId });
    }

    // 2. Try finding by custom EmployeeId
    if (!employee) {
      employee = await Employee.findOne({ 
        EmployeeId: { $regex: new RegExp(`^${id}$`, 'i') },
        companyId: req.tenant.companyId 
      });
    }

    if (!employee) return res.status(404).json({ message: "Employee not found" });

    // 1. Update Employee Record
    employee.isManager = true;
    employee.isHr = false; // Cannot be both Manager and HR
    await employee.save();

    // 2. Update User Role to MANAGER
    const managerRole = await Role.findOne({ companyId: req.tenant.companyId, name: 'MANAGER' });
    if (managerRole) {
      await User.findOneAndUpdate(
        { 
          email: { $regex: new RegExp(`^${employee.email.trim()}$`, 'i') }, 
          companyId: req.tenant.companyId 
        },
        { 
          roleId: managerRole._id,
          'employment.designation': employee.role || "Manager"
        }
      );
      console.log(`[DEBUG] Updated User login to MANAGER for: ${employee.email.trim()}`);
    }

    res.json({ success: true, message: "Employee promoted to manager successfully" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * @route POST /api/convert/to-hr/:id
 * @desc Convert an Employee or Manager to HR staff
 * @access HR_ADMIN
 */
router.post('/to-hr/:id', verifyTenant, async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`[DEBUG] Converting to HR: ${id}`);
    let staff;

    // 1. Try Employee collection
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      staff = await Employee.findOne({ _id: id, companyId: req.tenant.companyId });
    }
    if (!staff) {
      staff = await Employee.findOne({ 
        EmployeeId: { $regex: new RegExp(`^${id}$`, 'i') },
        companyId: req.tenant.companyId 
      });
    }

    // 2. Try Intern collection if not found in Employee
    if (!staff) {
      if (id.match(/^[0-9a-fA-F]{24}$/)) {
        staff = await Intern.findOne({ _id: id, companyId: req.tenant.companyId });
      }
      if (!staff) {
        staff = await Intern.findOne({ 
          internid: { $regex: new RegExp(`^${id}$`, 'i') },
          companyId: req.tenant.companyId 
        });
      }
    }

    if (!staff) {
      console.log(`[DEBUG] Staff not found for conversion: ${id}`);
      return res.status(404).json({ message: "Staff member not found in Employee or Intern records" });
    }

    // 3. Update User Role to HR
    const hrRole = await Role.findOne({ companyId: req.tenant.companyId, name: 'HR' });
    if (!hrRole) {
      console.log(`[DEBUG] HR Role not found for company: ${req.tenant.companyId}`);
      return res.status(404).json({ message: "HR role definition not found for this company" });
    }

    // 4. Update the actual Staff record (Employee or Intern) to reflect the role change
    staff.isHr = true;
    if (staff.isManager !== undefined) {
      staff.isManager = false; // Cannot be both Manager and HR
    }
    await staff.save();

    let updatedUser = await User.findOneAndUpdate(
      { 
        email: { $regex: new RegExp(`^${staff.email.trim()}$`, 'i') }, 
        companyId: req.tenant.companyId 
      },
      { 
        roleId: hrRole._id,
        'employment.designation': "HR Staff"
      },
      { new: true }
    );

    // If no User record exists (common for some interns), create one now
    if (!updatedUser) {
      console.log(`[DEBUG] Creating new User record for promoted staff: ${staff.email.trim()}`);
      updatedUser = new User({
        companyId: req.tenant.companyId,
        email: staff.email.toLowerCase().trim(),
        password: staff.password || "$2b$10$rlYmvXlsymD6YEWxifXpq.tc5jXK1U1QkWN4oaGMUf015rmGqaO4m", 
        roleId: hrRole._id,
        profile: {
          firstName: staff.fullName.split(' ')[0],
          lastName: staff.fullName.split(' ').slice(1).join(' ') || ''
        },
        employment: {
          designation: "HR Staff",
          status: 'approved'
        }
      });
      await updatedUser.save();
    }

    console.log(`[DEBUG] Successfully updated user role to HR for: ${staff.email.trim()}`);
    res.json({ success: true, message: `Successfully converted ${staff.fullName} to HR staff` });
  } catch (err) {
    console.error("HR Conversion Error:", err);
    res.status(500).json({ message: "Server error during conversion: " + err.message });
  }
});

/**
 * @route POST /api/convert/hr-to-manager/:id
 * @desc Demote an HR staff member back to a Manager
 * @access HR_ADMIN
 */
router.post('/hr-to-manager/:id', verifyTenant, async (req, res) => {
  try {
    const { id } = req.params;
    let employee;

    // 1. Try finding by MongoDB ObjectId
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      employee = await Employee.findOne({ _id: id, companyId: req.tenant.companyId });
    }
    // 2. Try finding by custom EmployeeId
    if (!employee) {
      employee = await Employee.findOne({ 
        EmployeeId: { $regex: new RegExp(`^${id}$`, 'i') },
        companyId: req.tenant.companyId 
      });
    }

    if (!employee) return res.status(404).json({ message: "Employee not found" });

    // 1. Update Employee Record
    employee.isHr = false;
    employee.isManager = true; // Set back to manager status
    await employee.save();

    // 2. Update User Role to MANAGER
    const managerRole = await Role.findOne({ companyId: req.tenant.companyId, name: 'MANAGER' });
    if (managerRole) {
      await User.findOneAndUpdate(
        { email: { $regex: new RegExp(`^${employee.email.trim()}$`, 'i') }, companyId: req.tenant.companyId },
        { 
          roleId: managerRole._id,
          'employment.designation': "Manager"
        }
      );
    }

    res.json({ success: true, message: "HR staff demoted to manager successfully" });
  } catch (err) {
    console.error("Demotion Error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * @route POST /api/convert/manager-to-employee/:id
 * @desc Demote a Manager back to a regular Employee
 * @access HR, HR_ADMIN
 */
router.post('/manager-to-employee/:id', verifyTenant, async (req, res) => {
  try {
    const { id } = req.params;
    let employee;

    // 1. Try finding by MongoDB ObjectId
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      employee = await Employee.findOne({ _id: id, companyId: req.tenant.companyId });
    }
    // 2. Try finding by custom EmployeeId
    if (!employee) {
      employee = await Employee.findOne({ 
        EmployeeId: { $regex: new RegExp(`^${id}$`, 'i') },
        companyId: req.tenant.companyId 
      });
    }

    if (!employee) return res.status(404).json({ message: "Employee not found" });

    // 1. Update Employee Record
    employee.isManager = false;
    await employee.save();

    // 2. Update User Role to EMPLOYEE
    const employeeRole = await Role.findOne({ companyId: req.tenant.companyId, name: 'EMPLOYEE' });
    if (employeeRole) {
      await User.findOneAndUpdate(
        { email: { $regex: new RegExp(`^${employee.email.trim()}$`, 'i') }, companyId: req.tenant.companyId },
        { 
          roleId: employeeRole._id,
          'employment.designation': employee.role || "Employee"
        }
      );
    }

    res.json({ success: true, message: "Manager demoted to employee successfully" });
  } catch (err) {
    console.error("Demotion Error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * @route POST /api/convert/terminate/:id
 * @desc Terminate an Intern, Employee, Manager, or HR
 * @access HR, HR_ADMIN
 */
router.post('/terminate/:id', verifyTenant, async (req, res) => {
  try {
    const { id } = req.params;
    const { type, reason } = req.body; // type is 'intern' or 'employee'

    if (!reason || reason.trim() === '') {
      return res.status(400).json({ message: "Termination reason is required." });
    }

    // Identify user making the request
    const callerUser = await User.findById(req.user.id).populate('roleId');
    const callerRoleName = callerUser?.roleId?.name;

    let targetRecord;
    let targetEmail;
    
    if (type === 'intern') {
      if (id.match(/^[0-9a-fA-F]{24}$/)) {
        targetRecord = await Intern.findOne({ _id: id, companyId: req.tenant.companyId });
      }
      if (!targetRecord) {
        targetRecord = await Intern.findOne({ internid: { $regex: new RegExp(`^${id}$`, 'i') }, companyId: req.tenant.companyId });
      }
      if (!targetRecord) return res.status(404).json({ message: "Intern not found" });
      
      targetEmail = targetRecord.email;
    } else {
      if (id.match(/^[0-9a-fA-F]{24}$/)) {
        targetRecord = await Employee.findOne({ _id: id, companyId: req.tenant.companyId });
      }
      if (!targetRecord) {
        targetRecord = await Employee.findOne({ EmployeeId: { $regex: new RegExp(`^${id}$`, 'i') }, companyId: req.tenant.companyId });
      }
      if (!targetRecord) return res.status(404).json({ message: "Employee not found" });
      
      targetEmail = targetRecord.email;
    }

    // Check permissions: Only HR_ADMIN can terminate HR
    if (targetRecord.isHr && callerRoleName !== 'HR_ADMIN') {
      return res.status(403).json({ message: "Only HR_ADMIN can terminate HR staff." });
    }
    
    // Update target record
    const newStatus = type === 'intern' ? 'drop' : 'resigned';
    targetRecord.status = newStatus;
    targetRecord.terminationReason = reason;
    targetRecord.terminationDate = new Date();
    await targetRecord.save();

    // Update User account
    if (targetEmail) {
      await User.findOneAndUpdate(
        { email: { $regex: new RegExp(`^${targetEmail.trim()}$`, 'i') }, companyId: req.tenant.companyId },
        { 
          'employment.status': newStatus,
          'employment.endDate': new Date()
        }
      );
    }

    res.json({ success: true, message: `Staff member marked as ${newStatus} successfully` });
  } catch (err) {
    console.error("Termination Error:", err);
    res.status(500).json({ message: "Server error during termination", error: err.message });
  }
});

module.exports = router;
