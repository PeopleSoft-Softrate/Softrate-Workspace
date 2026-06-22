const express = require("express");
const router = express.Router();
const verifyTenant = require("../middleware/tenant.middleware");
// const LeaveCounter = require("../models/leaveCounter.model");

router.post("/init", verifyTenant, async (req, res) => {
    const { LeaveCounter, Employee, Intern } = req.models;

  const { employeeId, onboardingDate } = req.body;

  if (!employeeId || !onboardingDate) {
    return res.status(400).json({ message: "employeeId and onboardingDate required" });
  }

  const startDate = new Date(onboardingDate);

  // Note: Since this is an old route that doesn't have tenant context, 
  // we will try to fetch from User or Employee to get companyId if needed,
  // but for now, we'll return an error if we can't find companyId.
  // Actually, since verifyTenant is used, req.tenant.companyId is available.
  
  const CompanyModelExport = require("../models/CompanyModel");
  const { getMasterConnection: _getMasterConn, waitForConnection: _waitConn } = require("../db");
  const db = _getMasterConn();
  await _waitConn(db);
  const Company = db.models.Company || db.model("Company", CompanyModelExport.schema);
  
  const company = await Company.findById(req.tenant.companyId);
  const leavePolicies = company?.settings?.leavePolicies || [
    { name: 'Casual Leave', allowance: 12, frequency: 'annual', appliesTo: 'both' },
    { name: 'Sick Leave', allowance: 12, frequency: 'annual', appliesTo: 'both' }
  ];

  const records = [];
  for (const p of leavePolicies) {
    if (p.appliesTo === 'both' || p.appliesTo === 'employee') {
      const nextResetDate = new Date(startDate);
      if (p.frequency === 'monthly') {
        nextResetDate.setMonth(startDate.getMonth() + 1);
      } else {
        nextResetDate.setFullYear(startDate.getFullYear() + 1);
      }
      
      records.push({
        companyId: req.tenant.companyId,
        employeeId,
        leaveType: p.name,
        totalAllowed: p.allowance,
        used: 0,
        balance: p.allowance,
        cycleStartDate: startDate,
        nextResetDate: nextResetDate
      });
    }
  }

  try {
    await LeaveCounter.insertMany(records, { ordered: false });
    res.json({ message: "Leave counters initialized" });
  } catch (err) {
    // Ignore duplicate insert attempts (idempotent)
    res.json({ message: "Leave counters already exist" });
  }
});

module.exports = router;
