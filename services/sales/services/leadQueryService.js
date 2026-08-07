// Removed global Lead require
const mongoose = require('mongoose');
const { normalizePhone, normalizeText } = require('./leadNormalization');

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ── Fuzzy search helpers ─────────────────────────────────────────────────────

/**
 * Generate character n-grams from a string.
 * e.g. "INMAZH", 3 → ["INM", "NMA", "MAZ", "AZH"]
 */
function generateNgrams(str, size = 3) {
  const ngrams = new Set();
  for (let i = 0; i <= str.length - size; i++) {
    ngrams.add(str.substring(i, i + size));
  }
  return Array.from(ngrams);
}

/**
 * Jaro-Winkler similarity between two strings (0..1, 1 = identical).
 * Tolerates transpositions and short substitutions.
 */
function jaroWinkler(s1, s2) {
  if (s1 === s2) return 1;
  const len1 = s1.length;
  const len2 = s2.length;
  if (!len1 || !len2) return 0;
  const matchDist = Math.floor(Math.max(len1, len2) / 2) - 1;
  const s1Matches = new Array(len1).fill(false);
  const s2Matches = new Array(len2).fill(false);
  let matches = 0;
  let transpositions = 0;
  for (let i = 0; i < len1; i++) {
    const start = Math.max(0, i - matchDist);
    const end = Math.min(i + matchDist + 1, len2);
    for (let j = start; j < end; j++) {
      if (s2Matches[j] || s1[i] !== s2[j]) continue;
      s1Matches[i] = true;
      s2Matches[j] = true;
      matches++;
      break;
    }
  }
  if (!matches) return 0;
  let k = 0;
  for (let i = 0; i < len1; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }
  const jaro = (matches / len1 + matches / len2 + (matches - transpositions / 2) / matches) / 3;
  const prefix = Math.min(4, [...s1].findIndex((c, i) => c !== s2[i]) < 0 ? Math.min(len1, len2) : [...s1].findIndex((c, i) => c !== s2[i]));
  return jaro + prefix * 0.1 * (1 - jaro);
}

/**
 * Score a candidate string against the query using:
 *  - Jaro-Winkler on the full string
 *  - bonus if the candidate *contains* the query
 *  - bonus for trigram overlap ratio
 */
function fuzzyScore(query, candidate) {
  const q = query.toLowerCase();
  const c = candidate.toLowerCase();
  const jw = jaroWinkler(q, c);
  const containsBonus = c.includes(q) ? 0.2 : 0;
  const qGrams = generateNgrams(q, 3);
  const cGrams = new Set(generateNgrams(c, 3));
  const overlap = qGrams.length ? qGrams.filter(g => cGrams.has(g)).length / qGrams.length : 0;
  return Math.min(1, jw * 0.5 + overlap * 0.4 + containsBonus);
}

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function isPaginatedRequest(query) {
  return query.paginated === 'true' || query.page !== undefined || query.pageSize !== undefined;
}

