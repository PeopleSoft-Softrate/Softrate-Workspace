const mongoose = require('mongoose');

// The base URI for MongoDB connection (default to local if not in env)
// Note: You may want to ensure MONGO_URI in .env doesn't end with a slash or DB name
const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017';

const masterDbName = 'hrdb_master';

// Cache for connection instances
const connections = {};

/**
 * Get or create the master connection
 */
const getMasterConnection = () => {
  if (connections[masterDbName]) {
    return connections[masterDbName];
  }

  const masterUri = `${mongoURI}/${masterDbName}`;
  const masterConnection = mongoose.createConnection(masterUri);

  masterConnection.on('connected', () => {
    console.log(`Connected to Master DB: ${masterDbName}`);
  });
  
  masterConnection.on('error', (err) => {
    console.error(`Master DB Connection Error:`, err);
  });

  connections[masterDbName] = masterConnection;
  return masterConnection;
};

/**
 * Get or create a tenant connection
 */
const getTenantConnection = (dbName) => {
  if (connections[dbName]) {
    return connections[dbName];
  }

  const tenantUri = `${mongoURI}/${dbName}`;
  const tenantConnection = mongoose.createConnection(tenantUri);

  tenantConnection.on('connected', () => {
    console.log(`Connected to Tenant DB: ${dbName}`);
  });

  tenantConnection.on('error', (err) => {
    console.error(`Tenant DB (${dbName}) Connection Error:`, err);
  });

  connections[dbName] = tenantConnection;
  return tenantConnection;
};

module.exports = {
  getMasterConnection,
  getTenantConnection
};
