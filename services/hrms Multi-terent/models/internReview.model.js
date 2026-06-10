const mongoose = require("mongoose");

/* ---------------------- GOAL SCHEMA ---------------------- */

const GoalSchema = new mongoose.Schema({
  
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", index: true },perspective: { type: String, required: true, trim: true },
  kpi: {type: String,required: true,trim: true},
  title: {type: String,required: true,trim: true},
  description: {type: String,required: true,trim: true},
  weight: {type: Number,required: true,min: 0},
  comment: {type: String,default: ""},
  grade: {type: String,enum: ["A", "B", "C", "D", ""],default: ""},
  score: {type: Number,default: 0}
});

/* ---------------------- REVIEW SCHEMA ---------------------- */

const ReviewSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
  internId: {
    type: String,
    required: true,
    index: true
  },
  internName: {
    type: String,
    required: true
  },
  team: {
    type: String,
    required: true
  },
  goals: {
    type: [GoalSchema],
    default: []
  },
  summary: {
    obtainedScore: {
      type: Number,
      default: 0
    },
    totalWeight: {
      type: Number,
      default: 0
    },
    percentage: {
      type: Number,
      default: 0
    }
  },
  isGraded: {
    type: Boolean,
    default: false
  },
  date: {
    type: String, // yyyy-MM-dd
    required: true,
    index: true
  }
});

/* ---------------------- EXPORT ---------------------- */

// Multi-Tenant Proxy Wrapper
// Target MUST be a function for the construct trap to work with new Model()
function _ReviewProxyTarget() {}

function _getReviewModel() {
  const { getTenantConnection } = require('../db');
  const { getModelsForConnection } = require('../utilities/modelLoader');
  const { tenantLocalStorage } = require('../utilities/tenantContext');
  const store = tenantLocalStorage ? tenantLocalStorage.getStore() : null;
  const dbName = store && store.dbName ? store.dbName : 'hrdb';
  const connection = getTenantConnection(dbName);
  const models = getModelsForConnection(connection);
  return models["InternReview"];
}

module.exports = new Proxy(_ReviewProxyTarget, {
  get(target, prop) {
    if (prop === 'name') return "InternReview";
    if (prop === 'schema') return ReviewSchema;
    if (prop === '_name') return "InternReview";
    if (prop === '_schema') return ReviewSchema;
    const actualModel = _getReviewModel();
    if (!actualModel) throw new Error("Model InternReview not found for current tenant");
    if (typeof actualModel[prop] === 'function') return actualModel[prop].bind(actualModel);
    return actualModel[prop];
  },
  construct(target, args) {
    const actualModel = _getReviewModel();
    if (!actualModel) throw new Error("Model InternReview not found for current tenant");
    return new actualModel(...args);
  }
});
