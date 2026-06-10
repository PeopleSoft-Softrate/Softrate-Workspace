const express = require("express");
const Employee = require("../models/EmployeeModel");
const LeaveCounter = require("../models/leaveCounter.model"); 
const { sendEmail, LOGO_URL } = require("../utilities/sendEmail");
const { getSignature } = require("../utilities/emailSignature");
const multer = require("multer");
const ExcelJS = require("exceljs");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const verifyTenant = require("../middleware/tenant.middleware");


const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

/* ============================
   ADD / ONBOARD (INITIAL)
============================ */
const User = require("../models/User");
const Role = require("../models/Role");

const verifyPublicTenant = require("../middleware/publicTenant.middleware");

router.post(
  "/add",
  upload.any(), // parse multipart/form-data FIRST
  verifyPublicTenant,
  async (req, res) => {
    try {
      console.log("BODY:", req.body);   // employee fields
      
      // 1. Check if user already exists in this company
      const existingUser = await User.findOne({ companyId: req.tenant.companyId, email: req.body.email });
      if (existingUser) {
        return res.status(400).json({ message: "An application with this email already exists for this company." });
      }

      // 2. Find or Create the Default EMPLOYEE Role for this company
      let employeeRole = await Role.findOne({ companyId: req.tenant.companyId, name: 'EMPLOYEE' });
      if (!employeeRole) {
        employeeRole = new Role({
          companyId: req.tenant.companyId,
          name: 'EMPLOYEE',
          description: 'Standard employee permissions',
          permissions: ['VIEW_DASHBOARD', 'REQUEST_LEAVE'],
          isSystemDefined: true
        });
        await employeeRole.save();
      }

      // Parse projectLinks (sent as JSON string from Flutter)
      let projectLinks = [];
      try {
        if (req.body.projectLinks) {
          projectLinks = JSON.parse(req.body.projectLinks);
          if (!Array.isArray(projectLinks)) projectLinks = [];
          projectLinks = projectLinks.filter(l => l && l.trim()).slice(0, 5);
        }
      } catch (_) { projectLinks = []; }

      // 3. Create User in unified collection
      const newUser = new User({
        companyId: req.tenant.companyId,
        email: req.body.email,
        password: req.tenant.defaultPassword, // Set to company's default password, will require reset
        roleId: employeeRole._id,
        profile: {
          firstName: req.body.fullName,
          phone: req.body.phone,
          dob: req.body.dob,
          address: req.body.address,
          gender: req.body.gender,
          nationality: req.body.nationality,
          maritalStatus: req.body.maritalStatus,
          emergencyContact: {
            name: req.body.emergencyName,
            phone: req.body.emergencyPhone
          }
        },
        employment: {
          type: 'FULL_TIME',
          designation: req.body.designation || req.body.role,
          status: 'ONBOARDING'
        },
        system: {
          onboardingStatus: 'initial',
          declaration: req.body.declaration === 'true' || req.body.declaration === true,
          bgConsent: req.body.bgConsent === 'true' || req.body.bgConsent === true,
          whatsappConsent: req.body.whatsappConsent === 'true' || req.body.whatsappConsent === true
        }
      });

      await newUser.save();

      // 4. Create Employee in legacy collection (Backward Compatibility)
      const newEmployee = new Employee({
        companyId: req.tenant.companyId,
        fullName: req.body.fullName,
        email: req.body.email,
        phone: req.body.phone,
        emergencyName: req.body.emergencyName,
        emergencyPhone: req.body.emergencyPhone,
        dob: req.body.dob,
        address: req.body.address,
        role: req.body.designation || req.body.role,
        linkedin: req.body.linkedin,
        gender: req.body.gender,
        nationality: req.body.nationality,
        maritalStatus: req.body.maritalStatus,
        declaration: req.body.declaration === 'true' || req.body.declaration === true,
        bgConsent: req.body.bgConsent === 'true' || req.body.bgConsent === true,
        whatsappConsent: req.body.whatsappConsent === 'true' || req.body.whatsappConsent === true,
        projectLinks,
        completeDetails: false,
        status: 'initial',
        password: req.tenant.defaultPassword // Backward compatibility
      });

      await newEmployee.save();

      // Trigger Real-Time Dashboard/Approvals Update
      const io = req.app.get('io');
      if (io) {
        io.emit('activity-updated', { type: 'new_employee', employee: newEmployee });
      }

      // Send initial application email to HR (no file attachments on initial submission)
      await sendEmail({
        to: req.tenant.receivingEmail,
        subject: `New Employee Application: ${req.body.fullName}`,
        html: `
          <h3>New employee application received</h3>
          <p><b>Name:</b> ${req.body.fullName}</p>
          <p><b>Email:</b> ${req.body.email}</p>
          <p><b>Phone:</b> ${req.body.phone}</p>
          <p><b>Role:</b> ${req.body.role || req.body.designation || ''}</p>
          <p><b>LinkedIn:</b> ${req.body.linkedin || 'N/A'}</p>
          <p><i>Note: Education, experience &amp; identification documents will be submitted after first login.</i></p>
        `,
        replyTo: req.tenant.receivingEmail,
      });

      res.status(201).json({ message: "Employee submitted & email sent", userId: newUser._id, employeeMongoId: newEmployee._id });
    } catch (err) {
      console.error("Employee Add Error:", err);
      res.status(500).json({ message: "Server error", error: err.message });
    }
  }
);

