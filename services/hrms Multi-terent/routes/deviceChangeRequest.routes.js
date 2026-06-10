const express = require("express");
const router = express.Router();
const verifyTenant = require("../middleware/tenant.middleware");
const DeviceChangeRequest = require("../models/DeviceChangeRequest");
const User = require("../models/User");
const Employee = require("../models/EmployeeModel");
const Intern = require("../models/Intern");

// GET all device change requests for HR
router.get("/hr-pending", verifyTenant, async (req, res) => {
  try {
    const requests = await DeviceChangeRequest.find({
      companyId: req.user.companyId,
      status: "pending",
      managerApprovalStatus: "approved",
      hrApprovalStatus: "pending"
    }).sort({ createdAt: -1 });
    
    // We would ideally populate the user, but since they are polymorphic, we manually fetch them
    const populated = await populateUsers(requests);
    res.json({ success: true, data: populated });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching requests", error: error.message });
  }
});

// GET device change requests for a Manager
router.get("/manager-pending/:managerId", verifyTenant, async (req, res) => {
  try {
    const managerId = req.params.managerId;
    
    // Find all employees and interns assigned to this manager
    const assignedEmployees = await Employee.find({ assignedManager: managerId }).select('_id');
    const assignedInterns = await Intern.find({ assignedManager: managerId }).select('_id');
    
    const assignedUserIds = [
      ...assignedEmployees.map(e => e._id), 
      ...assignedInterns.map(i => i._id)
    ];

    const requests = await DeviceChangeRequest.find({
      companyId: req.user.companyId,
      status: "pending",
      managerApprovalStatus: "pending",
      userId: { $in: assignedUserIds }
    }).sort({ createdAt: -1 });

    const populated = await populateUsers(requests);
    res.json({ success: true, data: populated });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching requests", error: error.message });
  }
});

// POST Approve request
router.post("/:id/approve", verifyTenant, async (req, res) => {
  try {
    const { role } = req.user; // 'hr' or 'manager'
    const request = await DeviceChangeRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ success: false, message: "Request not found" });

    if (role === 'manager') {
      request.managerApprovalStatus = "approved";
      request.managerId = req.user.id;
    } else if (role === 'hr' || role === 'hr_admin') {
      request.hrApprovalStatus = "approved";
      request.hrId = req.user.id;
      request.status = "approved"; // Fully approved

      // Update the user's actual device ID
      let model;
      if (request.userModel === 'Intern') model = Intern;
      else if (request.userModel === 'Employee') model = Employee;
      else model = User;

      await model.findByIdAndUpdate(request.userId, { deviceId: request.newDeviceId });
    }

    await request.save();
    res.json({ success: true, message: "Request approved successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error approving request", error: error.message });
  }
});

// POST Reject request
router.post("/:id/reject", verifyTenant, async (req, res) => {
  try {
    const { role } = req.user;
    const request = await DeviceChangeRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ success: false, message: "Request not found" });

    if (role === 'manager') {
      request.managerApprovalStatus = "rejected";
      request.managerId = req.user.id;
    } else if (role === 'hr' || role === 'hr_admin') {
      request.hrApprovalStatus = "rejected";
      request.hrId = req.user.id;
    }
    
    request.status = "rejected";
    await request.save();

    res.json({ success: true, message: "Request rejected successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error rejecting request", error: error.message });
  }
});

// Helper function to populate the generic userId
async function populateUsers(requests) {
  const result = [];
  for (let req of requests) {
    let user = null;
    if (req.userModel === 'Intern') user = await Intern.findById(req.userId).select("fullName email profilePhoto.data");
    else if (req.userModel === 'Employee') user = await Employee.findById(req.userId).select("firstName lastName email profilePhoto.data");
    else user = await User.findById(req.userId).select("profile.firstName profile.lastName email profilePhoto.data");
    
    const plainReq = req.toObject();
    plainReq.user = user;
    result.push(plainReq);
  }
  return result;
}

module.exports = router;
