const fs = require('fs');

const filePath = '/Users/yovelr/Softrate/softrate-workspace/Softrate-Workspace/services/hrms Multi-terent/routes/leaveCounter.routes.js';
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(/const LeaveCounter = require\("..\/models\/leaveCounter.model"\);/g, '// const LeaveCounter = require("../models/leaveCounter.model");');
content = content.replace(/const Employee = require\("..\/models\/EmployeeModel"\);/g, '// const Employee = require("../models/EmployeeModel");');
content = content.replace(/const Intern = require\("..\/models\/Intern"\);/g, '// const Intern = require("../models/Intern");');

const injectionString = `\n    const { LeaveCounter, Employee, Intern } = req.models;\n`;

if (!content.includes('const { LeaveCounter, Employee, Intern } = req.models;')) {
  content = content.replace(/async\s*\(\s*req\s*,\s*res\s*\)\s*=>\s*\{/g, (match) => {
    return match + injectionString;
  });
}

fs.writeFileSync(filePath, content);
console.log('Refactored leaveCounter.routes.js');
