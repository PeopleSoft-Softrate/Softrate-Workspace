/**
 * Utility functions for cleaning company names and formatting document file names
 * for Invoices, Quotations, and Proposals.
 */

/**
 * Strips legal entity suffixes from company names:
 * e.g., "(OPC) PRIVATE LIMITED", "PRIVATE LIMITED", "PVT LTD", "LLP", "LIMITED", "INC", etc.
 */
export function cleanLegalCompanyName(rawName?: string): string {
  if (!rawName) return '';
  let name = String(rawName).trim();
  if (!name) return '';

  // Remove leading/trailing quotes
  name = name.replace(/^["'`]+|["'`]+$/g, '').trim();

  const legalSuffixRegexes = [
    /\s*[\(\[]?\s*opc\s*[\)\]]?\s*(pvt\.?|private)\s*(ltd\.?|limited)\.?$/i,
    /\s*[\(\[]?\s*opc\s*[\)\]]?\s*(ltd\.?|limited)\.?$/i,
    /\s*[\(\[]\s*opc\s*[\)\]]\.?$/i,
    /\s*\bopc\b\.?$/i,
    /\s*(pvt\.?|private)\s*(ltd\.?|limited)\.?$/i,
    /\s*(pub\.?|public)\s*(ltd\.?|limited)\.?$/i,
    /\s*pvt\.?\s*ltd\.?$/i,
    /\s*private\s+limited\.?$/i,
    /\s*limited\s+liability\s+partnership\.?$/i,
    /\s*l\.?l\.?p\.?$/i,
    /\s*ltd\.?$/i,
    /\s*limited\.?$/i,
    /\s*inc\.?$/i,
    /\s*incorporated\.?$/i,
    /\s*corp\.?$/i,
    /\s*corporation\.?$/i,
    /\s*l\.?l\.?c\.?$/i,
    /\s*p\.?l\.?c\.?$/i,
    /\s*co\.?$/i,
    /\s*company\.?$/i,
  ];

  let previous = '';
  while (previous !== name) {
    previous = name;
    for (const rx of legalSuffixRegexes) {
      if (rx.test(name)) {
        name = name.replace(rx, '').trim();
        name = name.replace(/[\s,\.\-_()\[\]]+$/, '').trim();
      }
    }
  }

  name = name.replace(/\s+/g, ' ').trim();
  return name || String(rawName).trim();
}

/**
 * Formats the document name for Invoice, Quotation, or Proposal.
 * E.g.:
 * - Invoice: "Invoice - Acme"
 * - Quotation: "Quotation - Acme"
 * - Proposal: "Website Development Proposal - Acme" (or "Proposal - Acme")
 */
export function formatDocumentTitle(
  docType: 'Invoice' | 'Quotation' | 'Proposal',
  rawCompanyName?: string,
  templateName?: string
): string {
  const cleanCompany = cleanLegalCompanyName(rawCompanyName);

  let prefix = '';
  if (docType === 'Proposal') {
    const tName = (templateName || '').trim();
    if (tName) {
      prefix = /proposal/i.test(tName) ? tName : `${tName} Proposal`;
    } else {
      prefix = 'Proposal';
    }
  } else if (docType === 'Quotation') {
    prefix = 'Quotation';
  } else {
    prefix = 'Invoice';
  }

  if (cleanCompany) {
    return `${prefix} - ${cleanCompany}`;
  }
  return prefix;
}
