const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildLeadDedupKey,
  enrichLeadForStorage,
  formatCode,
  formatCompanyName,
  formatDescription,
  formatEmail,
  formatLeadId,
  formatLocation,
  formatPersonName,
  normalizePhone,
  normalizeRemarks,
  normalizeText,
  toTitleCase,
} = require('../services/leadNormalization');

test('formatLeadId formats sequential lead IDs with 6 digits and expands dynamically', () => {
  assert.equal(formatLeadId(1), 'L000001');
  assert.equal(formatLeadId(15), 'L000015');
  assert.equal(formatLeadId(999999), 'L999999');
  assert.equal(formatLeadId(1000000), 'L1000000');
  assert.equal(formatLeadId(10000000), 'L10000000');
});

test('normalizePhone strips formatting and uses the last 10 digits', () => {
  assert.equal(normalizePhone('+91 98765-43210'), '9876543210');
  assert.equal(normalizePhone('(044) 4000 1234'), '4440001234');
  assert.equal(normalizePhone(''), '');
});

test('normalizeText lowercases, trims, and collapses whitespace', () => {
  assert.equal(normalizeText('  Acme   Holdings  '), 'acme holdings');
});

test('normalizeRemarks returns a trimmed array', () => {
  assert.deepEqual(normalizeRemarks([' first ', '', 'second']), ['first', 'second']);
  assert.deepEqual(normalizeRemarks(' one-off '), ['one-off']);
});

test('formatCompanyName applies industry standard Title Casing and suffix standardization', () => {
  assert.equal(formatCompanyName('QUABLE RARE RESOURCES PRIVATE LIMITED'), 'Quable Rare Resources Private Limited');
  assert.equal(formatCompanyName('surya sri manyam products pvt. ltd.'), 'Surya Sri Manyam Products Pvt Ltd');
  assert.equal(formatCompanyName('abc it & ai solutions llp'), 'Abc IT & AI Solutions LLP');
  assert.equal(formatCompanyName('GLOBAL LOGISTICS CORP.'), 'Global Logistics Corp');
  assert.equal(formatCompanyName('tech soft solutions llc'), 'Tech Soft Solutions LLC');
});

test('formatPersonName formats names and initials cleanly', () => {
  assert.equal(formatPersonName('LAKSHMI PEPAKAYALA'), 'Lakshmi Pepakayala');
  assert.equal(formatPersonName('karthigayini m'), 'Karthigayini M');
  assert.equal(formatPersonName('john o\'connor'), 'John O\'Connor');
  assert.equal(formatPersonName('jean-pierre smith'), 'Jean-Pierre Smith');
});

test('formatEmail trims and lowercases email addresses', () => {
  assert.equal(formatEmail('  CEO@ACME.COM  '), 'ceo@acme.com');
  assert.equal(formatEmail('John.Doe@Softrate.com'), 'john.doe@softrate.com');
});

test('formatCode standardizes identifiers to uppercase', () => {
  assert.equal(formatCode('  u72900tn2020ptc123456  '), 'U72900TN2020PTC123456');
  assert.equal(formatCode('roc chennai'), 'ROC CHENNAI');
});

test('formatLocation title cases city and state', () => {
  assert.equal(formatLocation('BANGALORE'), 'Bangalore');
  assert.equal(formatLocation('tamil nadu'), 'Tamil Nadu');
});

test('enrichLeadForStorage populates normalized lead fields with proper casing', () => {
  const lead = enrichLeadForStorage({
    companyCode: ' dv01 ',
    assignedEmployeePhone: ' 9999999999 ',
    leadCompanyName: '  QUABLE RARE RESOURCES PVT. LTD.  ',
    contactName: '  lakshmi pepakayala ',
    contactNumber: '+91 98765 43210',
    setLabel: ' april 2026 ',
    directorEmailAddress: ' CEO@ACME.COM ',
    city: ' CHENNAI ',
    state: ' tamil nadu ',
    cin: ' u72900tn2020ptc123456 ',
    mainDivisionDescription: ' information technology & services ',
    remarks: [' first touch '],
  });

  assert.equal(lead.companyCode, 'DV01');
  assert.equal(lead.leadCompanyName, 'Quable Rare Resources Pvt Ltd');
  assert.equal(lead.contactName, 'Lakshmi Pepakayala');
  assert.equal(lead.city, 'Chennai');
  assert.equal(lead.state, 'Tamil Nadu');
  assert.equal(lead.cin, 'U72900TN2020PTC123456');
  assert.equal(lead.mainDivisionDescription, 'Information Technology & Services');
  assert.equal(lead.contactNumberNormalized, '9876543210');
  assert.equal(lead.leadCompanyNameLower, 'quable rare resources pvt ltd');
  assert.equal(lead.contactNameLower, 'lakshmi pepakayala');
  assert.equal(lead.directorEmailLower, 'ceo@acme.com');
  assert.equal(lead.setLabelLower, 'april 2026');
  assert.deepEqual(lead.remarks, ['first touch']);
  assert.equal(lead.isArchived, false);
});

test('buildLeadDedupKey uses normalized company and phone values', () => {
  const key = buildLeadDedupKey({
    companyCode: 'dv01',
    assignedEmployeePhone: '9999999999',
    contactNumber: '+91 98765 43210',
    leadCompanyName: ' Acme Corp ',
  });

  assert.equal(key, 'DV01__9999999999__9876543210__acme corp');
});
