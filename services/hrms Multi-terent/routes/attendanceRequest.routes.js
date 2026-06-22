const express = require("express");
const router = express.Router();
const verifyTenant = require("../middleware/tenant.middleware");
const AttendanceRequest = require("../models/attendanceRequest.model");
const Intern = require("../models/Intern");
const Attendance = require("../models/attendancemodel");
const EmployeeAttendance = require("../models/Employeeattendancemodel");
const Employee = require("../models/EmployeeModel");
const Notification = require("../models/Notification");

async function enrichWithActualTimes(requests) {
  return await Promise.all(requests.map(async reqObj => {
    const targetDate = new Date(reqObj.date);
    const dateStr = targetDate.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    let att = null;
    if (reqObj.employeeMongoId) {
      att = await EmployeeAttendance.findOne({ employeeId: reqObj.internId, date: dateStr }).lean();
    } else {
      att = await Attendance.findOne({ internId: reqObj.internId, date: dateStr }).lean();
    }
    return {
      ...reqObj,
      actualPunchIn: att ? att.punchInTime : null,
      actualPunchOut: att ? att.punchOutTime : null
    };
  }));
}

/**
 * Parses a time string like "9:25 AM" or "17:00" combined with a date string
 * like "2026-06-04" into a valid JavaScript Date (UTC ISO).
 * Returns null if parsing fails.
 */
function parseTimeString(timeStr, dateStr) {
  if (!timeStr || !dateStr) return null;
  try {
    // Already a full ISO string — just return as Date
    if (timeStr.includes("T") || timeStr.includes("Z")) {
      const d = new Date(timeStr);
      return isNaN(d) ? null : d;
    }

    // "9:25 AM" or "17:00" format — combine with dateStr
    const base = new Date(dateStr); // e.g. 2026-06-04
    if (isNaN(base)) return null;

    const upperTime = timeStr.trim().toUpperCase();
    let hours, minutes;

    if (upperTime.includes("AM") || upperTime.includes("PM")) {
      const isPM = upperTime.includes("PM");
      const clean = upperTime.replace("AM", "").replace("PM", "").trim();
      const parts = clean.split(":");
      hours = parseInt(parts[0], 10);
      minutes = parseInt(parts[1] || "0", 10);
      if (isPM && hours !== 12) hours += 12;
      if (!isPM && hours === 12) hours = 0;
    } else {
      const parts = upperTime.split(":");
      hours = parseInt(parts[0], 10);
      minutes = parseInt(parts[1] || "0", 10);
    }

    if (isNaN(hours) || isNaN(minutes)) return null;

    // Build date in IST (UTC+5:30) and convert to UTC
    const istOffsetMs = 5.5 * 60 * 60 * 1000;
    const utcMs = base.getTime() + hours * 3600000 + minutes * 60000 - istOffsetMs;
    const result = new Date(utcMs);
    return isNaN(result) ? null : result;
  } catch (e) {
    return null;
  }
}

