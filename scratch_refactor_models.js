const fs = require('fs');
const path = require('path');

const modelsDir = '/Users/yovelr/Softrate/softrate-workspace/Softrate-Workspace/services/hrms Multi-terent/models';
const files = fs.readdirSync(modelsDir);

let count = 0;

for (const file of files) {
  if (!file.endsWith('.js')) continue;
  const filePath = path.join(modelsDir, file);
  let content = fs.readFileSync(filePath, 'utf8');

  // We need to match things like:
  // module.exports = mongoose.model("EmployeeLeaves", EmployeeLeaveSchema);
  // and handle newlines just in case.

  const regex = /module\.exports\s*=\s*mongoose\.model\s*\(\s*(['"`])([^'"`]+)\1\s*,\s*([a-zA-Z0-9_]+)\s*\);?/g;

  content = content.replace(regex, (match, quote, modelName, schemaVar) => {
    count++;
    return `module.exports = { name: "${modelName}", schema: ${schemaVar} };`;
  });
  
  // also handle the two multi-line ones:
  // Employeeattendancemodel.js and employee-resignation-model.js
  const regexMultiline = /module\.exports\s*=\s*mongoose\.model\s*\(\s*\n?\s*(['"`])([^'"`]+)\1\s*,\s*\n?\s*([a-zA-Z0-9_]+)\s*\n?\s*\);?/g;
  
  content = content.replace(regexMultiline, (match, quote, modelName, schemaVar) => {
    count++;
    return `module.exports = { name: "${modelName}", schema: ${schemaVar} };`;
  });

  // Remove the tenantPlugin requirement if it exists
  const pluginRegex = /^[^\n]*require\(['"]\.\.\/utilities\/tenantPlugin['"]\)[^\n]*\n?/gm;
  content = content.replace(pluginRegex, '');
  
  // Remove schema.plugin(tenantPlugin)
  const pluginUsageRegex = /^[^\n]*\.plugin\(tenantPlugin\)[^\n]*\n?/gm;
  content = content.replace(pluginUsageRegex, '');

  fs.writeFileSync(filePath, content, 'utf8');
}

console.log(`Updated ${count} model exports.`);
