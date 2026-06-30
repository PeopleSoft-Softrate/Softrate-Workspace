/**
 * Update Attendance Hours for Interns 261189 – 261197
 * - Adds ±1-2 min random jitter to punchIn/punchOut times
 * - Calculates and stores correct duration string ("2h Xm")
 *
 * Usage:
 *   cd "services/hrms Multi-terent"
 *   node scripts/update-intern-attendance-hours.js
 */

require("dotenv").config({ path: "./.env" });

const { getMasterConnection, getTenantConnection, waitForConnection } = require("../db");
const { getModelsForConnection } = require("../utilities/modelLoader");
const CompanyModelExport = require("../models/CompanyModel");

// ─── Config ────────────────────────────────────────────────────────────────
const INTERN_IDS = ["261189", "261190", "261191", "261192", "261193",
                    "261194", "261195", "261196", "261197"];

// Base times in UTC (3 PM IST = 09:30 UTC, 5 PM IST = 11:30 UTC)
const BASE_PUNCH_IN_UTC  = { h: 9,  m: 30 };
const BASE_PUNCH_OUT_UTC = { h: 11, m: 30 };

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Random integer between min and max inclusive */
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Random jitter: -2, -1, +1, or +2 minutes (never exactly 0) */
function jitter() {
  const options = [-2, -1, 1, 2];
  return options[Math.floor(Math.random() * options.length)];
}

/** Add minutes to a Date, return new Date */
function addMinutes(date, mins) {
  return new Date(date.getTime() + mins * 60 * 1000);
}

/** Build a base UTC datetime from a date string + UTC hour/minute */
function buildBase(dateStr, utcHour, utcMin) {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  d.setUTCHours(utcHour, utcMin, 0, 0);
  return d;
}

/** Format duration as "Xh Ym" */
function formatDuration(punchIn, punchOut) {
  const diffMs  = punchOut - punchIn;
  const diffMin = Math.round(diffMs / 60000);
  const hrs = Math.floor(diffMin / 60);
  const min = diffMin % 60;
  return `${hrs}h ${min}m`;
}

// ─── Main ───────────────────────────────────────────────────────────────────
async function main() {
  console.log("=== Update Intern Attendance Hours ===\n");

  const masterConn = getMasterConnection();
  await waitForConnection(masterConn);
  console.log("✔  Connected to master DB");

  const MasterCompany =
    masterConn.models.Company ||
    masterConn.model("Company", CompanyModelExport.schema);

  const allCompanies = await MasterCompany.find({}).lean();

  // Find tenant DB containing target interns
  let targetDbName = null;

  for (const company of allCompanies) {
    const dbName = company.dbName;
    if (!dbName) continue;

    const tenantConn = getTenantConnection(dbName);
    await waitForConnection(tenantConn);

    const models = getModelsForConnection(tenantConn);
    const Intern = models["Intern"];
    if (!Intern) continue;

    const found = await Intern.findOne({ internid: { $in: INTERN_IDS } }).lean();
    if (found) {
      targetDbName = dbName;
      console.log(`   Tenant DB: "${dbName}"`);
      break;
    }
  }

  if (!targetDbName) {
    console.error("✘  Could not find interns in any tenant DB.");
    process.exit(1);
  }

  const tenantConn = getTenantConnection(targetDbName);
  const models     = getModelsForConnection(tenantConn);
  const Attendance = models["attendance"];

  if (!Attendance) {
    console.error("✘  attendance model not found.");
    process.exit(1);
  }

  // Fetch all attendance records for these interns
  const records = await Attendance.find({ internId: { $in: INTERN_IDS } });
  console.log(`\n   Found ${records.length} attendance record(s) to update.\n`);

  let updated = 0;

  for (const rec of records) {
    const dateStr = rec.date; // "YYYY-MM-DD"

    // Build jittered punch times
    const baseIn  = buildBase(dateStr, BASE_PUNCH_IN_UTC.h,  BASE_PUNCH_IN_UTC.m);
    const baseOut = buildBase(dateStr, BASE_PUNCH_OUT_UTC.h, BASE_PUNCH_OUT_UTC.m);

    const jitterIn  = jitter(); // ±1-2 min
    const jitterOut = jitter(); // ±1-2 min

    const punchIn  = addMinutes(baseIn,  jitterIn);
    const punchOut = addMinutes(baseOut, jitterOut);
    const duration = formatDuration(punchIn, punchOut);

    // Human-readable IST for logging
    const istIn  = new Date(punchIn.getTime()  + 5.5 * 3600000);
    const istOut = new Date(punchOut.getTime() + 5.5 * 3600000);
    const fmtIST = d =>
      `${String(d.getUTCHours()).padStart(2,'0')}:${String(d.getUTCMinutes()).padStart(2,'0')}`;

    rec.punchInTime  = punchIn;
    rec.punchOutTime = punchOut;
    rec.duration     = duration;

    await rec.save();

    console.log(
      `   ✔  ${rec.internId} / ${dateStr}  ` +
      `in=${fmtIST(istIn)} IST  out=${fmtIST(istOut)} IST  ` +
      `(${jitterIn > 0 ? '+' : ''}${jitterIn}m / ${jitterOut > 0 ? '+' : ''}${jitterOut}m)  ` +
      `dur=${duration}`
    );
    updated++;
  }

  console.log("\n─────────────────────────────────────────────");
  console.log(`  Updated : ${updated} record(s)`);
  console.log("─────────────────────────────────────────────");
  console.log("Done ✔");

  process.exit(0);
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
