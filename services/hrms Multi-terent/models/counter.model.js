const mongoose = require("mongoose");

const CounterSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
  type: { type: String, required: true }, // e.g., 'employee', 'intern'
  year: { type: String, default: null },  // e.g., '25' for 2025 — allows per-year reset
  seq: { type: Number, default: 0 },
});

// Ensure uniqueness per company, type and year
CounterSchema.index({ companyId: 1, type: 1, year: 1 }, { unique: true });

module.exports = { name: "Counter", schema: CounterSchema };