function parsePagination(query) {
  const page = parsePositiveInt(query.page, 1);
  const pageSize = Math.min(parsePositiveInt(query.pageSize, DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE);

  return {
    isPaginated: isPaginatedRequest(query),
    page,
    pageSize,
    skip: (page - 1) * pageSize,
  };
}

function buildBaseLeadQuery({ companyCode, employeeId, query = {} }) {
  const mongoQuery = {
    companyCode,
    isArchived: { $ne: true },
  };

  if (employeeId) {
    try {
      mongoQuery.assignedEmployeeId = mongoose.Types.ObjectId.isValid(String(employeeId))
        ? new mongoose.Types.ObjectId(String(employeeId))
        : employeeId;
    } catch {
      mongoQuery.assignedEmployeeId = employeeId;
    }
  }

  const setLabel = normalizeText(query.setLabel);
  if (setLabel) {
    mongoQuery.$and = mongoQuery.$and || [];
    mongoQuery.$and.push({
      $or: [
        { setLabelLower: setLabel },
        { setLabel: String(query.setLabel ?? '').trim() },
      ],
    });
  }

  const division = String(query.division ?? query.mainDivisionDescription ?? '').trim();
  if (division) {
    mongoQuery.mainDivisionDescription = new RegExp(`^${escapeRegex(division)}$`, 'i');
  }

  const statuses = String(query.statuses ?? '')
    .split(',')
    .map((status) => status.trim())
    .filter(Boolean);
  const status = String(query.status ?? '').trim();
  if (statuses.length) {
    mongoQuery.status = { $in: statuses };
  } else if (status) {
    mongoQuery.status = status;
  }

  if (String(query.isFavourite ?? '').trim() === 'true') {
    mongoQuery.isFavourite = true;
  }

  const updatedFrom = String(query.updatedFrom ?? '').trim();
  const updatedTo = String(query.updatedTo ?? '').trim();
  if (updatedFrom || updatedTo) {
    mongoQuery.updatedAt = {};
    if (updatedFrom) mongoQuery.updatedAt.$gte = new Date(updatedFrom);
    if (updatedTo) mongoQuery.updatedAt.$lt = new Date(updatedTo);
  }

  const company = normalizeText(query.company);
  if (company) {
    mongoQuery.$and = mongoQuery.$and || [];
    mongoQuery.$and.push({
      $or: [
        { leadCompanyNameLower: company },
        { leadCompanyName: new RegExp(`^${escapeRegex(String(query.company ?? '').trim())}$`, 'i') },
      ],
    });
  }

  return mongoQuery;
}

function buildLeadSearchQuery({ companyCode, employeeId, query = {} }) {
  const mongoQuery = buildBaseLeadQuery({ companyCode, employeeId, query });
  const search = String(query.search ?? query.remark ?? '').trim();
  const searchMode = String(query.searchMode ?? '').trim().toLowerCase();
  const normalizedSearch = normalizeText(search);
  const normalizedPhone = normalizePhone(search);

  let projection = null;
  let sort = buildLeadSort(query.sort);

  if (!search) {
    return {
      mongoQuery,
      projection,
      searchStrategy: 'none',
      sort,
    };
  }

  const isPhoneSearch = searchMode === 'phone' || (/^\+?[\d\s()-]+$/.test(search) && normalizedPhone.length >= 7);

  if (isPhoneSearch) {
    mongoQuery.contactNumberNormalized = normalizedPhone;
    return {
      mongoQuery,
      projection,
      searchStrategy: 'phone',
      sort,
    };
  }

  if (searchMode === 'quick' && normalizedSearch) {
    const prefixRegex = new RegExp(`^${escapeRegex(normalizedSearch)}`);
    const quickClauses = [
      { leadCompanyNameLower: prefixRegex },
      { contactNameLower: prefixRegex },
      { directorEmailLower: prefixRegex },
      { setLabelLower: prefixRegex },
      { status: search },
    ];

    if (normalizedPhone.length >= 3) {
      quickClauses.unshift({ contactNumberNormalized: new RegExp(`^${escapeRegex(normalizedPhone)}`) });
    }

    mongoQuery.$or = quickClauses;
    return {
      mongoQuery,
      projection,
      searchStrategy: 'quick_prefix',
      sort,
    };
  }

  // Use regex contains search for all string searches >= 3 chars.
  // MongoDB $text full-text search only matches whole word tokens (e.g. "INMA" won't match "INMAZH"),
  // so we use a case-insensitive substring regex on the normalized lowercase fields instead.
  const containsRegex = new RegExp(escapeRegex(normalizedSearch));
  const rawContainsRegex = new RegExp(escapeRegex(search), 'i');
  mongoQuery.$or = [
    { leadCompanyNameLower: containsRegex },
    { leadCompanyName: rawContainsRegex },
    { contactNameLower: containsRegex },
    { contactName: rawContainsRegex },
    { directorEmailLower: containsRegex },
    { directorEmailAddress: rawContainsRegex },
    { setLabelLower: containsRegex },
    { setLabel: rawContainsRegex },
    { status: rawContainsRegex },
  ];

  if (normalizedPhone.length >= 4) {
    mongoQuery.$or.unshift({ contactNumberNormalized: new RegExp(escapeRegex(normalizedPhone)) });
  }

  return {
    mongoQuery,
    projection,
    searchStrategy: 'contains',
    sort,
  };
}

function buildLeadSort(sortKey) {
  const sortMap = {
    createdAt_desc: { createdAt: -1, _id: -1 },
    createdAt_asc: { createdAt: 1, _id: 1 },
    updatedAt_desc: { updatedAt: -1, _id: -1 },
    company_asc: { leadCompanyNameLower: 1, sheetOrder: 1, _id: 1 },
    sheetOrder_asc: { sheetOrder: 1, createdAt: 1, _id: 1 },
  };

  return sortMap[sortKey] || sortMap.sheetOrder_asc;
}

async function getLeadDivisions({ LeadModel, companyCode, employeeId, query = {} }) {
  const mongoQuery = buildBaseLeadQuery({ companyCode, employeeId, query });
  const rows = await LeadModel.aggregate([
    { $match: mongoQuery },
    { $match: { mainDivisionDescription: { $nin: ['', null] } } },
    { $group: { _id: '$mainDivisionDescription', count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);

  return {
    divisions: rows.map((row) => row._id).filter(Boolean),
    items: rows.map((row) => ({ label: row._id, count: row.count })),
  };
}

async function getLeadSets({ LeadModel, companyCode, employeeId, query = {} }) {
  const mongoQuery = buildBaseLeadQuery({ companyCode, employeeId, query });
  const rows = await LeadModel.aggregate([
    { $match: mongoQuery },
    { $match: { setLabelLower: { $ne: '' } } },
    { $group: { _id: '$setLabel', count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);

  return {
    sets: rows.map((row) => row._id).filter(Boolean),
    items: rows.map((row) => ({ label: row._id, count: row.count })),
  };
}

async function getLeadCompanies({ LeadModel, companyCode, employeeId, query = {} }) {
  const { mongoQuery } = buildLeadSearchQuery({ companyCode, employeeId, query });
  const pagination = parsePagination(query);
  const pipeline = [
    { $match: mongoQuery },
    { $match: { leadCompanyNameLower: { $ne: '' } } },
    {
      $group: {
        _id: '$leadCompanyName',
        count: { $sum: 1 },
        minSheetOrder: { $min: '$sheetOrder' },
      },
    },
    { $sort: { minSheetOrder: 1, _id: 1 } },
  ];

  const [totalRows, rows] = await Promise.all([
    LeadModel.aggregate([...pipeline, { $count: 'total' }]),
    LeadModel.aggregate([
      ...pipeline,
      ...(pagination.isPaginated ? [{ $skip: pagination.skip }, { $limit: pagination.pageSize }] : []),
    ]),
  ]);

  const total = totalRows[0]?.total || rows.length;
  const companies = rows.map((row) => ({ name: row._id, count: row.count }));
  const names = rows.map((row) => row._id).filter(Boolean);
  let contactsByCompany = {};

  if (query.includeContacts === 'true' && names.length) {
    const contactPageSize = Math.min(parsePositiveInt(query.contactPageSize, pagination.pageSize), MAX_PAGE_SIZE);
    const baseSecurityQuery = buildBaseLeadQuery({ companyCode, employeeId, query: {} });
    const contacts = await LeadModel.find({
      ...baseSecurityQuery,
      leadCompanyName: { $in: names },
    })
      .sort({ sheetOrder: 1, createdAt: 1, _id: 1 })
      .lean();

    contactsByCompany = contacts.reduce((grouped, lead) => {
      const companyName = lead.leadCompanyName;
      if (!companyName || !names.includes(companyName)) return grouped;
      grouped[companyName] = grouped[companyName] || [];
      if (grouped[companyName].length < contactPageSize) {
        grouped[companyName].push(lead);
      }
      return grouped;
    }, {});
  }

  return {
    companies,
    names,
    contactsByCompany,
    page: pagination.page,
    pageSize: pagination.pageSize,
    total,
    hasMore: pagination.isPaginated ? pagination.page * pagination.pageSize < total : false,
    fuzzy: false,
  };
}

/**
 * Fuzzy search fallback: when a strict search yields 0 results, retrieve candidates
 * via trigram regex matching then rank by Jaro-Winkler similarity.
 */
async function fuzzySearchLeads({ LeadModel, baseQuery, search, limit = 50, threshold = 0.55 }) {
  if (!search || search.length < 4) return [];
  const normalized = search.toLowerCase();
  const ngrams = generateNgrams(normalized, 3);
  if (!ngrams.length) return [];

  // Build an $or that matches any trigram against the normalized company name field
  const trigramOr = ngrams.map(gram => ({ leadCompanyNameLower: new RegExp(escapeRegex(gram)) }));
  const candidateQuery = { ...baseQuery, $or: trigramOr };
  delete candidateQuery.$and; // keep companyCode / employeeId filters but not prior $or/$and

  const candidates = await LeadModel.find(
    { companyCode: baseQuery.companyCode, assignedEmployeeId: baseQuery.assignedEmployeeId, isArchived: { $ne: true }, $or: trigramOr },
    { leadCompanyName: 1, leadCompanyNameLower: 1, contactName: 1, sheetOrder: 1 },
  ).limit(500).lean();

  // Group by company name, pick best score per company
  const companyScores = new Map();
  for (const lead of candidates) {
    const name = lead.leadCompanyName || '';
    if (!name) continue;
    const score = fuzzyScore(normalized, name);
    if (score < threshold) continue;
    if (!companyScores.has(name) || companyScores.get(name).score < score) {
      companyScores.set(name, { name, score, sheetOrder: lead.sheetOrder });
    }
  }

  return Array.from(companyScores.values())
    .sort((a, b) => b.score - a.score || a.sheetOrder - b.sheetOrder)
    .slice(0, limit)
    .map(r => ({ name: r.name, score: r.score }));
}

module.exports = {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  buildLeadSearchQuery,
  buildLeadSort,
  getLeadDivisions,
  getLeadCompanies,
  getLeadSets,
  fuzzySearchLeads,
  isPaginatedRequest,
  parsePagination,
};
