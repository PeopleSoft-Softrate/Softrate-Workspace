const mongoose = require("mongoose");

const FundRequestSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },

    requesterType: {
      type: String,
      enum: ["employee", "intern"],
      required: true,
    },
    requesterId: { type: String, required: true, index: true },
    requesterMongoId: { type: mongoose.Schema.Types.ObjectId },
    requesterName: { type: String, required: true },
    department: { type: String, default: "" },

    category: { type: String, required: true },
    amount: { type: Number, required: true, min: 1 },
    expenseDate: { type: Date, required: true },
    description: { type: String, required: true },

    managerId: { type: String, default: null, index: true },
    managerStatus: {
      type: String,
      enum: ["pending", "accepted", "rejected"],
      default: "pending",
    },
    managerRemarks: { type: String, default: "" },
    managerActionDate: { type: Date },

    hrStatus: {
      type: String,
      enum: ["pending", "accepted", "rejected"],
      default: "pending",
    },
    hrRemarks: { type: String, default: "" },
    hrActionDate: { type: Date },

    // Phase 2 finance handoff. HR approval does not mark this true yet.
    isFinanceTeamApprove: { type: Boolean, default: false },
    financeRemarks: { type: String, default: "" },
    financeActionDate: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model("FundRequest", FundRequestSchema);
