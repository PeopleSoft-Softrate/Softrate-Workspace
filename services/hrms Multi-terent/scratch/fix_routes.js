const fs = require('fs');

const filePath = '/Users/yovelr/Softrate/softrate-workspace/Softrate-Workspace/services/hrms Multi-terent/routes/employeeLeave.routes.js';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Comment out the global requires
content = content.replace(/const EmployeeLeave = require\("..\/models\/employeeLeave.model"\);/g, '// const EmployeeLeave = require("../models/employeeLeave.model");');
content = content.replace(/const LeaveCounter = require\("..\/models\/leaveCounter.model"\);/g, '// const LeaveCounter = require("../models/leaveCounter.model");');
content = content.replace(/const Intern = require\("..\/models\/Intern"\);/g, '// const Intern = require("../models/Intern");');
content = content.replace(/const Employee = require\("..\/models\/EmployeeModel"\);/g, '// const Employee = require("../models/EmployeeModel");');
content = content.replace(/const Leave = require\("..\/models\/leave.model"\);/g, '// const Leave = require("../models/leave.model");');

// 2. Inject `const { EmployeeLeave, LeaveCounter, Intern, Employee, Leave } = req.models;` into every router handler that has `(req, res) => {`
const injectionString = `\n    const { EmployeeLeave, LeaveCounter, Intern, Employee, Leave } = req.models;\n`;

// Only replace if not already injected
if (!content.includes(injectionString.trim())) {
  content = content.replace(/async\s*\(\s*req\s*,\s*res\s*\)\s*=>\s*\{/g, (match) => {
    return match + injectionString;
  });
}

fs.writeFileSync(filePath, content);
console.log('Refactored employeeLeave.routes.js');
