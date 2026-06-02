const mongoose = require("mongoose");

const EmployeeSchema = new mongoose.Schema({
  // Section 1 – Personal Details
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
  EmployeeId: { type: String, default: "" },
  password: { type: String, default: "" },
  status: { type: String, default: "initial" },
  fullName: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  onboardingDate: { type: Date },
  emergencyName: String,
  emergencyPhone: String,
  dob: Date,
  address: String,
  role: String,
  department: String,
  linkedin: String,
  gender: String,
  nationality: String,
  maritalStatus: String,
  deviceId: { type: String, default: null },

  // Section 2 – Education
  qualification: String,
  specialization: String,
  college: String,
  passingYear: String,

  // Section 3 – CGPA / Marksheets
  ugCgpa: Number,
  pgCgpa: Number,

  // Section 4 – Experience (conditional)
  isExperienced: { type: Boolean, default: false },
  experienceYears: String,
  previousOrg: String,
  designation: String,

  // Section 6 – Declarations
  declaration: { type: Boolean, default: false },
  bgConsent: { type: Boolean, default: false },
  whatsappConsent: { type: Boolean, default: false },

  isManager: { type: Boolean, default: false },
  isHr: { type: Boolean, default: false },
  assignedManager: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", default: null },
  managerApprovalStatus: { type: String, enum: ['pending', 'approved', 'rejected', null], default: null },
  managerRemarks: { type: String, default: "" },
  submittedAt: { type: Date, default: Date.now },
  terminationReason: { type: String, default: null },
  terminationDate: { type: Date, default: null },
  payroll: {
    basicSalary: { type: Number, default: 0 },
    hra: { type: Number, default: 0 },
    allowances: { type: Number, default: 0 },
    deductions: { type: Number, default: 0 }
  },
  profilePhoto: {
    data: { type: Buffer, select: false },
    contentType: { type: String },
    size: { type: Number },
    updatedAt: { type: Date }
  }
});
// Helper function to capitalize the first letter of each word
function capitalizeWords(str) {
  if (!str) return str;
  return str.replace(/\b\w/g, c => c.toUpperCase());
}

EmployeeSchema.pre('save', function () {
  if (this.isModified('fullName') && this.fullName) {
    this.fullName = capitalizeWords(this.fullName);
  }
  if (this.isModified('college') && this.college) {
    this.college = capitalizeWords(this.college);
  }
  if (this.isModified('role') && this.role) {
    this.role = capitalizeWords(this.role);
  }
});

// Multi-Tenant Proxy Wrapper
// Target MUST be a function for the construct trap to work with new Model()
function _EmployeeProxyTarget() {}

function _getEmployeeModel() {
  const { getTenantConnection } = require('../db');
  const { getModelsForConnection } = require('../utilities/modelLoader');
  const { tenantLocalStorage } = require('../utilities/tenantContext');
  const store = tenantLocalStorage ? tenantLocalStorage.getStore() : null;
  const dbName = store && store.dbName ? store.dbName : 'hrdb';
  const connection = getTenantConnection(dbName);
  const models = getModelsForConnection(connection);
  return models["Employee"];
}

module.exports = new Proxy(_EmployeeProxyTarget, {
  get(target, prop) {
    if (prop === 'name') return "Employee";
    if (prop === 'schema') return EmployeeSchema;
    if (prop === '_name') return "Employee";
    if (prop === '_schema') return EmployeeSchema;
    const actualModel = _getEmployeeModel();
    if (!actualModel) throw new Error("Model Employee not found for current tenant");
    if (typeof actualModel[prop] === 'function') return actualModel[prop].bind(actualModel);
    return actualModel[prop];
  },
  construct(target, args) {
    const actualModel = _getEmployeeModel();
    if (!actualModel) throw new Error("Model Employee not found for current tenant");
    return new actualModel(...args);
  }
});
