const mongoose = require('mongoose');

// The base URI for MongoDB connection (default to local if not in env)
// Note: You may want to ensure MONGO_URI in .env doesn't end with a slash or DB name
let mongoURI = process.env.MONGO_URI;
if (mongoURI.endsWith('/')) {
  mongoURI = mongoURI.slice(0, -1);
}

const masterDbName = 'hrdb_master';

// Cache for connection instances
const connections = {};

/**
 * Returns a Promise that resolves once the connection is open.
 * If it's already open (readyState === 1), resolves immediately.
 */
const waitForConnection = (conn) => {
  return new Promise((resolve, reject) => {
    if (conn.readyState === 1) return resolve(conn); // already connected
    conn.once('connected', () => resolve(conn));
    conn.once('error', (err) => reject(err));
  });
};

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
  getTenantConnection,
  waitForConnection
};
