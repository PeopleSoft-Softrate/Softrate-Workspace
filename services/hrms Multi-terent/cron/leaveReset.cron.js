const cron = require("node-cron");
const LeaveCounter = require("../models/leaveCounter.model");

cron.schedule(
  "5 0 * * *", // 12:12 AM IST
  async () => {
    console.log("🕛 Running Leave Reset Cron at 12:12 AM IST");

    const now = new Date(); // current time (IMPORTANT)

    try {
      const countersToReset = await LeaveCounter.find({
        nextResetDate: { $lte: now },
      });

      // Cache company leave policies to avoid querying the DB for every counter
      const companyPoliciesCache = {};
      const CompanyModelExport = require("../models/CompanyModel");
      const { getMasterConnection: _getMasterConn, waitForConnection: _waitConn } = require("../db");
      const db = _getMasterConn();
      await _waitConn(db);
      const Company = db.models.Company || db.model("Company", CompanyModelExport.schema);

      for (const counter of countersToReset) {
        // ❌ Do not auto-reset maternity leave
        if (counter.leaveType === "Maternity Leave") continue;

        const newCycleStartDate = new Date(counter.nextResetDate);
        newCycleStartDate.setHours(0, 0, 0, 0);

        // Fetch company policies to determine frequency
        let frequency = 'annual'; // default
        if (counter.companyId) {
          if (!companyPoliciesCache[counter.companyId]) {
            const company = await Company.findById(counter.companyId);
            companyPoliciesCache[counter.companyId] = company?.settings?.leavePolicies || [];
          }
          const policy = companyPoliciesCache[counter.companyId].find(p => p.name === counter.leaveType);
          if (policy && policy.frequency === 'monthly') {
            frequency = 'monthly';
          }
        }

        const newNextResetDate = new Date(counter.nextResetDate);
        if (frequency === 'monthly') {
          newNextResetDate.setMonth(newNextResetDate.getMonth() + 1);
        } else {
          newNextResetDate.setFullYear(newNextResetDate.getFullYear() + 1);
        }
        newNextResetDate.setHours(0, 0, 0, 0);

        counter.used = 0;
        counter.balance = counter.totalAllowed;
        counter.cycleStartDate = newCycleStartDate;
        counter.nextResetDate = newNextResetDate;

        await counter.save();

        console.log(
          `✅ ${counter.leaveType} reset for ${counter.employeeId} (Frequency: ${frequency})`
        );
      }
    } catch (error) {
      console.error("❌ Leave reset cron failed:", error);
    }
  },
  {
    timezone: "Asia/Kolkata",
  }
);