/* ============================
   COMPLETE DETAILS (post-login)
   Saves deferred education/experience/docs fields.
   Emails uploaded files to company communication email.
   Sets completeDetails = true.
============================ */
router.post(
  "/complete-details/:id",
  upload.any(),
  verifyTenant,
  async (req, res) => {
    try {
      const { id } = req.params;
      let query = { companyId: req.tenant.companyId };
      if (id.match(/^[0-9a-fA-F]{24}$/)) {
        query._id = id;
      } else {
        query.EmployeeId = { $regex: new RegExp(`^${id}$`, 'i') };
      }

      const employee = await Employee.findOne(query);
      if (!employee) return res.status(404).json({ message: "Employee not found" });

      // Parse projectLinks if re-submitted
      let projectLinks = employee.projectLinks || [];
      try {
        if (req.body.projectLinks) {
          const parsed = JSON.parse(req.body.projectLinks);
          if (Array.isArray(parsed)) {
            projectLinks = parsed.filter(l => l && l.trim()).slice(0, 5);
          }
        }
      } catch (_) {}

      // Update deferred fields
      employee.qualification = req.body.qualification || employee.qualification;
      employee.specialization = req.body.specialization || employee.specialization;
      employee.college = req.body.college || employee.college;
      employee.passingYear = req.body.passingYear || employee.passingYear;
      employee.ugCgpa = req.body.ugCgpa ? Number(req.body.ugCgpa) : employee.ugCgpa;
      employee.pgCgpa = req.body.pgCgpa ? Number(req.body.pgCgpa) : employee.pgCgpa;
      employee.isExperienced = req.body.isExperienced === 'true' || req.body.isExperienced === true;
      employee.experienceYears = req.body.experienceYears || employee.experienceYears;
      employee.previousOrg = req.body.previousOrg || employee.previousOrg;
      employee.designation = req.body.designation || employee.designation;
      employee.projectLinks = projectLinks;
      employee.completeDetails = true;

      await employee.save();

      // Sync education/experience to User record as well
      await User.findOneAndUpdate(
        { email: { $regex: new RegExp(`^${employee.email.trim()}$`, 'i') }, companyId: req.tenant.companyId },
        {
          $set: {
            'education.qualification': employee.qualification,
            'education.specialization': employee.specialization,
            'education.college': employee.college,
            'education.passingYear': employee.passingYear,
            'education.ugCgpa': employee.ugCgpa,
            'education.pgCgpa': employee.pgCgpa,
            'experience.isExperienced': employee.isExperienced,
            'experience.years': employee.experienceYears,
            'experience.previousOrg': employee.previousOrg,
            'experience.designation': employee.designation,
          }
        }
      );

      // Email uploaded files to company communication email
      const attachments = (req.files || []).map(file => ({
        filename: `${file.fieldname}-${file.originalname}`,
        content: file.buffer,
      }));

      if (attachments.length > 0) {
        await sendEmail({
          to: req.tenant.receivingEmail,
          subject: `Employee Documents Submitted: ${employee.fullName} (${employee.EmployeeId || employee.email})`,
          html: `
            <h3>Employee documents received</h3>
            <p><b>Name:</b> ${employee.fullName}</p>
            <p><b>Email:</b> ${employee.email}</p>
            <p><b>Employee ID:</b> ${employee.EmployeeId || 'Pending Approval'}</p>
            <p>The employee has completed their profile details. Attached documents are included above.</p>
          `,
          attachments,
          replyTo: req.tenant.receivingEmail,
        });
      }

      res.json({ success: true, message: "Details saved successfully", completeDetails: true });
    } catch (err) {
      console.error("Complete Details Error:", err);
      res.status(500).json({ message: "Server error", error: err.message });
    }
  }
);


