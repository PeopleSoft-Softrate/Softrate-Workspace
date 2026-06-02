const fs = require('fs');
const path = require('path');

const modelsDir = '/Users/yovelr/Softrate/softrate-workspace/Softrate-Workspace/services/hrms Multi-terent/models';
const files = fs.readdirSync(modelsDir);

let count = 0;

for (const file of files) {
  if (!file.endsWith('.js')) continue;
  const filePath = path.join(modelsDir, file);
  let content = fs.readFileSync(filePath, 'utf8');

  // Skip CompanyModel.js as it's a master model
  if (file === 'CompanyModel.js') continue;

  // Currently they look like:
  // module.exports = { name: "Intern", schema: InternSchema };
  // We need to parse name and schema variable.

  const match = content.match(/module\.exports\s*=\s*{\s*name:\s*(['"`])([^'"`]+)\1\s*,\s*schema:\s*([a-zA-Z0-9_]+)\s*};?/);
  
  if (match) {
    const quote = match[1];
    const modelName = match[2];
    const schemaVar = match[3];

    const proxyTemplate = `// Multi-Tenant Proxy Wrapper
module.exports = new Proxy({ name: "${modelName}", schema: ${schemaVar} }, {
  get(target, prop) {
    if (prop === 'name') return target.name;
    if (prop === 'schema') return target.schema;

    const { getTenantConnection } = require('../db');
    const { getModelsForConnection } = require('../utilities/modelLoader');
    const { tenantLocalStorage } = require('../utilities/tenantContext');
    
    // Try to get dbName from AsyncLocalStorage, fallback to hrdb for legacy/public routes
    const store = tenantLocalStorage ? tenantLocalStorage.getStore() : null;
    const dbName = store && store.dbName ? store.dbName : 'hrdb';
    
    const connection = getTenantConnection(dbName);
    const models = getModelsForConnection(connection);
    const actualModel = models["${modelName}"];
    
    if (!actualModel) {
      throw new Error(\`Model ${modelName} could not be loaded for db \${dbName}\`);
    }

    if (typeof actualModel[prop] === 'function') {
      return actualModel[prop].bind(actualModel);
    }
    return actualModel[prop];
  }
});`;

    content = content.replace(match[0], proxyTemplate);
    fs.writeFileSync(filePath, content, 'utf8');
    count++;
  }
}

console.log(`Successfully proxy-wrapped ${count} models!`);
