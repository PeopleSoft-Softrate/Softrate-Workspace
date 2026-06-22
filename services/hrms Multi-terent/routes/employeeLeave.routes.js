const express = require("express");
const router = express.Router();

// const EmployeeLeave = require("../models/employeeLeave.model");
// const LeaveCounter = require("../models/leaveCounter.model");
// const Intern = require("../models/Intern");
// const Employee = require("../models/EmployeeModel");
// const Leave = require("../models/leave.model"); // legacy intern leaves
const verifyTenant = require("../middleware/tenant.middleware");
const Notification = require("../models/Notification");
const multer = require("multer");
const upload = multer({ storage: multer.memoryStorage() });

/* ============================
   APPLY LEAVE
============================ */
router.post("/apply", verifyTenant, upload.single("document"), async (req, res) => {
    const { EmployeeLeave, LeaveCounter, Intern, Employee, Leave } = req.models;

  try {
    const data = req.body;
    const employeeId = data.employeeId || data.internId;
    const employeeName = data.employeeName || data.internName;

    const fromDate = new Date(data.fromDate);
    const toDate = new Date(data.toDate);

    const fromDay = new Date(Date.UTC(fromDate.getUTCFullYear(), fromDate.getUTCMonth(), fromDate.getUTCDate()));
    const toDay = new Date(Date.UTC(toDate.getUTCFullYear(), toDate.getUTCMonth(), toDate.getUTCDate()));

    // 1. Overlapping Leave Check
    const overlapping = await EmployeeLeave.find({
      companyId: req.tenant.companyId,
      employeeId: employeeId,
      hrStatus: { $ne: "rejected" },
      fromDate: { $lte: toDay },
      toDate: { $gte: fromDay },
    });

    if (overlapping.length > 0) {
      return res.status(400).json({ success: false, message: "You already have an overlapping leave." });
    }

    // 2. Fetch Assigned Manager
    let assignedManagerId = null;
    const intern = await Intern.findOne({ internid: employeeId, companyId: req.tenant.companyId });
    if (intern) {
      assignedManagerId = intern.assignedManager;
    } else {
      const employee = await Employee.findOne({ EmployeeId: employeeId, companyId: req.tenant.companyId });
      if (employee) assignedManagerId = employee.assignedManager;
    }

    // 3. Balance Check (Simplified)
    const isMaternityLeave = data.leaveType?.trim().toLowerCase() === "maternity leave";
    let normalizedLeaveType = data.leaveType;

    if (!isMaternityLeave) {
      const today = new Date();
      
      let counter = await LeaveCounter.findOne({
        companyId: req.tenant.companyId,
        employeeId: employeeId,
        leaveType: { $regex: `^${data.leaveType.trim()}$`, $options: "i" },
        cycleStartDate: { $lte: today },
        nextResetDate: { $gte: today },
      });

      if (!counter) {
        // Fallback 1: without date restrictions
        counter = await LeaveCounter.findOne({
          companyId: req.tenant.companyId,
          employeeId: employeeId,
          leaveType: { $regex: `^${data.leaveType.trim()}$`, $options: "i" },
        }).sort({ cycleStartDate: -1 });
      }

      if (!counter) {
        // Fallback 2: without companyId (handles ObjectId vs string mismatch)
        counter = await LeaveCounter.findOne({
          employeeId: employeeId,
          leaveType: { $regex: `^${data.leaveType.trim()}$`, $options: "i" },
        }).sort({ cycleStartDate: -1 });

        if (counter) {
          console.log(`[DEBUG] Found counter via broad fallback (no companyId filter) for employee ${employeeId}`);
        }
      }

      if (!counter) {
        // Fallback 3: Auto-create from company leave policies
        try {
          const { getMasterConnection, waitForConnection } = require('../db');
          const CompanyModelExport = require('../models/CompanyModel');
          const masterDb = getMasterConnection();
          await waitForConnection(masterDb);
          const Company = masterDb.models.Company || masterDb.model('Company', CompanyModelExport.schema);
          const company = await Company.findById(req.tenant.companyId);
          const leavePolicies = company?.leavePolicies || [
            { name: 'Casual Leave', allowance: 12, frequency: 'annual', appliesTo: 'both' },
            { name: 'Sick Leave', allowance: 12, frequency: 'annual', appliesTo: 'both' }
          ];

          const matchingPolicy = leavePolicies.find(p =>
            p.name.trim().toLowerCase() === data.leaveType.trim().toLowerCase() &&
            (p.appliesTo === 'both' || p.appliesTo === 'employee' || p.appliesTo === 'intern')
          );

          if (matchingPolicy) {
            const cycleStart = new Date();
            const nextReset = new Date();
            if (matchingPolicy.frequency === 'monthly') {
              nextReset.setMonth(nextReset.getMonth() + 1);
            } else {
              nextReset.setFullYear(nextReset.getFullYear() + 1);
            }
            counter = await LeaveCounter.create({
              companyId: req.tenant.companyId,
              employeeId: employeeId,
              leaveType: matchingPolicy.name,
              totalAllowed: matchingPolicy.allowance,
              used: 0,
              balance: matchingPolicy.allowance,
              cycleStartDate: cycleStart,
              nextResetDate: nextReset,
            });
            console.log(`[DEBUG] Auto-created leave counter for employee ${employeeId}, leaveType: ${matchingPolicy.name}`);
          }
        } catch (autoCreateErr) {
          console.error('[DEBUG] Failed to auto-create leave counter:', autoCreateErr.message);
        }
      }

      if (!counter) {
        const existingCounters = await LeaveCounter.find({ employeeId: employeeId });
        console.warn(`[DEBUG] Leave balance not found! Existing counters for employee ${employeeId}:`, existingCounters.map(c => ({ type: c.leaveType, balance: c.balance })));
        return res.status(404).json({ success: false, message: "Leave balance not found. Please contact HR to initialize your leave balance." });
      }
      
      if (Number(data.numberOfDays) > counter.balance) {
        return res.status(400).json({ success: false, message: `Insufficient balance. Available: ${counter.balance} day(s)` });
      }
      normalizedLeaveType = counter.leaveType;
    }

    // Parse perDayDurations if it was sent as a JSON string via multipart
    let parsedDurations = {};
    if (typeof data.perDayDurations === "string") {
      try {
        parsedDurations = JSON.parse(data.perDayDurations);
      } catch (e) {
        console.error("Failed to parse perDayDurations string", e);
      }
    } else {
      parsedDurations = data.perDayDurations || {};
    }

    // 4. Create Leave Request
    const leave = await EmployeeLeave.create({
      companyId: req.tenant.companyId,
      employeeId: employeeId,
      employeeName: employeeName,
      leaveType: normalizedLeaveType,
      fromDate: fromDay,
      toDate: toDay,
      numberOfDays: Number(data.numberOfDays),
      reason: data.reason,
      managerStatus: assignedManagerId ? "pending" : "accepted",
      hrStatus: "pending",
      managerId: assignedManagerId ? assignedManagerId.toString() : null,
      rejectionReason: "",
      perDayDurations: parsedDurations,
    });

    const io = req.app.get('io');
    if (io) {
      io.emit('activity-updated', { type: 'new_leave', leave });
    }

    res.json({ success: true, leaveId: leave._id });
  } catch (err) {
    console.error("Leave apply error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/* ============================
   MANAGER: GET TEAM LEAVE REQUESTS
============================ */
router.get("/manager-pending/:managerId", verifyTenant, async (req, res) => {
    const { EmployeeLeave, LeaveCounter, Intern, Employee, Leave } = req.models;

  try {
    const leaves = await EmployeeLeave.find({ 
      companyId: req.tenant.companyId,
      managerId: req.params.managerId,
      managerStatus: "pending" 
    }).sort({ createdAt: -1 });
    res.json(leaves);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/* ============================
   MANAGER: APPROVE/REJECT LEAVE
============================ */
router.put("/manager-action/:leaveId", verifyTenant, async (req, res) => {
    const { EmployeeLeave, LeaveCounter, Intern, Employee, Leave } = req.models;

  try {
    const { status, rejectionReason } = req.body; // status: accepted or rejected
    const leave = await EmployeeLeave.findOne({ _id: req.params.leaveId, companyId: req.tenant.companyId });
    if (!leave) return res.status(404).json({ success: false, message: "Leave not found" });

    leave.managerStatus = status;
    if (status === "rejected") {
      leave.hrStatus = "rejected"; // If manager rejects, HR also sees it as rejected
      leave.rejectionReason = rejectionReason || "Rejected by Manager";
    }
    await leave.save();
    
    try {
      await Notification.create({
        companyId: req.tenant.companyId,
        title: `Leave ${status.charAt(0).toUpperCase() + status.slice(1)}`,
        description: `Your leave request was ${status} by your manager.`,
        targetAudience: 'specific_user',
        targetUserId: leave.employeeId,
      });
    } catch (notifErr) {
      console.error("Failed to create notification:", notifErr);
    }
    
    res.json({ success: true, message: `Leave ${status} by manager` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/* ============================
   HR: GET PENDING LEAVES (Only if Manager Approved)
============================ */
router.get("/hr-pending", verifyTenant, async (req, res) => {
    const { EmployeeLeave, LeaveCounter, Intern, Employee, Leave } = req.models;

  try {
    const leaves = await EmployeeLeave.find({ 
      companyId: req.tenant.companyId,
      managerStatus: "accepted", 
      hrStatus: "pending" 
    }).sort({ createdAt: -1 });
    res.json(leaves);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/* ============================
   HR: FINAL APPROVE/REJECT
============================ */
router.put("/hr-action/:id", verifyTenant, async (req, res) => {
    const { EmployeeLeave, LeaveCounter, Intern, Employee, Leave } = req.models;

  try {
    let { status, rejectionReason, fromDate, toDate, numberOfDays } = req.body;
    if (status === "approved") status = "accepted";

    const leave = await EmployeeLeave.findOne({ _id: req.params.id, companyId: req.tenant.companyId });
    if (!leave) return res.status(404).json({ success: false, message: "Leave not found" });

    if (leave.managerStatus !== "accepted") {
      return res.status(400).json({ success: false, message: "Manager approval required first" });
    }

    // Update dates if provided by HR
    let finalNumberOfDays = leave.numberOfDays;
    if (fromDate && toDate && numberOfDays) {
      leave.fromDate = new Date(fromDate);
      leave.toDate = new Date(toDate);
      leave.numberOfDays = Number(numberOfDays);
      finalNumberOfDays = leave.numberOfDays;
    }

    // Process balance deduction if HR accepts
    if (status === "accepted") {
      const today = new Date();
      
      let counter = await LeaveCounter.findOne({
        companyId: req.tenant.companyId,
        employeeId: leave.employeeId,
        leaveType: { $regex: `^${leave.leaveType.trim()}$`, $options: "i" },
        cycleStartDate: { $lte: today },
        nextResetDate: { $gte: today },
      });

      if (!counter) {
        // Fallback: Query without date restrictions (sorted by cycleStartDate descending)
        counter = await LeaveCounter.findOne({
          companyId: req.tenant.companyId,
          employeeId: leave.employeeId,
          leaveType: { $regex: `^${leave.leaveType.trim()}$`, $options: "i" },
        }).sort({ cycleStartDate: -1 });
      }

      if (!counter) {
        return res.status(404).json({ success: false, message: "Leave balance not found" });
      }

      const updatedCounter = await LeaveCounter.findOneAndUpdate(
        { _id: counter._id, balance: { $gte: finalNumberOfDays } },
        { $inc: { used: finalNumberOfDays, balance: -finalNumberOfDays } },
        { new: true }
      );

      if (!updatedCounter) return res.status(400).json({ success: false, message: "Insufficient leave balance" });
    }

    leave.hrStatus = status;
    leave.rejectionReason = status === "rejected" ? rejectionReason || "" : "";
    await leave.save();

    try {
      await Notification.create({
        companyId: req.tenant.companyId,
        title: `Leave ${status.charAt(0).toUpperCase() + status.slice(1)}`,
        description: `Your leave request was ${status} by HR.`,
        targetAudience: 'specific_user',
        targetUserId: leave.employeeId,
      });
    } catch (notifErr) {
      console.error("Failed to create notification:", notifErr);
    }

    res.json({ success: true, message: `Leave ${status} by HR`, leave });
  } catch (err) {
    console.error("HR Leave Action Error:", err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
});


router.get("/employee/:employeeId", verifyTenant, async (req, res) => {
    const { EmployeeLeave, LeaveCounter, Intern, Employee, Leave } = req.models;

  try {
    const { employeeId } = req.params;
    
    // Fetch from both collections
    const [employeeLeaves, legacyLeaves] = await Promise.all([
      EmployeeLeave.find({ employeeId, companyId: req.tenant.companyId }).lean(),
      Leave.find({ internId: employeeId, companyId: req.tenant.companyId }).lean()
    ]);

    // Map legacy leaves to the new format if needed
    const normalizedLegacy = legacyLeaves.map(l => ({
      ...l,
      _id: l._id.toString(),
      employeeId: l.internId,
      employeeName: l.internName,
      managerStatus: l.managerStatus || l.status || "pending",
      hrStatus: l.hrStatus || l.status || "pending",
      isLegacy: true
    }));

    const combined = [...employeeLeaves, ...normalizedLegacy].sort((a, b) => {
      const dateA = a.fromDate instanceof Date ? a.fromDate : new Date(a.fromDate);
      const dateB = b.fromDate instanceof Date ? b.fromDate : new Date(b.fromDate);
      return dateB - dateA;
    });

    res.json(combined);
  } catch (err) {
    console.error("Fetch employee leaves error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get("/balance/:employeeId", verifyTenant, async (req, res) => {
    const { EmployeeLeave, LeaveCounter, Intern, Employee, Leave } = req.models;

  try {
    const counters = await LeaveCounter.find({ employeeId: req.params.employeeId, companyId: req.tenant.companyId }).select("leaveType balance totalAllowed used").lean();
    res.json({ success: true, data: counters });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

router.get("/count/:employeeId", verifyTenant, async (req, res) => {
    const { EmployeeLeave, LeaveCounter, Intern, Employee, Leave } = req.models;

  try {
    const { employeeId } = req.params;
    const month = parseInt(req.query.month);
    const year = parseInt(req.query.year);

    if (isNaN(month) || isNaN(year)) {
      return res.status(400).json({ success: false, message: "Month and Year are required." });
    }

    const startOfMonth = new Date(Date.UTC(year, month - 1, 1));
    const endOfMonth = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

    const leaves = await EmployeeLeave.find({
      companyId: req.tenant.companyId,
      employeeId,
      hrStatus: { $ne: "rejected" },
      fromDate: { $gte: startOfMonth, $lte: endOfMonth }
    });

    const totalDays = leaves.reduce((sum, l) => sum + (l.numberOfDays || 0), 0);

    res.json({
      success: true,
      employeeId,
      month,
      year,
      totalDays,
      limit: 2
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/* ============================
   GET ALL LEAVE REQUESTS (FOR HR)
============================ */
router.get("/all", verifyTenant, async (req, res) => {
    const { EmployeeLeave, LeaveCounter, Intern, Employee, Leave } = req.models;

  try {
    const leaves = await EmployeeLeave.find({ companyId: req.tenant.companyId }).sort({ createdAt: -1 });
    res.json(leaves);
  } catch (error) {
    res.status(500).json({ message: "Server Error" });
  }
});

/* ============================
   GET ALL LEAVE REQUESTS FOR MANAGER'S TEAM
============================ */
router.get("/manager-all/:managerId", verifyTenant, async (req, res) => {
    const { EmployeeLeave, LeaveCounter, Intern, Employee, Leave } = req.models;

  try {
    const leaves = await EmployeeLeave.find({ 
      companyId: req.tenant.companyId,
      managerId: req.params.managerId
    }).sort({ createdAt: -1 });
    res.json(leaves);
  } catch (error) {
    res.status(500).json({ message: "Server Error" });
  }
});


/* ============================
   CATCH-ALL: GET BY EMPLOYEE ID (must be last)
============================ */
// Compatibility route for old frontend calls (e.g., GET /api/leave/:id)
// MUST be last to avoid shadowing /employee/:id, /balance/:id, /count/:id, /all, /manager-all/:id
router.get("/:employeeId", verifyTenant, async (req, res) => {
    const { EmployeeLeave, LeaveCounter, Intern, Employee, Leave } = req.models;

  try {
    const leaves = await EmployeeLeave.find({ employeeId: req.params.employeeId, companyId: req.tenant.companyId }).sort({ fromDate: -1 });
    res.json(leaves);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
