const mongoose = require("mongoose");

const pointSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['Point'],
    required: true
  },
  coordinates: {
    type: [Number], // [longitude, latitude]
    required: true
  }
}, { _id: false });

const AttendanceSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },
  internId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Intern",
    required: true,
  },
  date: { type: String, required: true },
  punchInTime: { type: Date, default: null },
  punchOutTime: { type: Date, default: null, sparse: true },
  duration: { type: String, default: null },
  punchInLocation: { type: pointSchema, default: null },
  punchOutLocation: { type: pointSchema, default: null },
});

// Indexes for faster querying
AttendanceSchema.index({ internId: 1, date: 1 });
AttendanceSchema.index({ companyId: 1, date: 1 });

module.exports = { name: "Attendance", schema: AttendanceSchema };