/* ============================
   GET INITIAL EMPLOYEES
============================ */
router.get("/all/initial", verifyTenant, async (req, res) => {
  const query = { status: "initial", companyId: req.tenant.companyId };
  if (req.user && req.user.role === 'manager') {
    query.assignedManager = req.user.id;
  }
  const employees = await Employee.find(query);
  res.json(employees);
});

/* ============================
   GET ACTIVE EMPLOYEES
============================ */
/* ===================================================
   GET ALL PENDING EMPLOYEES (status: initial) — for HR Approvals Hub
=================================================== */
router.get("/all/pending", verifyTenant, async (req, res) => {
  try {
    const query = {
      status: "initial",
      companyId: req.tenant.companyId
    };
    if (req.user && req.user.role === 'manager') {
      query.assignedManager = req.user.id;
    }
    const employees = await Employee.find(query)
      .sort({ EmployeeId: 1 })
      .lean();
    res.json(employees);
  } catch (err) {
    console.error("Fetch Pending Employees Error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/all/active", verifyTenant, async (req, res) => {
  try {
    const { range = "all", status = "all" } = req.query;

    const statusFilter = status === "all" ? ["approved", "ongoing"] : [status];

    const query = { status: { $in: statusFilter }, companyId: req.tenant.companyId };

    if (req.user && req.user.role === 'manager') {
      query.assignedManager = req.user.id;
    }

    const now = new Date();
    let start, end;

    if (range === "thisMonth") {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    } else if (range === "sixMonths") {
      start = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    } else if (range === "all") {
      // ✅ ALL TIME - no date filter
      start = null;
      end = null;
    }

    // ✅ FIXED: Use submittedAt instead of createdAt
    if (start && end) {
      query.submittedAt = { $gte: start, $lte: end };
    }

    const employees = await Employee.find(query)
      .sort({ EmployeeId: 1 })
      .lean();

    console.log(`Found ${employees.length} employees`);
    res.json(employees);
  } catch (err) {
    console.error("Fetch Active Employees Error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ============================
   GET SINGLE EMPLOYEE
============================ */
router.get("/get/:id", verifyTenant, async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`[DEBUG] Fetching employee with ID: ${id}`);
    
    let employee;
    
    // 1. Try finding by MongoDB ObjectId first
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      employee = await Employee.findOne({ _id: id, companyId: req.tenant.companyId });
    } 
    
    // 2. If not found or not an ObjectId, try finding by custom EmployeeId (case-insensitive)
    if (!employee) {
      employee = await Employee.findOne({ 
        EmployeeId: { $regex: new RegExp(`^${id}$`, 'i') },
        companyId: req.tenant.companyId 
      });
    }

    if (!employee) {
      console.log(`[DEBUG] Employee NOT found for ID: ${id}`);
      return res.status(404).json({ message: "Employee not found" });
    }
    
    console.log(`[DEBUG] Employee found: ${employee.fullName} (${employee.EmployeeId || 'No custom ID'})`);
    res.json({ employee });
  } catch (err) {
    console.error("Fetch Single Employee Error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ============================
   GET EMPLOYEE PROFILE PHOTO
============================ */
router.get("/profile-photo/:id", async (req, res, next) => {
  if (req.query.token) {
    req.headers['authorization'] = `Bearer ${req.query.token}`;
  }
  next();
}, verifyTenant, async (req, res) => {
  try {
    const { id } = req.params;
    let employee;
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      employee = await Employee.findById(id).select('+profilePhoto.data');
    } else {
      employee = await Employee.findOne({ EmployeeId: { $regex: new RegExp(`^${id}$`, 'i') } }).select('+profilePhoto.data');
    }
    if (!employee) return res.status(404).send("Employee not found");

    if (employee.profilePhoto && employee.profilePhoto.data) {
      res.set("Content-Type", employee.profilePhoto.contentType || "image/png");
      return res.send(employee.profilePhoto.data);
    }

    const user = await User.findOne({ email: { $regex: new RegExp(`^${employee.email.trim()}$`, 'i') } }).select('+profilePhoto.data');
    if (!user || !user.profilePhoto || !user.profilePhoto.data) {
      return res.status(404).send("No photo");
    }

    res.set("Content-Type", user.profilePhoto.contentType || "image/png");
    res.send(user.profilePhoto.data);
  } catch (err) {
    console.error("Fetch Employee Photo Error:", err);
    res.status(500).send("Server error");
  }
});

/* ============================
   ACCEPT EMPLOYEE (PDF + MAIL)
============================ */
router.put("/accept/:id", verifyTenant, async (req, res) => {
  try {
    const { onboardingDate } = req.body;
    const employee = await Employee.findOne({ _id: req.params.id, companyId: req.tenant.companyId });
    if (!employee) return res.status(404).json({ message: "Employee not found" });

    // Generate unique Employee ID
    const newEmployeeId = await generateEmployeeId(req.tenant.companyId);
    employee.EmployeeId = newEmployeeId;
    employee.status = "approved";
    employee.onboardingDate = onboardingDate;

    await employee.save();

    // 2. Synchronize with User Record (Unified Collection)
    const updatedUser = await User.findOneAndUpdate(
      { email: { $regex: new RegExp(`^${employee.email.trim()}$`, 'i') }, companyId: req.tenant.companyId },
      { 
        'employment.status': 'approved',
        'employment.joinedAt': onboardingDate,
        'system.onboardingStatus': 'completed'
      },
      { new: true }
    );

    if (updatedUser) {
      console.log(`[DEBUG] Updated User record for approved employee: ${employee.email}`);
    } else {
      console.log(`[DEBUG] Warning: No User record found for approved employee: ${employee.email}`);
    }

    // 3. Initialize leave counter
    const startDate = new Date(onboardingDate);

    // Fetch dynamic leave policies
    const Company = await _getMasterCompany();
    const company = await Company.findById(req.tenant.companyId);
    let leavePolicies = company?.leavePolicies;
    if (!leavePolicies || leavePolicies.length === 0) {
      leavePolicies = [
        { name: 'Casual Leave', allowance: 12, frequency: 'annual', appliesTo: 'both' },
        { name: 'Sick Leave', allowance: 12, frequency: 'annual', appliesTo: 'both' }
      ];
    }

    const records = [];
    for (const p of leavePolicies) {
      if (p.appliesTo === 'both' || p.appliesTo === 'employee') {
        const nextResetDate = new Date(startDate);
        if (p.frequency === 'monthly') {
          nextResetDate.setMonth(startDate.getMonth() + 1);
        } else {
          nextResetDate.setFullYear(startDate.getFullYear() + 1);
        }
        
        records.push({
          companyId: req.tenant.companyId,
          employeeId: newEmployeeId,
          leaveType: p.name,
          totalAllowed: p.allowance,
          used: 0,
          balance: p.allowance,
          cycleStartDate: startDate,
          nextResetDate: nextResetDate,
        });
      }
    }

    try {
      if (records.length > 0) {
        await LeaveCounter.insertMany(records, { ordered: false });
        console.log(`[DEBUG] Initialized leave counters for employee ${newEmployeeId}:`, records.length);
      }
    } catch (err) {
      console.error("[DEBUG] Error initializing leave counters:", err);
    }

    // 4. Send approval email
    try {
      const Company = await _getMasterCompany();
      const company = await Company.findById(req.tenant.companyId);
      const template = company?.settings?.communication?.onboardingTemplateEmployee;
      const customSignature = company?.settings?.communication?.emailSignatureUrl;
      const customLogo = company?.settings?.communication?.emailLogoUrl;
      
      const signatureHtml = customSignature 
        ? `<div style="margin-top: 30px;"><img src="${customSignature}" alt="Company Signature" style="max-height: 80px; display: block;" /></div>`
        : getSignature(LOGO_URL);

      const logoHtml = customLogo
        ? `<div style="margin-bottom: 20px;"><img src="${customLogo}" alt="Company Logo" style="max-height: 60px; display: block;" /></div>`
        : `<div style="margin-bottom: 20px;"><img src="${LOGO_URL}" alt="Company Logo" style="max-height: 60px; display: block;" /></div>`;

      let htmlContent = "";
      if (template) {
        htmlContent = template
          .replace(/{formattedName}/g, employee.fullName)
          .replace(/{employeeId}/g, newEmployeeId)
          .replace(/{onboardingDate}/g, onboardingDate)
          .replace(/{signature}/g, signatureHtml)
          .replace(/{logo}/g, logoHtml);
      } else {
        htmlContent = `<div style="font-family: sans-serif; line-height: 1.6; color: #333;">
                 <h2>Hi ${employee.fullName},</h2>
                 <p>Your profile has been <b>approved</b> 🎉</p>
                 <p><b>Employee ID:</b> ${newEmployeeId}</p>
                 <p><b>Onboarding Date:</b> ${onboardingDate}</p>
                 ${signatureHtml}
               </div>`;
      }

      await sendEmail({
        to: employee.email,
        subject: "Your Employee ID is Ready",
        html: htmlContent,
      });
      console.log(`[DEBUG] Approval email sent to: ${employee.email}`);
    } catch (emailErr) {
      console.error("[DEBUG] Failed to send approval email:", emailErr);
      // We do NOT return error here, because the DB records are already updated successfully
    }

    res.json({ success: true, message: "Employee approved & onboarded successfully", employee });
  } catch (err) {
    console.error("Employee Accept Error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

/* ============================
   REJECT EMPLOYEE / DELETE
============================ */
router.delete("/delete/:id", verifyTenant, async (req, res) => {
  try {
    const { id } = req.params;
    let query = { companyId: req.tenant.companyId };
    
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      query._id = id;
    } else {
      query.EmployeeId = { $regex: new RegExp(`^${id}$`, 'i') };
    }

    const employee = await Employee.findOneAndDelete(query);

    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    res.json({ message: "Employee deleted successfully", employee });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
});

// Alias for delete to match some frontend calls
router.delete("/reject/:id", verifyTenant, async (req, res) => {
  try {
    const { id } = req.params;
    let query = { companyId: req.tenant.companyId };
    
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      query._id = id;
    } else {
      query.EmployeeId = { $regex: new RegExp(`^${id}$`, 'i') };
    }

    const employee = await Employee.findOneAndDelete(query);
    if (!employee) return res.status(404).json({ message: "Employee not found" });
    res.json({ message: "Employee rejected/deleted", employee });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
});

const authController = require("../controllers/AuthController");
router.post("/login", authController.login);

/* ============================
   MANAGER LOGIN (BY EMAIL)
============================ */
router.post("/manager/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const manager = await Employee.findOne({ email: { $regex: new RegExp(`^${email}$`, 'i') }, isManager: true });

    if (!manager) {
      return res.status(404).json({ message: "Manager not found or unauthorized" });
    }

    if (!manager.password) {
      manager.password = password;
      await manager.save();
      return res.json({ message: "First-time password set", firstTime: true, manager });
    }

    let isMatch = false;
    if (manager.password.length === 60 || manager.password.startsWith('$2a$') || manager.password.startsWith('$2b$')) {
        isMatch = await bcrypt.compare(password, manager.password);
    } else {
        isMatch = (manager.password === password);
        if (isMatch) {
            const salt = await bcrypt.genSalt(10);
            manager.password = await bcrypt.hash(password, salt);
            await manager.save();
        }
    }

    if (!isMatch) {
      return res.status(401).json({ message: "Wrong password" });
    }

    const token = jwt.sign(
      { user: { id: manager.id, companyId: manager.companyId, role: 'manager' } },
      process.env.JWT_SECRET || 'fallback_secret_key',
      { expiresIn: '1d' }
    );

    res.json({ message: "Login successful", firstTime: false, manager, token });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

/* ============================
   EMPLOYEE ID GENERATOR
============================ */
const Counter = require("../models/counter.model");
const { getMasterConnection: _getMasterConn, waitForConnection: _waitConn } = require("../db");
const CompanyModelExport = require("../models/CompanyModel");
async function _getMasterCompany() {
  const db = _getMasterConn();
  await _waitConn(db);
  return db.models.Company || db.model("Company", CompanyModelExport.schema);
}

async function generateEmployeeId(companyId) {
  const Company = await _getMasterCompany();
  const company = await Company.findById(companyId);
  const companyCode = company ? company.companyCode : "UNKNOWN";

  const year = new Date().getFullYear().toString().slice(-2);
  let counter;
  let employeeId;

  do {
    counter = await Counter.findOneAndUpdate(
      { companyId: companyId, type: 'employee', year: year },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );

    employeeId = `${year}2${String(counter.seq).padStart(3, "0")}`;
  } while (await Employee.exists({ EmployeeId: employeeId, companyId: companyId }));

  return employeeId;
}



router.get("/export/excel/all-employees", verifyTenant, async (req, res) => {
  try {
    const { status = "all", from, to, managerId } = req.query;

    const query =
      status === "all"
        ? { companyId: req.tenant.companyId }
        : { status, companyId: req.tenant.companyId };

    if (req.user && req.user.role === 'manager') {
      query.assignedManager = req.user.id;
    } else if (managerId) {
      query.assignedManager = managerId;
    }

    let employees = await Employee.find(query).sort({ submittedAt: -1 });

    if (from && to) {
      const fromDate = new Date(from);
      const toDate = new Date(to);
      toDate.setHours(23, 59, 59, 999);

      employees = employees.filter((emp) => {
        if (!emp.onboardingDate) return false;
        const onboardDate = new Date(emp.onboardingDate);
        if (isNaN(onboardDate)) return false;
        return onboardDate >= fromDate && onboardDate <= toDate;
      });
    }

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Employees");

    sheet.columns = [
      { header: "Employee ID", key: "EmployeeId", width: 18 },
      { header: "Full Name", key: "fullName", width: 25 },
      { header: "Email", key: "email", width: 30 },
      { header: "Phone", key: "phone", width: 18 },
      { header: "Status", key: "status", width: 15 },
      { header: "Role", key: "role", width: 20 },
      { header: "Onboarding Date", key: "onboardingDate", width: 18 },
      { header: "Date of Birth", key: "dob", width: 15 },
      { header: "Gender", key: "gender", width: 12 },
      { header: "Nationality", key: "nationality", width: 15 },
      { header: "Marital Status", key: "maritalStatus", width: 15 },

      // Education
      { header: "Qualification", key: "qualification", width: 18 },
      { header: "Specialization", key: "specialization", width: 20 },
      { header: "College", key: "college", width: 25 },
      { header: "Passing Year", key: "passingYear", width: 15 },

      // CGPA
      { header: "UG CGPA", key: "ugCgpa", width: 12 },
      { header: "PG CGPA", key: "pgCgpa", width: 12 },

      // Experience
      { header: "Experienced", key: "isExperienced", width: 15 },
      { header: "Experience Years", key: "experienceYears", width: 18 },
      { header: "Previous Organization", key: "previousOrg", width: 25 },
      { header: "Designation", key: "designation", width: 20 },

      // Emergency
      { header: "Emergency Contact Name", key: "emergencyName", width: 25 },
      { header: "Emergency Contact Phone", key: "emergencyPhone", width: 20 },

      { header: "Submitted At", key: "submittedAt", width: 22 },
    ];

    employees.forEach((emp) => {
      sheet.addRow({
        EmployeeId: emp.EmployeeId || "",
        fullName: emp.fullName || "",
        email: emp.email || "",
        phone: emp.phone || "",
        status: emp.status || "",
        role: emp.role || "",
        onboardingDate: emp.onboardingDate
          ? new Date(emp.onboardingDate).toLocaleDateString("en-GB")
          : "",
        dob: emp.dob
          ? new Date(emp.dob).toLocaleDateString("en-GB")
          : "",
        gender: emp.gender || "",
        nationality: emp.nationality || "",
        maritalStatus: emp.maritalStatus || "",

        qualification: emp.qualification || "",
        specialization: emp.specialization || "",
        college: emp.college || "",
        passingYear: emp.passingYear || "",

        ugCgpa: emp.ugCgpa ?? "",
        pgCgpa: emp.pgCgpa ?? "",

        isExperienced: emp.isExperienced ? "Yes" : "No",
        experienceYears: emp.experienceYears || "",
        previousOrg: emp.previousOrg || "",
        designation: emp.designation || "",

        emergencyName: emp.emergencyName || "",
        emergencyPhone: emp.emergencyPhone || "",

        submittedAt: emp.submittedAt
          ? new Date(emp.submittedAt).toLocaleDateString("en-GB")
          : "",
      });
    });

    // Header styling
    sheet.getRow(1).font = { bold: true };

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=Employee_Data.xlsx"
    );

    await workbook.xlsx.write(res);
    res.end();

  } catch (err) {
    console.error("Employee Excel Export Error:", err);
    res.status(500).json({ message: "Employee Excel export failed" });
  }
});


// Toggle Manager Status
router.put("/toggle-manager/:id", verifyTenant, async (req, res) => {
  try {
    const { id } = req.params;
    const employee = await Employee.findOne({ _id: id, companyId: req.tenant.companyId });
    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    employee.isManager = !employee.isManager;
    await employee.save();

    res.json({ 
      message: `Employee ${employee.isManager ? 'promoted to' : 'removed from'} manager role`,
      isManager: employee.isManager 
    });
  } catch (err) {
    console.error("Toggle Manager Error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.put("/update/:id", verifyTenant, async (req, res) => {
  try {
    const { id } = req.params;
    let query = { companyId: req.tenant.companyId };
    
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      query._id = id;
    } else {
      query.EmployeeId = { $regex: new RegExp(`^${id}$`, 'i') };
    }

    const updatedEmployee = await Employee.findOneAndUpdate(
      query,
      { $set: req.body },
      { new: true }
    );

    if (!updatedEmployee) return res.status(404).json({ message: "Employee not found" });

    // Sync with User record if email, profile fields, or payroll changed
    if (req.body.email || req.body.fullName || req.body.phone || req.body.payroll) {
      const updateData = {};
      if (req.body.fullName) updateData['profile.firstName'] = updatedEmployee.fullName;
      if (req.body.phone) updateData['profile.phone'] = updatedEmployee.phone;
      if (req.body.designation || req.body.role) updateData['employment.designation'] = updatedEmployee.designation || updatedEmployee.role;
      if (req.body.payroll) updateData['payroll'] = updatedEmployee.payroll;

      await User.findOneAndUpdate(
        { email: { $regex: new RegExp(`^${updatedEmployee.email.trim()}$`, 'i') }, companyId: req.tenant.companyId },
        { $set: updateData }
      );
    }

    res.json({ message: "Employee updated successfully", employee: updatedEmployee });
  } catch (err) {
    console.error("Employee Update Error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

/* ============================
   ASSIGN EMPLOYEE TO MANAGER
============================ */
router.put("/assign-manager/:id", verifyTenant, async (req, res) => {
  try {
    const { managerId } = req.body;
    const employee = await Employee.findById(req.params.id);
    if (!employee) return res.status(404).json({ message: "Employee not found" });

    employee.assignedManager = managerId;
    employee.managerApprovalStatus = "pending";
    await employee.save();

    res.json({ message: "Employee assigned to manager", employee });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
});

/* ============================
   GET EMPLOYEES ASSIGNED TO MANAGER (INITIAL STATUS)
============================ */
router.get("/assigned-to/:managerId", verifyTenant, async (req, res) => {
  try {
    const employees = await Employee.find({ 
      assignedManager: req.params.managerId,
      status: "initial"
    });
    res.json(employees);
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
});

/* ============================
   MANAGER REVIEW OF EMPLOYEE ONBOARDING
============================ */
router.put("/manager-review/:id", verifyTenant, async (req, res) => {
  try {
    const { status, remarks } = req.body; // status: 'approved' | 'rejected'
    const employee = await Employee.findById(req.params.id);
    if (!employee) return res.status(404).json({ message: "Employee not found" });

    employee.managerApprovalStatus = status;
    employee.managerRemarks = remarks;
    await employee.save();

    res.json({ message: `Employee onboarding request ${status} by manager`, employee });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
});

module.exports = router;
