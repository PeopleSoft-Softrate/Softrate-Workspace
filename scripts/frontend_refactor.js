const fs = require('fs');
const path = require('path');

const dirs = [
  '/Users/yovelr/Softrate/softrate-workspace/Softrate-Workspace/apps/sales/admin-crm/src',
  '/Users/yovelr/Softrate/softrate-workspace/Softrate-Workspace/apps/sales/emp/src'
];

const replacements = [
  [/assignedEmployeePhones/g, 'assignedEmployeeIds'],
  [/assignedEmployeePhone/g, 'assignedEmployeeId'],
  [/projectManagerPhone/g, 'projectManagerId'],
  [/\.employee\?\.mobile/g, '.employee?._id'],
  [/\.selectedEmployee\?\.mobile/g, '.selectedEmployee?._id'],
  [/\.selectedEmployee\!\.mobile/g, '.selectedEmployee!._id'],
  [/employeePhone: (.*?)\.mobile/g, 'employeeId: $1._id'],
  [/employeePhone([:?])/g, 'employeeId$1'],
  [/employeePhone([^A-Za-z0-9])/g, 'employeeId$1'],
  [/(projectManagerId\s*=\s*manager)\.mobile/g, '$1._id'],
  [/(leadEmployeeFilter\s*===\s*.*?)\.mobile/g, '$1._id'],
];

function processDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      processDir(fullPath);
    } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.html')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let changed = false;
      for (const [regex, replacement] of replacements) {
        if (regex.test(content)) {
          content = content.replace(regex, replacement);
          changed = true;
        }
      }
      if (changed) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log(`Updated: ${fullPath}`);
      }
    }
  }
}

for (const dir of dirs) {
  console.log(`Processing ${dir}...`);
  processDir(dir);
}
console.log('Done refactoring frontend!');
