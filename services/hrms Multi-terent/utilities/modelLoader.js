const fs = require('fs');
const path = require('path');

let schemaCache = null;

const loadSchemas = () => {
  if (schemaCache) return schemaCache;
  schemaCache = {};
  
  const modelsDir = path.join(__dirname, '../models');
  const files = fs.readdirSync(modelsDir);
  
  for (const file of files) {
    if (file.endsWith('.js')) {
      const exported = require(path.join(modelsDir, file));
      if (exported && exported.name && exported.schema) {
        schemaCache[exported.name] = exported.schema;
      }
    }
  }
  
  return schemaCache;
};

const getModelsForConnection = (connection) => {
  const schemas = loadSchemas();
  const models = {};
  
  for (const [name, schema] of Object.entries(schemas)) {
    // If the connection already has the model, it returns it.
    // Otherwise, it creates it.
    models[name] = connection.models[name] || connection.model(name, schema);
  }
  
  return models;
};

module.exports = { getModelsForConnection };
