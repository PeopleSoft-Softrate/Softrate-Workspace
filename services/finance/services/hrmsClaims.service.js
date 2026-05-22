const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const FinanceExpense = require('../models/FinanceExpense');

const DEFAULT_HRMS_MONGO_URI = 'mongodb://127.0.0.1:27017/hrm';

let hrmsConnectionPromise;

function normalize(value) {
  return String(value || '').trim();
}

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function escapeRegex(value) {
  return normalize(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hrmsMongoUri() {
  return normalize(process.env.HRMS_MONGO_URI || process.env.HRMS_DB_URI || hrmsServiceMongoUri())
    || DEFAULT_HRMS_MONGO_URI;
}

function hrmsServiceMongoUri() {
  const envPath = path.resolve(__dirname, '..', '..', 'hrms', '.env');
  if (!fs.existsSync(envPath)) return '';

  try {
    return normalize(dotenv.parse(fs.readFileSync(envPath)).MONGO_URI);
  } catch {
    return '';
  }
}

async function hrmsConnection() {
  if (!hrmsConnectionPromise) {
    const connection = mongoose.createConnection(hrmsMongoUri(), {
      serverSelectionTimeoutMS: 5000,
    });

    hrmsConnectionPromise = connection.asPromise()
      .then(() => connection)
      .catch((err) => {
        hrmsConnectionPromise = undefined;
        throw err;
      });
  }

  return hrmsConnectionPromise;
}

async function resolveHrmsCompany(companyCode) {
  const code = normalize(companyCode);
  const connection = await hrmsConnection();
  const companies = connection.collection('companies');

  const company = await companies.findOne({ companyCode: code })
    || await companies.findOne({ companyCode: { $regex: `^${escapeRegex(code)}$`, $options: 'i' } });

  if (!company) {
    const err = new Error(`HRMS company not found for companyCode ${code}.`);
    err.statusCode = 404;
    throw err;
  }

  return { connection, company, companyId: company._id };
}

function approvedHandoffQuery(companyId) {
  return {
    companyId,
    managerStatus: 'accepted',
    hrStatus: 'accepted',
  };
}

function financeStatus(claim) {
  return claim.isFinanceTeamApprove === true ? 'Finance Verified' : 'Pending Finance Approval';
}

function claimStage(claim) {
  if (claim.isFinanceTeamApprove === true) return 'Finance approved';
  return 'Awaiting finance manager';
}

function claimNumber(claim) {
  const id = String(claim._id || '');
  return `ECL-${id.slice(-6).toUpperCase() || 'NEW'}`;
}

function serializeHrmsClaim(claim, companyCode) {
  const id = String(claim._id || '');
  const amount = toNumber(claim.amount);

  return {
    id,
    _id: id,
    source: 'hrms-fund-request',
    sourceId: id,
    stream: 'Employee Claim',
    companyCode,
    claimNumber: claimNumber(claim),
    requesterType: claim.requesterType || 'employee',
    requesterId: claim.requesterId || '',
    employeeName: claim.requesterName || '',
    department: claim.department || '',
    category: claim.category || 'Employee Claim',
    description: claim.description || '',
    expenseDate: claim.expenseDate || claim.createdAt || null,
    submittedAt: claim.createdAt || null,
    amount,
    taxAmount: 0,
    totalAmount: amount,
    reimbursable: true,
    managerStatus: claim.managerStatus || 'pending',
    managerRemarks: claim.managerRemarks || '',
    managerActionDate: claim.managerActionDate || null,
    hrStatus: claim.hrStatus || 'pending',
    hrRemarks: claim.hrRemarks || '',
    hrActionDate: claim.hrActionDate || null,
    isFinanceTeamApprove: claim.isFinanceTeamApprove === true,
    financeApprovedAt: claim.financeApprovedAt || null,
    financeApprovedBy: claim.financeApprovedBy || '',
    status: financeStatus(claim),
    approvalStage: claimStage(claim),
  };
}

function claimAnalytics(items) {
  const pending = items.filter((item) => item.isFinanceTeamApprove !== true);
  const approved = items.filter((item) => item.isFinanceTeamApprove === true);
  const sumAmount = (rows) => rows.reduce((total, row) => total + toNumber(row.amount), 0);

  return {
    pendingClaims: pending.length,
    pendingClaimAmount: sumAmount(pending),
    approvedClaims: approved.length,
    approvedClaimAmount: sumAmount(approved),
  };
}

async function listEmployeeClaims(companyCode) {
  const code = normalize(companyCode);
  const { connection, companyId } = await resolveHrmsCompany(code);
  const fundRequests = connection.collection('fundrequests');
  const claims = await fundRequests
    .find(approvedHandoffQuery(companyId))
    .sort({ isFinanceTeamApprove: 1, createdAt: -1 })
    .toArray();
  const items = claims.map((claim) => serializeHrmsClaim(claim, code));

  return {
    items,
    analytics: claimAnalytics(items),
  };
}

async function approveEmployeeClaim(companyCode, claimId, options = {}) {
  const code = normalize(companyCode);
  const id = normalize(claimId);

  if (!mongoose.Types.ObjectId.isValid(id)) {
    const err = new Error('Invalid employee claim id.');
    err.statusCode = 400;
    throw err;
  }

  const { connection, companyId } = await resolveHrmsCompany(code);
  const fundRequests = connection.collection('fundrequests');
  const claimObjectId = new mongoose.Types.ObjectId(id);
  const claim = await fundRequests.findOne({
    _id: claimObjectId,
    ...approvedHandoffQuery(companyId),
  });

  if (!claim) {
    const err = new Error('Employee claim is not ready for finance approval.');
    err.statusCode = 404;
    throw err;
  }

  const approvedAt = new Date();
  const approvedBy = normalize(options.approvedBy) || 'Finance Manager';
  const amount = toNumber(claim.amount);

  const expense = await FinanceExpense.findOneAndUpdate(
    {
      companyCode: code,
      source: 'hrms-fund-request',
      sourceId: id,
    },
    {
      $set: {
        companyCode: code,
        type: 'Employee Claim',
        category: claim.category || 'Employee Claim',
        employeeName: claim.requesterName || '',
        department: claim.department || '',
        vendorName: '',
        description: claim.description || '',
        expenseDate: claim.expenseDate || claim.createdAt || approvedAt,
        amount,
        taxAmount: 0,
        reimbursable: true,
        status: 'Finance Verified',
        receiptUrl: '',
        source: 'hrms-fund-request',
        sourceId: id,
        financeApprovedBy: approvedBy,
        financeApprovedAt: approvedAt,
      },
    },
    {
      new: true,
      upsert: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    }
  ).lean();

  await fundRequests.updateOne(
    { _id: claimObjectId, companyId },
    {
      $set: {
        isFinanceTeamApprove: true,
        financeApprovedBy: approvedBy,
        financeApprovedAt: approvedAt,
      },
    }
  );

  const updatedClaim = await fundRequests.findOne({ _id: claimObjectId, companyId });

  return {
    claim: serializeHrmsClaim(updatedClaim || { ...claim, isFinanceTeamApprove: true, financeApprovedBy: approvedBy, financeApprovedAt: approvedAt }, code),
    expense,
  };
}

module.exports = {
  approveEmployeeClaim,
  listEmployeeClaims,
};
