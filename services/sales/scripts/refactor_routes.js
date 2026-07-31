const fs = require('fs');
const path = require('path');

const routeFiles = [
  'src/modules/leads/lead.routes.js',
  'src/modules/follow-ups/follow-up.routes.js',
  'src/modules/break-logs/break-log.routes.js',
  'src/modules/quotations/quotation.routes.js',
  'src/modules/invoices/invoice.routes.js',
  'src/modules/reports/report.routes.js',
  'src/modules/history/history.routes.js'
];

const injectString = "\n  const { Lead, CallLog, CallDetail, Bookmark, BreakLog, Quotation, Invoice, History } = req.models;";

for (const file of routeFiles) {
  const filePath = path.join(__dirname, '..', file);
  if (!fs.existsSync(filePath)) {
    console.log(`Skipping ${file}, does not exist`);
    continue;
  }

  let content = fs.readFileSync(filePath, 'utf8');

  // Regex to find route definitions like: router.get('/path', async (req, res) => {
  // or router.post('/path', upload.single('file'), async (req, res) => {
  
  // A robust regex to match the start of an async route handler
  content = content.replace(/(router\.(?:get|post|put|patch|delete)\(.*?,?\s*async\s*\(\s*req\s*,\s*res\s*\)\s*=>\s*\{)/g, `$1${injectString}`);

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Refactored ${file}`);
}
