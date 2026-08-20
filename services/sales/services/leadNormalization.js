function normalizeText(value) {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function normalizePhone(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.length > 10 ? digits.slice(-10) : digits;
}

function normalizeRemarks(remarks) {
  const items = Array.isArray(remarks)
    ? remarks
    : remarks
      ? [remarks]
      : [];

  return items
    .map((item) => String(item ?? '').trim())
    .filter(Boolean);
}

// Common industry acronyms that should remain uppercase in titles/descriptions
const KNOWN_ACRONYMS = new Set([
  'IT', 'AI', 'IOT', 'ML', 'HR', 'BPO', 'KPO', 'R&D', 'M&A', 'TCS', 'IBM', 'MRF', 
  'HDFC', 'ICICI', 'SBI', 'L&T', 'USA', 'UK', 'UAE', 'CIN', 'DIN', 'GST', 
  'GSTIN', 'PAN', 'TAN', 'ROC', 'MCA', 'LLP', 'LLC', 'PLC', 'GMBH', 'ISO'
]);

/**
 * Converts a string into proper Title/Capital case with smart token handling.
 * e.g. "JOHN DOE" -> "John Doe", "o'connor" -> "O'Connor", "jean-pierre" -> "Jean-Pierre"
 */
function toTitleCase(value) {
  if (!value) return '';
  const str = String(value).trim().replace(/\s+/g, ' ');
  if (!str) return '';

  return str
    .split(' ')
    .map((word) => {
      if (!word) return '';

      // Handle hyphenated words e.g. "Jean-Pierre"
      if (word.includes('-')) {
        return word
          .split('-')
          .map((sub) => toTitleCase(sub))
          .join('-');
      }

      // Handle apostrophes e.g. "O'Connor", "D'Souza"
      if (word.includes("'")) {
        return word
          .split("'")
          .map((sub) => sub ? sub.charAt(0).toUpperCase() + sub.slice(1).toLowerCase() : '')
          .join("'");
      }

      // Handle Roman numerals e.g. "II", "III", "IV", "VI", "VII", "VIII", "IX", "X"
      if (/^(ii|iii|iv|vi|vii|viii|ix|x)$/i.test(word)) {
        return word.toUpperCase();
      }

      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

/**
 * Formats company names according to corporate and industry standards:
 * - Proper Title Case for standard words
 * - Standardized legal entity abbreviations (Pvt Ltd, LLP, LLC, Inc, etc.)
 * - Preserved uppercase for known industry acronyms (IT, AI, BPO, etc.)
 */
function formatCompanyName(value) {
  if (!value) return '';
  const str = String(value).trim().replace(/\s+/g, ' ');
  if (!str) return '';

  const words = str.split(' ');
  const formattedWords = words.map((w) => {
    const clean = w.toUpperCase().replace(/[^A-Z0-9&]/g, '');
    if (KNOWN_ACRONYMS.has(clean)) {
      return w.toUpperCase();
    }
    return toTitleCase(w);
  });

  let result = formattedWords.join(' ');

  // Standardize corporate suffixes cleanly
  result = result
    .replace(/\bPvt\.?\s*Ltd\.?(?!\w)/gi, 'Pvt Ltd')
    .replace(/\bPrivate\s+Limited\.?(?!\w)/gi, 'Private Limited')
    .replace(/\bL\.?L\.?P\.?(?!\w)/gi, 'LLP')
    .replace(/\bL\.?L\.?C\.?(?!\w)/gi, 'LLC')
    .replace(/\bInc\.?(?!\w)/gi, 'Inc')
    .replace(/\bCorp\.?(?!\w)/gi, 'Corp')
    .replace(/\bCo\.?(?!\w)/gi, 'Co.');

  return result.trim();
}

/**
 * Formats person names (contacts, directors, owners):
 * - Proper Title Case
 * - Formats single initials cleanly (e.g. "m" -> "M", "s." -> "S.")
 */
function formatPersonName(value) {
  if (!value) return '';
  const str = String(value).trim().replace(/\s+/g, ' ');
  if (!str) return '';

  return str
    .split(' ')
    .map((word) => {
      if (!word) return '';
      if (/^[a-zA-Z]\.?$/.test(word)) {
        return word.toUpperCase();
      }
      return toTitleCase(word);
    })
    .join(' ');
}

/**
 * Formats email addresses: trimmed, lowercase.
 */
function formatEmail(value) {
  if (!value) return '';
  return String(value).trim().toLowerCase();
}

/**
 * Formats identification codes (CIN, DIN, PAN, ROC, Registration #):
 * - Trimmed, uppercase.
 */
function formatCode(value) {
  if (!value) return '';
  return String(value).trim().toUpperCase();
}

/**
 * Formats city/state/country locations:
 * - Proper Title Case.
 */
function formatLocation(value) {
  if (!value) return '';
  return toTitleCase(value);
}

/**
 * Formats division / category / description fields:
 * - Clean Title Case with acronym preservation.
 */
function formatDescription(value) {
  if (!value) return '';
  const str = String(value).trim().replace(/\s+/g, ' ');
  if (!str) return '';

  return str
    .split(' ')
    .map((w) => {
      const clean = w.toUpperCase().replace(/[^A-Z0-9&]/g, '');
      if (KNOWN_ACRONYMS.has(clean)) {
        return w.toUpperCase();
      }
      return toTitleCase(w);
    })
    .join(' ');
}

/**
 * Formats a sequence number into Lead ID standard format:
 * 'L000001', 'L000002', ..., 'L999999', 'L1000000' (adds digits past 999999)
 */
function formatLeadId(seq) {
  const num = Math.max(1, parseInt(seq, 10) || 1);
  const numStr = String(num);
  return `L${numStr.length >= 6 ? numStr : numStr.padStart(6, '0')}`;
}

function enrichLeadForStorage(lead = {}, options = {}) {
  const companyCode = String(lead.companyCode ?? '').trim().toUpperCase();
  const leadId = formatCode(lead.leadId || options.leadId || '');
  const assignedEmployeePhone = String(lead.assignedEmployeePhone ?? '').trim();
  const leadCompanyName = formatCompanyName(lead.leadCompanyName);
  const contactName = formatPersonName(lead.contactName);
  const contactNumber = String(lead.contactNumber ?? '').trim();
  const setLabel = toTitleCase(lead.setLabel);
  const directorEmailAddress = formatEmail(lead.directorEmailAddress);
  const companyEmail = formatEmail(lead.companyEmail);
  const companyDescription = formatDescription(lead.companyDescription);
  const mainDivisionDescription = formatDescription(lead.mainDivisionDescription);
  const remarks = normalizeRemarks(lead.remarks);

  const cin = formatCode(lead.cin);
  const registrationNumber = formatCode(lead.registrationNumber);
  const directorDin = formatCode(lead.directorDin);
  const roc = formatCode(lead.roc);

  const directorFirstName = formatPersonName(lead.directorFirstName);
  const directorLastName = formatPersonName(lead.directorLastName);
  const directorMobileNumber = String(lead.directorMobileNumber ?? '').trim();

  const city = formatLocation(lead.city);
  const state = formatLocation(lead.state);
  const postalCode = String(lead.postalCode ?? '').trim();
  const addressType = toTitleCase(lead.addressType);
  const streetAddressLine1 = toTitleCase(lead.streetAddressLine1);
  const streetAddressLine2 = toTitleCase(lead.streetAddressLine2);

  const directorPermanentCity = formatLocation(lead.directorPermanentCity);
  const directorPermanentState = formatLocation(lead.directorPermanentState);
  const directorPermanentPincode = String(lead.directorPermanentPincode ?? '').trim();
  const directorPermanentAddressLine1 = toTitleCase(lead.directorPermanentAddressLine1);
  const directorPermanentAddressLine2 = toTitleCase(lead.directorPermanentAddressLine2);

  const directorPresentCity = formatLocation(lead.directorPresentCity);
  const directorPresentState = formatLocation(lead.directorPresentState);
  const directorPresentPincode = String(lead.directorPresentPincode ?? '').trim();
  const directorPresentAddressLine1 = toTitleCase(lead.directorPresentAddressLine1);
  const directorPresentAddressLine2 = toTitleCase(lead.directorPresentAddressLine2);

  const companyType = toTitleCase(lead.companyType);
  const classOfCompany = toTitleCase(lead.classOfCompany);
  const companyCategory = toTitleCase(lead.companyCategory);
  const companySubcategory = toTitleCase(lead.companySubcategory);
  const companyOrigin = toTitleCase(lead.companyOrigin);
  const status = lead.status ? toTitleCase(lead.status) : 'New';

  return {
    ...lead,
    companyCode,
    leadId,
    assignedEmployeePhone,
    leadCompanyName,
    contactName,
    contactNumber,
    status,
    setLabel,
    directorEmailAddress,
    companyEmail,
    companyDescription,
    mainDivisionDescription,
    remarks,
    cin,
    registrationNumber,
    directorDin,
    roc,
    directorFirstName,
    directorLastName,
    directorMobileNumber,
    city,
    state,
    postalCode,
    addressType,
    streetAddressLine1,
    streetAddressLine2,
    directorPermanentCity,
    directorPermanentState,
    directorPermanentPincode,
    directorPermanentAddressLine1,
    directorPermanentAddressLine2,
    directorPresentCity,
    directorPresentState,
    directorPresentPincode,
    directorPresentAddressLine1,
    directorPresentAddressLine2,
    companyType,
    classOfCompany,
    companyCategory,
    companySubcategory,
    companyOrigin,
    contactNumberNormalized: normalizePhone(contactNumber),
    leadCompanyNameLower: normalizeText(leadCompanyName),
    contactNameLower: normalizeText(contactName),
    directorEmailLower: normalizeText(directorEmailAddress),
    setLabelLower: normalizeText(setLabel),
    isArchived: lead.isArchived ?? false,
    importBatchId: options.importBatchId ?? lead.importBatchId ?? null,
    sheetOrder: Number.isFinite(lead.sheetOrder) ? lead.sheetOrder : Number(lead.sheetOrder) || 0,
  };
}

function buildLeadDedupKey(lead = {}) {
  return [
    String(lead.companyCode ?? '').trim().toUpperCase(),
    String(lead.assignedEmployeePhone ?? '').trim(),
    normalizePhone(lead.contactNumber),
    normalizeText(lead.leadCompanyName),
  ].join('__');
}

module.exports = {
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
};
