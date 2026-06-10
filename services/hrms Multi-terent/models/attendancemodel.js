const mongoose = require("mongoose");

// GeoJSON Point sub-schema — NOT required at the nested level
// because punchInLocation / punchOutLocation themselves default to null.
const pointSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["Point"],
      // NOT required here — validated in route via toGeoPoint()
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
    },
  },
  { _id: false }
);

const AttendanceSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Company",
    required: true,
  },
  internId: {
    type: String, // stored as the custom intern ID string (e.g. "INT001")
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
AttendanceSchema.index({ date: 1 });  // trend endpoint: date-only scans


// ─── Multi-Tenant Proxy Wrapper ─────────────────────────────────────────────
// The modelLoader reads exported.name + exported.schema to register models.
// We MUST expose AttendanceSchema (not pointSchema) as the schema.

function _AttendanceProxyTarget() {}

function _getAttendanceModel() {
  const { getTenantConnection } = require("../db");
  const { getModelsForConnection } = require("../utilities/modelLoader");
  const { tenantLocalStorage } = require("../utilities/tenantContext");
  const store = tenantLocalStorage ? tenantLocalStorage.getStore() : null;
  const dbName = store && store.dbName ? store.dbName : "hrdb";
  const connection = getTenantConnection(dbName);
  const models = getModelsForConnection(connection);
  return models["attendance"];
}

module.exports = new Proxy(_AttendanceProxyTarget, {
  get(target, prop) {
    if (prop === "name") return "attendance";
    if (prop === "schema") return AttendanceSchema;
    if (prop === "_name") return "attendance";
    if (prop === "_schema") return AttendanceSchema;
    const actualModel = _getAttendanceModel();
    if (!actualModel)
      throw new Error("Model attendance not found for current tenant");
    if (typeof actualModel[prop] === "function")
      return actualModel[prop].bind(actualModel);
    return actualModel[prop];
  },
  construct(target, args) {
    const actualModel = _getAttendanceModel();
    if (!actualModel)
      throw new Error("Model attendance not found for current tenant");
    return new actualModel(...args);
  },
});
