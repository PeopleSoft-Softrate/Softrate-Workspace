const express = require("express");
const router = express.Router();

const FundRequest = require("../models/fundRequest.model");
const Employee = require("../models/EmployeeModel");
const Intern = require("../models/Intern");
const verifyTenant = require("../middleware/tenant.middleware");

function normalizeStatus(status) {
  if (status === "approved") return "accepted";
  if (["accepted", "rejected"].includes(status)) return status;
  return null;
}

async function findRequester(companyId, requesterType, requesterId) {
  if (requesterType === "intern") {
    const intern = await Intern.findOne({ companyId, internid: requesterId });
    if (!intern) return null;

    return {
      type: "intern",
      doc: intern,
      requesterMongoId: intern._id,
      requesterName: intern.fullName,
      department: intern.department || "",
      managerId: intern.assignedManager ? intern.assignedManager.toString() : null,
    };
  }

  const employee = await Employee.findOne({ companyId, EmployeeId: requesterId });
  if (!employee) return null;

  return {
    type: "employee",
    doc: employee,
    requesterMongoId: employee._id,
    requesterName: employee.fullName,
    department: employee.department || employee.role || "",
    managerId: employee.assignedManager ? employee.assignedManager.toString() : null,
    isManager: employee.isManager === true || employee.role?.toString().toLowerCase() === "manager",
  };
}

router.post("/apply", verifyTenant, async (req, res) => {
  try {
    const {
      requesterType,
      requesterId,
      requesterName,
      category,
      amount,
      expenseDate,
      description,
    } = req.body;

    if (!requesterType || !requesterId || !category || !amount || !expenseDate || !description) {
      return res.status(400).json({
        success: false,
        message: "Requester, category, amount, expense date, and description are required",
      });
    }

    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ success: false, message: "Amount must be greater than 0" });
    }

    const normalizedType = requesterType.toString().toLowerCase();
    if (!["employee", "intern"].includes(normalizedType)) {
      return res.status(400).json({ success: false, message: "Invalid requester type" });
    }

    const requester = await findRequester(req.tenant.companyId, normalizedType, requesterId);
    if (!requester) {
      return res.status(404).json({ success: false, message: "Requester not found" });
    }

    const skipManagerApproval = requester.type === "employee" && requester.isManager;

    if (!skipManagerApproval && !requester.managerId) {
      return res.status(400).json({
        success: false,
        message: "No manager assigned. Please contact HR before submitting a fund request",
      });
    }

    const fundRequest = await FundRequest.create({
      companyId: req.tenant.companyId,
      requesterType: requester.type,
      requesterId,
      requesterMongoId: requester.requesterMongoId,
      requesterName: requesterName || requester.requesterName,
      department: requester.department,
      category,
      amount: numericAmount,
      expenseDate: new Date(expenseDate),
      description,
      managerId: skipManagerApproval ? null : requester.managerId,
      managerStatus: skipManagerApproval ? "accepted" : "pending",
      hrStatus: "pending",
      isFinanceTeamApprove: false,
    });

    res.status(201).json({
      success: true,
      message: skipManagerApproval
        ? "Fund request submitted to HR"
        : "Fund request submitted to manager",
      fundRequest,
    });
  } catch (err) {
    console.error("Fund request apply error:", err);
    res.status(500).json({ success: false, message: "Unable to submit fund request", error: err.message });
  }
});

router.get("/user/:requesterId", verifyTenant, async (req, res) => {
  try {
    const requests = await FundRequest.find({
      companyId: req.tenant.companyId,
      requesterId: req.params.requesterId,
    }).sort({ createdAt: -1 });
    res.json(requests);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get("/manager-pending/:managerId", verifyTenant, async (req, res) => {
  try {
    const requests = await FundRequest.find({
      companyId: req.tenant.companyId,
      managerId: req.params.managerId,
      managerStatus: "pending",
    }).sort({ createdAt: -1 });
    res.json(requests);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get("/manager-all/:managerId", verifyTenant, async (req, res) => {
  try {
    const requests = await FundRequest.find({
      companyId: req.tenant.companyId,
      managerId: req.params.managerId,
    }).sort({ createdAt: -1 });
    res.json(requests);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put("/manager-action/:id", verifyTenant, async (req, res) => {
  try {
    const status = normalizeStatus(req.body.status);
    if (!status) {
      return res.status(400).json({ success: false, message: "Invalid manager status" });
    }

    const request = await FundRequest.findOne({ _id: req.params.id, companyId: req.tenant.companyId });
    if (!request) {
      return res.status(404).json({ success: false, message: "Fund request not found" });
    }

    request.managerStatus = status;
    request.managerRemarks = req.body.remarks || "";
    request.managerActionDate = new Date();
    if (status === "rejected") {
      request.hrStatus = "rejected";
      request.hrRemarks = "Rejected by manager";
    }

    await request.save();
    res.json({ success: true, message: `Fund request ${status} by manager`, fundRequest: request });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get("/hr-pending", verifyTenant, async (req, res) => {
  try {
    const requests = await FundRequest.find({
      companyId: req.tenant.companyId,
      managerStatus: "accepted",
      hrStatus: "pending",
    }).sort({ createdAt: -1 });
    res.json(requests);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get("/hr-all", verifyTenant, async (req, res) => {
  try {
    const requests = await FundRequest.find({ companyId: req.tenant.companyId }).sort({ createdAt: -1 });
    res.json(requests);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put("/hr-action/:id", verifyTenant, async (req, res) => {
  try {
    const status = normalizeStatus(req.body.status);
    if (!status) {
      return res.status(400).json({ success: false, message: "Invalid HR status" });
    }

    const request = await FundRequest.findOne({ _id: req.params.id, companyId: req.tenant.companyId });
    if (!request) {
      return res.status(404).json({ success: false, message: "Fund request not found" });
    }

    if (request.managerStatus !== "accepted") {
      return res.status(400).json({ success: false, message: "Manager approval required first" });
    }

    request.hrStatus = status;
    request.hrRemarks = req.body.remarks || "";
    request.hrActionDate = new Date();
    request.isFinanceTeamApprove = false;

    await request.save();
    res.json({ success: true, message: `Fund request ${status} by HR`, fundRequest: request });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put("/finance-action/:id", verifyTenant, async (req, res) => {
  try {
    const isApproved = req.body.isFinanceTeamApprove === true || req.body.status === "accepted" || req.body.status === "approved";
    const isRejected = req.body.isFinanceTeamApprove === false || req.body.status === "rejected";

    if (!isApproved && !isRejected) {
      return res.status(400).json({
        success: false,
        message: "Finance status must approve or reject the fund request",
      });
    }

    const request = await FundRequest.findOne({ _id: req.params.id, companyId: req.tenant.companyId });
    if (!request) {
      return res.status(404).json({ success: false, message: "Fund request not found" });
    }

    if (request.hrStatus !== "accepted") {
      return res.status(400).json({ success: false, message: "HR approval required before finance approval" });
    }

    request.financeRemarks = req.body.remarks || "";
    request.financeActionDate = new Date();
    request.isFinanceTeamApprove = isApproved;

    await request.save();

    res.json({
      success: true,
      message: isApproved
        ? "Fund request approved by finance and will be included in payroll for its expense month"
        : "Fund request rejected by finance",
      fundRequest: request,
    });
  } catch (err) {
    console.error("Finance fund request action error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
