const { hashObject, invalidatePrefix } = require('./cacheService');

const LEAD_CACHE_TTLS = {
  list: 45,
  facets: 120,
  companyContacts: 120,
};
const LEAD_CACHE_NAMESPACE = 'lead:v3';

function buildEmployeeLeadListKey(companyCode, employeeId, params) {
  return `${LEAD_CACHE_NAMESPACE}:list:employee:${companyCode}:${employeeId}:${hashObject(params)}`;
}

function buildAdminLeadListKey(companyCode, params) {
  return `${LEAD_CACHE_NAMESPACE}:list:admin:${companyCode}:${hashObject(params)}`;
}

function buildEmployeeSetKey(companyCode, employeeId, params) {
  return `${LEAD_CACHE_NAMESPACE}:sets:employee:${companyCode}:${employeeId}:${hashObject(params)}`;
}

function buildAdminSetKey(companyCode, params) {
  return `${LEAD_CACHE_NAMESPACE}:sets:admin:${companyCode}:${hashObject(params)}`;
}

function buildEmployeeCompanyKey(companyCode, employeeId, params) {
  return `${LEAD_CACHE_NAMESPACE}:companies:employee:${companyCode}:${employeeId}:${hashObject(params)}`;
}

function buildEmployeeCompanyContactsKey(companyCode, employeeId, params) {
  return `${LEAD_CACHE_NAMESPACE}:company-contacts:employee:${companyCode}:${employeeId}:${hashObject(params)}`;
}

function buildAdminCompanyKey(companyCode, params) {
  return `${LEAD_CACHE_NAMESPACE}:companies:admin:${companyCode}:${hashObject(params)}`;
}

function buildEmployeeStatusCountKey(companyCode, employeeId, params) {
  return `${LEAD_CACHE_NAMESPACE}:status-counts:employee:${companyCode}:${employeeId}:${hashObject(params)}`;
}

async function invalidateLeadCaches({ companyCode, employeeId }) {
  const prefixes = [
    `${LEAD_CACHE_NAMESPACE}:list:admin:${companyCode}:`,
    `${LEAD_CACHE_NAMESPACE}:sets:admin:${companyCode}:`,
    `${LEAD_CACHE_NAMESPACE}:companies:admin:${companyCode}:`,
    `lead:list:admin:${companyCode}:`,
    `lead:sets:admin:${companyCode}:`,
    `lead:companies:admin:${companyCode}:`,
  ];

  if (employeeId) {
    prefixes.push(
      `${LEAD_CACHE_NAMESPACE}:list:employee:${companyCode}:${employeeId}:`,
      `${LEAD_CACHE_NAMESPACE}:sets:employee:${companyCode}:${employeeId}:`,
      `${LEAD_CACHE_NAMESPACE}:companies:employee:${companyCode}:${employeeId}:`,
      `${LEAD_CACHE_NAMESPACE}:company-contacts:employee:${companyCode}:${employeeId}:`,
      `${LEAD_CACHE_NAMESPACE}:status-counts:employee:${companyCode}:${employeeId}:`,
      `lead:list:employee:${companyCode}:${employeeId}:`,
      `lead:sets:employee:${companyCode}:${employeeId}:`,
      `lead:companies:employee:${companyCode}:${employeeId}:`,
      `lead:status-counts:employee:${companyCode}:${employeeId}:`,
    );
  } else {
    prefixes.push(
      `${LEAD_CACHE_NAMESPACE}:list:employee:${companyCode}:`,
      `${LEAD_CACHE_NAMESPACE}:sets:employee:${companyCode}:`,
      `${LEAD_CACHE_NAMESPACE}:companies:employee:${companyCode}:`,
      `${LEAD_CACHE_NAMESPACE}:company-contacts:employee:${companyCode}:`,
      `${LEAD_CACHE_NAMESPACE}:status-counts:employee:${companyCode}:`,
      `lead:list:employee:${companyCode}:`,
      `lead:sets:employee:${companyCode}:`,
      `lead:companies:employee:${companyCode}:`,
      `lead:status-counts:employee:${companyCode}:`,
    );
  }

  await Promise.all(prefixes.map((prefix) => invalidatePrefix(prefix)));
}

module.exports = {
  LEAD_CACHE_TTLS,
  buildAdminCompanyKey,
  buildAdminLeadListKey,
  buildAdminSetKey,
  buildEmployeeCompanyContactsKey,
  buildEmployeeCompanyKey,
  buildEmployeeLeadListKey,
  buildEmployeeSetKey,
  buildEmployeeStatusCountKey,
  invalidateLeadCaches,
};
