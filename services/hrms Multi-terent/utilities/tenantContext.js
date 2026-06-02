const { AsyncLocalStorage } = require('async_hooks');

const tenantLocalStorage = new AsyncLocalStorage();

const getTenantId = () => {
  const store = tenantLocalStorage.getStore();
  return store ? store.companyId : null;
};

const runWithTenant = (data, callback) => {
  // We can pass an object with companyId and dbName
  return tenantLocalStorage.run(data, callback);
};

module.exports = {
  getTenantId,
  runWithTenant,
  tenantLocalStorage
};
