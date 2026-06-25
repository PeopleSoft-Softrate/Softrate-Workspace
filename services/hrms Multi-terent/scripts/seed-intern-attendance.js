/**
 * Seed Attendance for Interns 261189 – 261197
 * Dates  : 13-Jun-2026  and  20-Jun-2026
 * Timing : 3:00 PM punch-in  →  5:00 PM punch-out  (2 hrs)
 *
 * Usage:
 *   cd "services/hrms Multi-terent"
 *   node scripts/seed-intern-attendance.js
 */

require("dotenv").config({ path: "./.env" });

const { getMasterConnection, getTenantConnection, waitForConnection } = require("../db");
const { getModelsForConnection } = require("../utilities/modelLoader");
const CompanyModelExport = require("../models/CompanyModel");

// ─── Config ────────────────────────────────────────────────────────────────
const INTERN_IDS = ["261189", "261190", "261191", "261192", "261193",
                    "261194", "261195", "261196", "261197"];

// Dates to seed (YYYY-MM-DD)
const DATES = ["2026-06-13", "2026-06-20"];

// Timing: 3 PM – 5 PM IST (UTC+5:30)
// 3:00 PM IST = 09:30 UTC  |  5:00 PM IST = 11:30 UTC
const PUNCH_IN_HOUR_UTC  = 9,  PUNCH_IN_MIN_UTC  = 30;
const PUNCH_OUT_HOUR_UTC = 11, PUNCH_OUT_MIN_UTC = 30;
const DURATION = "2h 0m";

// ─── Helpers ────────────────────────────────────────────────────────────────
function buildDateTime(dateStr, utcHour, utcMin) {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  d.setUTCHours(utcHour, utcMin, 0, 0);
  return d;
}

// ─── Main ───────────────────────────────────────────────────────────────────
async function main() {
  console.log("=== Intern Attendance Seeder ===\n");

  const masterConn = getMasterConnection();
  await waitForConnection(masterConn);
  console.log("✔  Connected to master DB");

  const MasterCompany =
    masterConn.models.Company ||
    masterConn.model("Company", CompanyModelExport.schema);

  const allCompanies = await MasterCompany.find({}).lean();
  if (!allCompanies.length) {
    console.error("✘  No companies found in master DB.");
    process.exit(1);
  }

  console.log(`   Found ${allCompanies.length} company(ies) in master DB.`);

  // Scan tenant DBs to locate the interns
  let targetDbName    = null;
  let targetCompanyId = null;
  let foundInternIds  = [];

  for (const company of allCompanies) {
    const dbName = company.dbName;
    if (!dbName) continue;

    const tenantConn = getTenantConnection(dbName);
    await waitForConnection(tenantConn);

    const models = getModelsForConnection(tenantConn);
    const Intern = models["Intern"];
    if (!Intern) continue;

    const found = await Intern.find(
      { internid: { $in: INTERN_IDS } },
      { internid: 1, fullName: 1, companyId: 1 }
    ).lean();

    if (found.length > 0) {
      console.log(
        `   Found ${found.length} intern(s) in DB "${dbName}" (${company.name || company.companyCode})`
      );
      found.forEach(i =>
        console.log(`     • internid=${i.internid}  name=${i.fullName}`)
      );
      targetDbName    = dbName;
      targetCompanyId = found[0].companyId;
      foundInternIds  = found.map(i => i.internid);
      break;
    }
  }

  if (!targetDbName || !foundInternIds.length) {
    console.error("\n✘  None of the target intern IDs were found in any tenant DB.");
    console.error("   IDs searched:", INTERN_IDS.join(", "));
    process.exit(1);
  }

  const missing = INTERN_IDS.filter(id => !foundInternIds.includes(id));
  if (missing.length) {
    console.warn(`\n⚠  IDs NOT found (will be skipped): ${missing.join(", ")}`);
  }

  // Get the Attendance model for that tenant
  const tenantConn = getTenantConnection(targetDbName);
  const models     = getModelsForConnection(tenantConn);
  const Attendance = models["attendance"];

  if (!Attendance) {
    console.error("✘  attendance model not found in tenant DB.");
    process.exit(1);
  }

  // Seed attendance records
  let inserted = 0;
  let skipped  = 0;

  console.log();
  for (const internid of foundInternIds) {
    for (const dateStr of DATES) {
      const exists = await Attendance.findOne({ internId: internid, date: dateStr });
      if (exists) {
        console.log(`   ⚠  Skip  ${internid} / ${dateStr} — already exists`);
        skipped++;
        continue;
      }

      const punchIn  = buildDateTime(dateStr, PUNCH_IN_HOUR_UTC,  PUNCH_IN_MIN_UTC);
      const punchOut = buildDateTime(dateStr, PUNCH_OUT_HOUR_UTC, PUNCH_OUT_MIN_UTC);

      const record = new Attendance({
        companyId:        targetCompanyId,
        internId:         internid,
        date:             dateStr,
        punchInTime:      punchIn,
        punchOutTime:     punchOut,
        duration:         DURATION,
        punchInLocation:  null,
        punchOutLocation: null,
      });

      await record.save();
      console.log(`   ✔  Seeded  ${internid} / ${dateStr}  (3:00 PM – 5:00 PM IST)`);
      inserted++;
    }
  }

  console.log("\n─────────────────────────────────────────────");
  console.log(`  Inserted : ${inserted}`);
  console.log(`  Skipped  : ${skipped}`);
  console.log("─────────────────────────────────────────────");
  console.log("Done ✔");

  process.exit(0);
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