// 1. Apply for Correction (Intern or Employee)
router.post("/apply", verifyTenant, async (req, res) => {
  try {
    const { internMongoId, employeeMongoId, date, requestedPunchIn, requestedPunchOut, reason } = req.body;

    let user;
    let userIdString;
    let managerApprovalStatus;

    if (employeeMongoId) {
      user = await Employee.findById(employeeMongoId);
      if (!user) return res.status(404).json({ success: false, message: "Employee not found" });
      userIdString = user.EmployeeId;
      managerApprovalStatus = user.assignedManager ? "pending" : "approved";
    } else if (internMongoId) {
      user = await Intern.findById(internMongoId);
      if (!user) return res.status(404).json({ success: false, message: "Intern not found" });
      userIdString = user.internid;
      managerApprovalStatus = user.assignedManager ? "pending" : "approved";
    } else {
      return res.status(400).json({ success: false, message: "Missing internMongoId or employeeMongoId" });
    }

    const request = new AttendanceRequest({
      companyId: req.tenant.companyId,
      internId: userIdString,
      internMongoId: internMongoId || null,
      employeeMongoId: employeeMongoId || null,
      internName: user.fullName,
      managerMongoId: user.assignedManager || null,
      managerApprovalStatus,
      date: new Date(date),
      requestedPunchIn,
      requestedPunchOut,
      reason,
    });

    await request.save();
    res.status(201).json({ success: true, message: "Correction request submitted", request });
  } catch (err) {
    console.error("attendance-requests /apply error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Get Requests for Manager
router.get("/manager/:managerId", verifyTenant, async (req, res) => {
  try {
    const requests = await AttendanceRequest.find({
      managerMongoId: req.params.managerId,
      managerApprovalStatus: "pending",
    }).sort({ createdAt: -1 }).lean();
    const enriched = await enrichWithActualTimes(requests);
    res.status(200).json(enriched);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Manager Review
router.put("/manager-review/:id", verifyTenant, async (req, res) => {
  try {
    const { status, remarks } = req.body;
    const request = await AttendanceRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ success: false, message: "Request not found" });

    request.managerApprovalStatus = status;
    request.managerRemarks = remarks;
    request.managerActionDate = new Date();

    if (status === "rejected") {
      request.hrApprovalStatus = "rejected";
    }

    await request.save();
    try {
      await Notification.create({
        companyId: req.tenant.companyId,
        title: `Attendance Ratification ${status.charAt(0).toUpperCase() + status.slice(1)}`,
        description: `Your ratification request was ${status} by your manager.`,
        targetAudience: 'specific_user',
        targetUserId: request.internId,
      });
    } catch (notifErr) {
      console.error("Failed to create notification:", notifErr);
    }
    res.status(200).json({ success: true, message: `Request ${status} by manager`, request });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Get Requests for HR (approved by Manager, pending HR action)
router.get("/hr-pending", verifyTenant, async (req, res) => {
  try {
    const requests = await AttendanceRequest.find({
      managerApprovalStatus: "approved",
      hrApprovalStatus: "pending",
    }).sort({ createdAt: -1 }).lean();
    const enriched = await enrichWithActualTimes(requests);
    res.status(200).json(enriched);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. HR Review (Final) — updates actual attendance record on approval
router.put("/hr-review/:id", verifyTenant, async (req, res) => {
  try {
    const { status, remarks } = req.body;
    const request = await AttendanceRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ success: false, message: "Request not found" });

    request.hrApprovalStatus = status;
    request.hrRemarks = remarks;
    request.hrActionDate = new Date();

    if (status === "approved") {
      const targetDate = new Date(request.date);
      const dateStr = targetDate.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

      if (request.employeeMongoId) {
        // Update Employee attendance
        let attendance = await EmployeeAttendance.findOne({
          employeeId: request.internId,
          date: dateStr,
        });

        if (!attendance) {
          attendance = new EmployeeAttendance({
            companyId: req.tenant.companyId,
            employeeId: request.internId,
            date: dateStr,
          });
        }
        if (request.requestedPunchIn) attendance.punchInTime = parseTimeString(request.requestedPunchIn, dateStr);
        if (request.requestedPunchOut) attendance.punchOutTime = parseTimeString(request.requestedPunchOut, dateStr);
        await attendance.save();
      } else {
        // Update Intern attendance
        let attendance = await Attendance.findOne({
          internId: request.internId,
          date: dateStr,
        });

        if (!attendance) {
          attendance = new Attendance({
            companyId: req.tenant.companyId,
            internId: request.internId,
            date: dateStr,
          });
        }
        if (request.requestedPunchIn) attendance.punchInTime = parseTimeString(request.requestedPunchIn, dateStr);
        if (request.requestedPunchOut) attendance.punchOutTime = parseTimeString(request.requestedPunchOut, dateStr);
        await attendance.save();
      }
    }

    await request.save();
    try {
      await Notification.create({
        companyId: req.tenant.companyId,
        title: `Attendance Ratification ${status.charAt(0).toUpperCase() + status.slice(1)}`,
        description: `Your ratification request was ${status} by HR.`,
        targetAudience: 'specific_user',
        targetUserId: request.internId,
      });
    } catch (notifErr) {
      console.error("Failed to create notification:", notifErr);
    }
    res.status(200).json({ success: true, message: `Request ${status} by HR`, request });
  } catch (err) {
    console.error("attendance-requests /hr-review error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. Get Intern's own requests
router.get("/intern/:internMongoId", verifyTenant, async (req, res) => {
  try {
    const requests = await AttendanceRequest.find({ internMongoId: req.params.internMongoId }).sort({ createdAt: -1 });
    res.status(200).json(requests);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 7. Get Employee's own requests
router.get("/employee/:employeeMongoId", verifyTenant, async (req, res) => {
  try {
    const requests = await AttendanceRequest.find({ employeeMongoId: req.params.employeeMongoId }).sort({ createdAt: -1 });
    res.status(200).json(requests);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
