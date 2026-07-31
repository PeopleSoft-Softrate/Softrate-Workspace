const fs = require('fs');
const path = require('path');

// 1. Refactor leadQueryService
let lqPath = path.join(__dirname, '..', 'services', 'leadQueryService.js');
let content = fs.readFileSync(lqPath, 'utf8');

// Replace Lead.aggregate/find with LeadModel.aggregate/find inside functions
content = content.replace(/Lead\./g, 'LeadModel.');

// Update function signatures
content = content.replace(/getLeadDivisions\(\{/g, 'getLeadDivisions({ LeadModel,');
content = content.replace(/getLeadSets\(\{/g, 'getLeadSets({ LeadModel,');
content = content.replace(/getLeadCompanies\(\{/g, 'getLeadCompanies({ LeadModel,');

// Also update the require Lead at top to prevent unused variable error, or just leave it
content = content.replace("const Lead = require('../models/Lead');", "// Removed global Lead require");

fs.writeFileSync(lqPath, content, 'utf8');


// 2. Refactor historyService
let hsPath = path.join(__dirname, '..', 'services', 'historyService.js');
let hsContent = fs.readFileSync(hsPath, 'utf8');

hsContent = hsContent.replace(/async function logChange\(\{/g, 'async function logChange({ HistoryModel,');
hsContent = hsContent.replace(/const log = new History\(/g, 'const log = new HistoryModel(');
hsContent = hsContent.replace("const History = require('../models/History');", "// Removed global History require");

fs.writeFileSync(hsPath, hsContent, 'utf8');

// 3. Patch lead.routes.js and follow-up.routes.js to pass the models
let leadRoutes = path.join(__dirname, '..', 'src', 'modules', 'leads', 'lead.routes.js');
let lrContent = fs.readFileSync(leadRoutes, 'utf8');

lrContent = lrContent.replace(/getLeadSets\(\{/g, 'getLeadSets({ LeadModel: req.models.Lead,');
lrContent = lrContent.replace(/getLeadCompanies\(\{/g, 'getLeadCompanies({ LeadModel: req.models.Lead,');
lrContent = lrContent.replace(/getLeadDivisions\(\{/g, 'getLeadDivisions({ LeadModel: req.models.Lead,');
lrContent = lrContent.replace(/logChange\(\{/g, 'logChange({ HistoryModel: req.models.History,');

fs.writeFileSync(leadRoutes, lrContent, 'utf8');

let fwRoutes = path.join(__dirname, '..', 'src', 'modules', 'follow-ups', 'follow-up.routes.js');
let fwContent = fs.readFileSync(fwRoutes, 'utf8');
fwContent = fwContent.replace(/logChange\(\{/g, 'logChange({ HistoryModel: req.models.History,');
fs.writeFileSync(fwRoutes, fwContent, 'utf8');

console.log("Refactored services and their usages");
