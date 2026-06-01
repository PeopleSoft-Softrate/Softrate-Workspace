const mongoose = require("mongoose");

const DeviceChangeRequestSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  userModel: { type: String, enum: ["Intern", "Employee", "User"], required: true },
  oldDeviceId: { type: String, required: true },
  newDeviceId: { type: String, required: true },
  reason: { type: String, required: true },
  
  // Approval Flow
  managerApprovalStatus: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
  managerId: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", default: null }, // Optional, tracked when approved
  managerRemarks: { type: String, default: "" },

  hrApprovalStatus: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
  hrId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }, // Optional, tracked when approved
  hrRemarks: { type: String, default: "" },

  status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Update timestamp on save
DeviceChangeRequestSchema.pre('save', async function() {
  this.updatedAt = Date.now();
});

module.exports = mongoose.model("DeviceChangeRequest", DeviceChangeRequestSchema);
