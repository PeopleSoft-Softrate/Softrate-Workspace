const express = require("express");
const verifyTenant = require("../middleware/tenant.middleware");
const mongoose = require("mongoose");
const Intern = require("../models/Intern");
const Resignation = require("../models/resignation.model.js");  
const router = express.Router();
const multer = require('multer');
const upload = multer();
const Counter = require("../models/counter.model");
const ExcelJS = require("exceljs");
const { sendEmail, getLogoUrl } = require("../utilities/sendEmail");
const { getSignature } = require("../utilities/emailSignature");
const { generateOfferLetter } = require("../utilities/offerLetterGenerator");
const { generateDynamicPDF } = require("../utilities/certificateGenerator");
const fs = require('fs');
const path = require('path');
const { getAssetBuffer } = require("../utilities/assetHelper");
const Company = require("../models/CompanyModel");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const User = require("../models/User");
const Role = require("../models/Role");

const verifyPublicTenant = require("../middleware/publicTenant.middleware");

router.post("/add", verifyPublicTenant, async (req, res) => {
  try {
    const {
      fullName,
      email,
      college,
      year,
      department,
      role,
      contact,
      emergencyContact,
      onboardingDate,
      endDate,
      linkedin,
      internshipType,
      resume // Base64 PDF
    } = req.body;

    // 1. Check if user already exists in this company
    const existingUser = await User.findOne({ companyId: req.tenant.companyId, email });
    if (existingUser) {
      return res.status(400).json({ message: "An application with this email already exists for this company." });
    }

    // 2. Find or Create the Default INTERN Role for this company
    let internRole = await Role.findOne({ companyId: req.tenant.companyId, name: 'INTERN' });
    if (!internRole) {
      internRole = new Role({
        companyId: req.tenant.companyId,
        name: 'INTERN',
        description: 'Standard intern permissions',
        permissions: ['VIEW_DASHBOARD', 'REQUEST_LEAVE'],
        isSystemDefined: true
      });
      await internRole.save();
    }

    const newUser = new User({
      companyId: req.tenant.companyId,
      email: email,
      password: "", // Set on first login
      roleId: internRole._id,
      profile: {
        firstName: fullName,
        phone: contact,
        emergencyContact: {
          phone: emergencyContact
        },
        linkedin: linkedin
      },
      education: {
        college: college,
        passingYear: year, // Mapping "year" to passingYear or current year
        specialization: department
      },
      employment: {
        type: 'INTERN',
        designation: role,
        status: 'ONBOARDING',
        joinedAt: onboardingDate,
        endDate: endDate,
        linkedin: linkedin
      },
      system: {
        onboardingStatus: 'initial'
      }
    });

    await newUser.save();

    // 3. ALSO Create Intern in legacy collection (Backward Compatibility for Admin Dashboard)
    const newIntern = new Intern({
      companyId: req.tenant.companyId,
      fullName,
      email,
      college,
      year,
      department,
      role,
      contact,
      emergencyContact,
      onboardingDate,
      endDate,
      linkedin,
      internshipType,
      status: 'initial'
    });

    await newIntern.save();

    // Trigger Real-Time Dashboard Update
    const io = req.app.get('io');
    if (io) {
      io.emit('activity-updated', { type: 'new_intern', intern: newIntern });
    }



    res.status(200).json({
      message: "Intern stored successfully",
      user: newUser,
    });

  } catch (err) {
    console.error("Save Error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// GET intern by internid
router.get("/all/initial", verifyTenant, async (req, res) => {
  try {
    const query = { status: "initial", companyId: req.tenant.companyId };
    if (req.user && req.user.role === 'manager') {
      query.assignedManager = req.user.id;
    }
    const interns = await Intern.find(query);
    res.json(interns);
  } catch (error) {
    console.error("Fetch Error:", error);
    res.status(500).json({ message: "Server Error" });
  }
});


/* ===================================================
   GET ALL PENDING INTERNS (status: initial) — for HR Approvals Hub
   Returns interns awaiting HR action (manager-approved or no manager)
=================================================== */
router.get("/all/pending", verifyTenant, async (req, res) => {
  try {
    const query = { status: "initial", companyId: req.tenant.companyId };
    if (req.user && req.user.role === 'manager') {
      query.assignedManager = req.user.id;
    }
    const interns = await Intern.find(query)
          .populate("assignedManager", "fullName department")
          .sort({ internid: 1 });
    res.json(interns);
  } catch (err) {
    console.error("Fetch Pending Interns Error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Get all approved or ongoing interns
// Get all approved or ongoing interns with filters
router.get("/all/active", verifyTenant, async (req, res) => {
  try {
    const { range = "current", status = "all" } = req.query;

    const query = { companyId: req.tenant.companyId };

    if (range === "alumni") {
      query.status = "drop";
    } else {
      // current and all time use the same base statuses, but current has date filtering on frontend
      const statusFilter = status === "all" ? ["approved", "ongoing"] : status.split(',');
      query.status = { $in: statusFilter };
    }

    if (req.user && req.user.role === 'manager') {
      query.assignedManager = req.user.id;
    }

    const interns = await Intern.find(query)
      .populate("assignedManager", "fullName department")
      .sort({ internid: 1 });
    res.json(interns);
  } catch (err) {
    console.error("Fetch Active Interns Error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});




router.put("/accept/:id", verifyTenant,
  async (req, res) => {
    try {
      const { onboardingDate, endDate, internshipType, role } = req.body;

      const intern = await Intern.findById(req.params.id);
      if (!intern) {
        return res.status(404).json({ message: "Intern not found" });
      }

      if (internshipType && !["Stipend", "Paid"].includes(internshipType)) {
        return res.status(400).json({ message: "Invalid internship type" });
      }

      // 1. Generate Intern ID
      const newId = await generateInternId(req.tenant.companyId);

      // 2. Fetch company for settings
      const company = await Company.findById(req.tenant.companyId);
      // Correct path: settings.offerLetterSettings
      const olSettings = company?.settings?.offerLetterSettings || company?.offerLetterSettings || {};

      // 3. Prepare data for dynamic PDF generation
      const docData = {
        fullName: intern.fullName,
        internId: newId,
        onboardingDate: onboardingDate,
        endDate: endDate,
        role: role || intern.role,
        companyName: olSettings.companyName,
        workLocation: olSettings.workLocation
      };

      const attachments = [];

      // Offer Letter
      if (olSettings.documentTemplates?.offerLetter?.pages?.length > 0 || olSettings.documentTemplates?.offerLetter?.backgroundUrl) {
          const buffer = await generateDynamicPDF(docData, olSettings.documentTemplates.offerLetter);
          attachments.push({ filename: `${newId}-Offer-Letter.pdf`, content: buffer });
      } else {
          // Fallback to legacy generator
          const buffer = await generateOfferLetter(docData, olSettings);
          attachments.push({ filename: `${newId}-Offer-Letter.pdf`, content: buffer });
      }

      // Annexure
      if (olSettings.documentTemplates?.annexure?.pages?.length > 0 || olSettings.documentTemplates?.annexure?.backgroundUrl) {
          const buffer = await generateDynamicPDF(docData, olSettings.documentTemplates.annexure);
          attachments.push({ filename: `${newId}-Annexure.pdf`, content: buffer });
      } else if (olSettings.annexureUrl) {
          const annBuf = await getAssetBuffer(olSettings.annexureUrl);
          if (annBuf) attachments.push({ filename: `${newId}-Annexure.pdf`, content: annBuf });
      } else {
          // Fallback to static asset
          const annexurePath = path.join(__dirname, '../assets/pdf/Softrate_Internship_Annexure.pdf');
          if (fs.existsSync(annexurePath)) attachments.push({ filename: `${newId}-Annexure.pdf`, content: fs.readFileSync(annexurePath) });
      }

      // NDA
      if (olSettings.documentTemplates?.nda?.pages?.length > 0 || olSettings.documentTemplates?.nda?.backgroundUrl) {
          const buffer = await generateDynamicPDF(docData, olSettings.documentTemplates.nda);
          attachments.push({ filename: `${newId}-NDA.pdf`, content: buffer });
      } else if (olSettings.ndaUrl) {
          const ndaBuf = await getAssetBuffer(olSettings.ndaUrl);
          if (ndaBuf) attachments.push({ filename: `${newId}-NDA.pdf`, content: ndaBuf });
      } else {
          // Fallback to static asset
          const ndaPath = path.join(__dirname, '../assets/pdf/Internship NDA.pdf');
          if (fs.existsSync(ndaPath)) attachments.push({ filename: `${newId}-NDA.pdf`, content: fs.readFileSync(ndaPath) });
      }

      // 4. Update Intern Record
      intern.internid = newId;
      intern.status = "approved";
      intern.onboardingDate = onboardingDate;
      intern.endDate = endDate;
      if (internshipType) intern.internshipType = internshipType;
      if (role) intern.role = role;

      await intern.save();
      
      // 5. Synchronize with User Record (Unified Collection)
      const updatedUser = await User.findOneAndUpdate(
        { email: { $regex: new RegExp(`^${intern.email.trim()}$`, 'i') }, companyId: req.tenant.companyId },
        { 
          'employment.status': 'approved',
          'employment.joinedAt': onboardingDate,
          'employment.endDate': endDate,
          'system.onboardingStatus': 'completed'
        },
        { new: true }
      );

      if (updatedUser) {
        console.log(`[DEBUG] Updated User record for approved intern: ${intern.email}`);
      } else {
        console.log(`[DEBUG] Warning: No User record found for approved intern: ${intern.email}`);
      }

      console.log("Intern saved successfully. Preparing to send email with generated documents...");
      
      try {
        const Company = require("../models/CompanyModel");
        const companyTemplate = await Company.findById(req.tenant.companyId);
        const template = companyTemplate?.settings?.communication?.onboardingTemplateIntern;

        const internName = intern.fullName.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
        const formattedOnboardingDate = new Date(onboardingDate).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
        const formattedEndDate = new Date(endDate).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

        let htmlContent = "";
        if (template) {
          htmlContent = template
            .replace(/{formattedName}/g, internName)
            .replace(/{onboardingDate}/g, formattedOnboardingDate)
            .replace(/{endDate}/g, formattedEndDate)
            .replace(/{signature}/g, getSignature(getLogoUrl()));
        } else {
          htmlContent = `
            <p>Dear ${internName},</p>
            <p>Softrate Global welcomes you Onboard, We herein have attached your Official Offer Letter and Company Culture Book for joining us.</p>
            <p>You can share your offer letter on Linkedin by mentioning @softrate with hashtags #careeratsoftrate #softratetechpark #softratetechnologies</p>
            <p>Also read out the annexure completely that had been attached in this mail and make sure you are agreeing with our policies by signing and filling up the date in the attached annexure.</p>
            <p>Your internship details are as follows:</p>
            <ul>
              <li>Onboarding Date: ${formattedOnboardingDate}</li>
              <li>End Date: ${formattedEndDate}</li>
            </ul>
            <p style="margin: 0 0 0 0;">To proceed further, please log in to the PeopleSoft portal using the credentials shared separately.</p>
            <p style="margin: 0 0 0 0;">For first-time login, you will be required to set your own password and complete your profile by providing the necessary details.</p>
            <p style="margin: 0 0 0 0;">Kindly ensure that all required information is submitted before your onboarding date to avoid any delays.</p>
            <p style="margin: 0 0 15px 0;">For any queries, feel free to contact us.</p>
            ${getSignature(getLogoUrl())}
          `;
        }

        await sendEmail({
          to: intern.email,
          subject: "Internship Application – Approval Notification",
          html: htmlContent,
          attachments: attachments,
          replyTo: req.tenant.receivingEmail,
        });
        console.log(`[DEBUG] Approval email sent to intern: ${intern.email}`);
      } catch (emailErr) {
        console.error("[DEBUG] Failed to send intern approval email:", emailErr);
        // Do not fail the request if only email fails
      }

      res.json({ success: true, message: "Intern approved & onboarded successfully", intern });
    } catch (err) {
      console.error("Approve Error [FULL STACK]:", err.stack);
      console.error("Approve Error:", err);
      res.status(500).json({ message: "Server error", error: err.message, stack: err.stack });
    }
  }
);


router.put("/reject/:id", verifyTenant, async (req, res) => {
  try {
    const intern = await Intern.findByIdAndUpdate(
      req.params.id,
      { managerApprovalStatus: 'rejected', status: 'rejected' },
      { new: true }
    );

    if (!intern) {
      return res.status(404).json({ message: "Intern not found" });
    }

    res.json({
      message: "Intern rejected successfully",
      intern,
    });
  } catch (err) {
    console.error("Reject Delete Error:", err);
    res.status(500).json({ message: "Server error" });
  }
});



// id generator


async function generateInternId(companyId) {
  // Fetch company code
  const company = await Company.findById(companyId);
  const companyCode = company ? company.companyCode : "UNKNOWN";

  const year = new Date().getFullYear().toString().slice(-2);
  let counter;
  let internId;

  do {
    counter = await Counter.findOneAndUpdate(
      { companyId: companyId, type: 'intern', year: year },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );

    internId = `${year}1${String(counter.seq).padStart(3, "0")}`;
  } while (await Intern.exists({ internid: internId, companyId: companyId }));

  return internId;
}

const authController = require("../controllers/AuthController");
router.post("/login", authController.login);

// Get intern by internid or MongoDB _id
router.get("/get/:id", verifyTenant, async (req, res) => {
  try {
    const id = req.params.id;
    let intern;

    // Try finding by internid first
    intern = await Intern.findOne({ internid: id });

    // If not found and id is a valid MongoDB ObjectId, try finding by _id
    if (!intern && mongoose.Types.ObjectId.isValid(id)) {
      intern = await Intern.findById(id);
    }

    if (!intern) {
      return res.status(404).json({ message: "Intern not found" });
    }

    res.json({ intern });
  } catch (err) {
    console.error("Fetch Intern Error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// changing approved to ongoing
router.post("/update-status", verifyTenant, async (req, res) => {
  try {
    const { internId, status } = req.body;

    const intern = await Intern.findOneAndUpdate(
      { internid: internId },
      { status: status },
      { new: true }
    );

    if (!intern) {
      return res.status(404).json({ message: "Intern not found" });
    }

    res.status(200).json({
      message: "Status updated successfully",
      intern,
    });
  } catch (err) {
    console.error("Update Status Error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});


router.get("/pastout", verifyTenant, async (req, res) => {
  try {
    const year = parseInt(req.query.year);
    const month = parseInt(req.query.month); // 0 = all

    const resignations = await Resignation.find({ status: "accepted" });

    const filtered = resignations.filter((r) => {
      if (!r.lastWorkingDay) return false;

      const date = new Date(r.lastWorkingDay);
      if (isNaN(date)) return false;

      if (year && date.getFullYear() !== year) return false;
      if (month && month !== 0 && date.getMonth() + 1 !== month) return false;

      return true;
    });

    const internIds = filtered.map((r) => r.internId);

    const interns = await Intern.find({
      internid: { $in: internIds },
    });

    const result = filtered.map((r) => {
      const intern = interns.find((i) => i.internid === r.internId);

      return {
        internId: r.internId,
        fullName: intern?.fullName ?? r.internName,
        department: intern?.department ?? "",
        endDate: r.lastWorkingDay,
        status: "drop",
        exitType: r.exitType,
        exitReason: r.exitReason,
      };
    });

    res.status(200).json(result);
  } catch (err) {
    console.error("Past-out error:", err);
    res.status(500).json({ message: "Server error" });
  }
});


router.get("/export/excel", verifyTenant, async (req, res) => {
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

    let interns = await Intern.find(query).sort({ createdAt: -1 });

    if (from && to) {
      const fromDate = new Date(from);
      const toDate = new Date(to);
      toDate.setHours(23, 59, 59, 999);

      interns = interns.filter((intern) => {
        if (!intern.onboardingDate) return false;
        const onboardDate = new Date(intern.onboardingDate);
        if (isNaN(onboardDate)) return false;
        return onboardDate >= fromDate && onboardDate <= toDate;
      });
    }

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Interns");

    sheet.columns = [
      { header: "Intern ID", key: "internid", width: 15 },
      { header: "Full Name", key: "fullName", width: 25 },
      { header: "Email", key: "email", width: 30 },
      { header: "Contact", key: "contact", width: 15 },
      { header: "College", key: "college", width: 25 },
      { header: "Year", key: "year", width: 10 },
      { header: "Department", key: "department", width: 20 },
      { header: "Role", key: "role", width: 20 },
      { header: "Internship Type", key: "internshipType", width: 18 },
      { header: "Status", key: "status", width: 15 },
      { header: "Onboarding Date", key: "onboardingDate", width: 18 },
      { header: "End Date", key: "endDate", width: 18 },
      { header: "Created At", key: "createdAt", width: 22 },
    ];

    interns.forEach((intern) => {
      sheet.addRow({
        internid: intern.internid || "",
        fullName: intern.fullName,
        email: intern.email,
        contact: intern.contact,
        college: intern.college,
        year: intern.year,
        department: intern.department,
        role: intern.role,
        internshipType: intern.internshipType || "",
        status: intern.status,
        onboardingDate: intern.onboardingDate || "",
        endDate: intern.endDate || "",
        createdAt: intern.createdAt
          ? new Date(intern.createdAt).toLocaleDateString("en-GB")
          : "",
      });
    });

    // Header style
    sheet.getRow(1).font = { bold: true };

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=Intern_Data.xlsx"
    );

    await workbook.xlsx.write(res);
    res.end();

  } catch (err) {
    console.error("Intern Excel Export Error:", err);
    res.status(500).json({ message: "Excel export failed" });
  }
});

/* ============================
   GET INTERN PROFILE PHOTO
============================ */
router.get("/profile-photo/:id", async (req, res) => {
  try {
    const { id } = req.params;
    let intern;
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      intern = await Intern.findById(id);
    } else {
      intern = await Intern.findOne({ internid: { $regex: new RegExp(`^${id}$`, 'i') } });
    }
    if (!intern) return res.status(404).send("Intern not found");

    const user = await User.findOne({ email: { $regex: new RegExp(`^${intern.email.trim()}$`, 'i') } }).select('+profilePhoto.data');
    if (!user || !user.profilePhoto || !user.profilePhoto.data) {
      return res.status(404).send("No photo");
    }

    res.set("Content-Type", user.profilePhoto.contentType || "image/png");
    res.send(user.profilePhoto.data);
  } catch (err) {
    console.error("Fetch Intern Photo Error:", err);
    res.status(500).send("Server error");
  }
});

/* ============================
   ASSIGN INTERN TO MANAGER
============================ */
router.put("/assign-manager/:id", verifyTenant, async (req, res) => {
  try {
    const { managerId } = req.body;
    const intern = await Intern.findById(req.params.id);
    if (!intern) return res.status(404).json({ message: "Intern not found" });

    intern.assignedManager = managerId;
    intern.managerApprovalStatus = "pending";
    await intern.save();

    res.json({ message: "Intern assigned to manager", intern });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
});

/* ============================
   GET INTERNS ASSIGNED TO MANAGER
============================ */
router.get("/assigned-to/:managerId", verifyTenant, async (req, res) => {
  try {
    const interns = await Intern.find({ 
      assignedManager: req.params.managerId,
      status: "initial" // Only show pending applications to managers
    });
    res.json(interns);
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
});

/* ============================
   MANAGER REVIEW (APPROVE/REJECT)
============================ */
router.put("/manager-review/:id", verifyTenant, async (req, res) => {
  try {
    const { status, remarks } = req.body; // status: 'approved' | 'rejected'
    const intern = await Intern.findById(req.params.id);
    if (!intern) return res.status(404).json({ message: "Intern not found" });

    intern.managerApprovalStatus = status;
    intern.managerRemarks = remarks;
    await intern.save();

    res.json({ message: `Intern ${status} by manager`, intern });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
});

router.put("/update/:id", verifyTenant, async (req, res) => {
  try {
    const updatedIntern = await Intern.findOneAndUpdate(
      { _id: req.params.id, companyId: req.tenant.companyId },
      { $set: req.body },
      { new: true }
    );

    if (!updatedIntern) return res.status(404).json({ message: "Intern not found" });

    // Sync with User record
    if (req.body.email || req.body.fullName || req.body.contact || req.body.payroll) {
      const updateData = {};
      if (req.body.fullName) updateData['profile.firstName'] = updatedIntern.fullName;
      if (req.body.contact) updateData['profile.phone'] = updatedIntern.contact;
      if (req.body.role) updateData['employment.designation'] = updatedIntern.role;
      if (req.body.payroll) updateData['payroll'] = updatedIntern.payroll;

      await User.findOneAndUpdate(
        { email: { $regex: new RegExp(`^${updatedIntern.email.trim()}$`, 'i') }, companyId: req.tenant.companyId },
        { $set: updateData }
      );
    }

    res.json({ message: "Intern updated successfully", intern: updatedIntern });
  } catch (err) {
    console.error("Intern Update Error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

module.exports = router;