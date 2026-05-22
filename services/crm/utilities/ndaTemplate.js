const A4 = {
  portrait: { width: 595.28, height: 841.89 },
  landscape: { width: 841.89, height: 595.28 },
};

const NDA_PLACEHOLDERS = [
  { key: 'companyName', label: 'Company Name' },
  { key: 'companyAddress', label: 'Company Address' },
  { key: 'companyEmail', label: 'Company Email' },
  { key: 'companyPhone', label: 'Company Phone' },
  { key: 'clientName', label: 'Client Name' },
  { key: 'clientCompanyName', label: 'Client Company Name' },
  { key: 'clientAddress', label: 'Client Address' },
  { key: 'clientEmail', label: 'Client Email' },
  { key: 'effectiveDate', label: 'Effective Date' },
  { key: 'expiryDate', label: 'Expiry Date' },
  { key: 'projectName', label: 'Project Name' },
  { key: 'projectDescription', label: 'Service Description' },
  { key: 'jurisdiction', label: 'Jurisdiction' },
  { key: 'solicitationPeriod', label: 'Solicitation Period' },
  { key: 'validityPeriod', label: 'Validity Period' },
  { key: 'terminationNoticeDays', label: 'Termination Notice' },
  { key: 'noticeReceiptDays', label: 'Notice Receipt Days' },
  { key: 'signatoryName', label: 'Authorized Signatory' },
  { key: 'signatoryTitle', label: 'Signatory Title' },
  { key: 'clientSignatoryTitle', label: 'Client Signatory Title' },
  { key: 'companySignature', label: 'Company Signature Text' },
  { key: 'clientSignature', label: 'Client Signature Text' },
  { key: 'todayDate', label: 'Current Date' },
];

const DEFAULT_HEADER = {
  enabled: true,
  companyTitle: 'SOFTRATE TECHNOLOGIES (P) LTD',
  addressLine: 'SOFTRATE TECH PARK, MANGADU, CHENNAI, INDIA, 600 122',
  contactLine: '(+91) 8148633580  |  helpdesk@softrateglobal.com',
};

const DEFAULT_BLOCKS = [
  { type: 'title', text: 'Non-Disclosure Agreement (NDA)' },
  {
    type: 'body',
    text: 'This agreement is entered into and effective as of the last date signed by the Parties (the "effective date") between {{companyName}}, a company having its principal place of business at {{companyAddress}} ("Party A"), and {{clientCompanyName}}, having its principal place of business at {{clientAddress}} ("Party B").',
  },
  {
    type: 'body',
    text: '(The capitalized terms used in this agreement, in addition to those above, are defined in section "DEFINITIONS".)',
  },
  { type: 'heading', text: 'Exchange of Information' },
  {
    type: 'body',
    text: 'The parties agree to exchange Confidential Information for the purpose of evaluating, discussing, and performing {{projectName}}, including but not limited to {{projectDescription}} (the "Purpose"), in accordance with this Agreement.',
  },
  { type: 'heading', text: 'Confidential Information' },
  {
    type: 'body',
    text: '"Confidential Information" means all material, non-public, business, technical, financial, operational, proprietary, or other information, whether written, oral, electronic, visual, or in any other form, whether or not marked as confidential, that is disclosed or made available by one party to the other party, directly or indirectly, through any means of communication or observation.',
  },
  { type: 'heading', text: 'Non-Confidential Information' },
  { type: 'subheading', text: 'Excluded Information' },
  {
    type: 'body',
    text: 'The restrictions of this agreement on the use and disclosure of Confidential Information will not apply to information that, without the breach of this agreement',
  },
  { type: 'bullet', text: 'is already known to the receiving party prior to disclosure,' },
  { type: 'bullet', text: 'is or becomes publicly available through no fault of the receiving party,' },
  { type: 'bullet', text: 'is lawfully obtained by the receiving party from a third party without any obligation of confidentiality, or' },
  { type: 'bullet', text: 'is independently developed by the receiving party without use of or reference to the Confidential Information.' },
  { type: 'subheading', text: 'Burden of Proof' },
  { type: 'body', text: 'The receiving party shall bear the burden of proving that any information falls within the exclusions stated above.' },
  { type: 'subheading', text: 'Marking' },
  { type: 'body', text: 'Information is not required to be specifically marked as "Confidential" to qualify as Confidential Information under this Agreement.' },
  { type: 'heading', text: 'Confidentiality Obligation' },
  { type: 'body', text: 'The receiving party shall maintain all Confidential Information in strict confidence and shall protect such information from unauthorized access, use, or disclosure.' },
  { type: 'subheading', text: 'Limitation on Use' },
  { type: 'body', text: 'The receiving party may use the Confidential Information solely for the Purpose defined in this Agreement and in accordance with its terms and conditions.' },
  { type: 'subheading', text: 'Non-Disclosure' },
  { type: 'body', text: 'The receiving party shall not disclose any Confidential Information to any third party without the prior written consent of the disclosing party, except as expressly permitted under this Agreement.' },
  { type: 'subheading', text: 'Non-Disclosure of Discussions' },
  { type: 'body', text: 'Neither party shall, without prior written consent from the other party, disclose that:' },
  { type: 'bullet', text: 'any discussions, negotiations, or business relationships have taken place or are taking place between the parties, or' },
  { type: 'bullet', text: 'any Confidential Information has been or may be exchanged between the parties.' },
  { type: 'subheading', text: 'Standard of Care' },
  { type: 'body', text: 'The receiving party shall exercise reasonable care, and at least the same degree of care it uses to protect its own confidential information, to safeguard Confidential Information against unauthorized use, access, loss, or disclosure.' },
  { type: 'subheading', text: 'Notification of Disclosure' },
  { type: 'body', text: 'The receiving party shall promptly notify the disclosing party in writing upon becoming aware of any unauthorized access, use, loss, or disclosure of Confidential Information and shall reasonably cooperate in minimizing any resulting impact.' },
  { type: 'heading', text: 'Ownership, Return, and Destruction of Confidential Information' },
  { type: 'subheading', text: 'Ownership' },
  { type: 'body', text: 'All Confidential Information disclosed or exchanged under this Agreement shall remain the exclusive property of the disclosing party. Nothing in this Agreement shall transfer ownership rights, title, or interest in any Confidential Information to the receiving party.' },
  { type: 'subheading', text: 'Return or Destruction Obligation' },
  { type: 'body', text: 'Upon expiration or termination of this Agreement, or upon written request by the disclosing party, the receiving party shall promptly:' },
  { type: 'bullet', text: 'return all Confidential Information received from the disclosing party;' },
  { type: 'bullet', text: 'destroy all copies, reproductions, or records of such Confidential Information in its possession or control; and' },
  { type: 'bullet', text: 'upon request, provide written confirmation of such return or destruction.' },
  { type: 'subheading', text: 'Archive Exception' },
  { type: 'body', text: 'The receiving party may retain copies of Confidential Information solely to comply with legal, regulatory, or internal archival requirements.' },
  { type: 'body', text: 'Any retained Confidential Information shall continue to remain subject to all confidentiality obligations under this Agreement.' },
  { type: 'heading', text: 'Required Disclosure' },
  { type: 'subheading', text: 'Notification of Disclosure' },
  { type: 'body', text: 'The receiving party may disclose Confidential Information where required by applicable law, regulation, or court order, provided that the receiving party:' },
  { type: 'bullet', text: 'promptly notifies the disclosing party in writing, where legally permitted, and' },
  { type: 'bullet', text: 'reasonably cooperates with the disclosing party in seeking a protective order or other appropriate remedy.' },
  { type: 'subheading', text: 'Limited Disclosure' },
  { type: 'body', text: 'Where disclosure is legally required, the receiving party shall disclose only the minimum portion of Confidential Information necessary to comply with such requirement.' },
  { type: 'heading', text: 'Mutual Non-Solicitation' },
  { type: 'subheading', text: 'Non-Solicitation of Employees and Customers' },
  { type: 'body', text: 'During the period starting on the Effective Date and ending {{solicitationPeriod}} after the termination or expiration of this Agreement (the "Non-Solicitation Period"), neither party shall directly or indirectly, on its own behalf or on behalf of others, induce or attempt to induce any employee directly involved in the services or business relationship under this Agreement to leave the employment of the other party.' },
  { type: 'subheading', text: 'Permitted Hirings and Business' },
  { type: 'body', text: "Voluntary Contacts. Each party may employ or accept the business of the other party's officers, directors or employees who contact the party on their own initiative without any direct or indirect solicitation or encouragement by the party.", boldLead: true },
  { type: 'body', text: 'General Recruitment. Each party may recruit through general advertisements, public job postings, recruitment agencies, or other recruitment methods not specifically directed at employees of the other party.', boldLead: true },
  { type: 'body', text: 'Former Employees. Each party may employ individuals whose employment with the other party has already terminated.', boldLead: true },
  { type: 'heading', text: 'Project Communication Guidelines' },
  { type: 'subheading', text: 'Service Communication Scope' },
  { type: 'body', text: 'The parties acknowledge that employees, developers, consultants, and representatives involved in the project may communicate directly regarding technical matters, project requirements, implementation, testing, support, and other activities necessary for the performance of services under this Agreement.' },
  { type: 'subheading', text: 'Business and Commercial Discussions' },
  { type: 'body', text: 'Any discussions relating to pricing, payments, contractual terms, scope modifications, commercial arrangements, or business decisions concerning the services under this Agreement shall be conducted through authorized representatives designated by the respective parties.' },
  { type: 'heading', text: 'No Modification of Confidential Information' },
  { type: 'body', text: 'The receiving party shall not copy, decompile, reverse engineer, modify, reproduce, distribute, or create derivative works from any Confidential Information, software, source code, designs, or proprietary materials without prior written consent from the disclosing party.' },
  { type: 'heading', text: 'Permitted Disclosure' },
  { type: 'body', text: 'The receiving party may disclose Confidential Information' },
  { type: 'bullet', text: 'if and to the extent that the disclosing party consents in writing to such disclosure, or' },
  { type: 'bullet', text: "to the receiving party's employees, officers, contractors, consultants, legal advisors, or representatives who" },
  { type: 'bullet', text: 'require access to such information for purposes related to this Agreement,' },
  { type: 'bullet', text: 'have been informed of the confidentiality obligations of this agreement, and' },
  { type: 'bullet', text: 'agree to abide by and be bound by the provisions of this agreement.' },
  { type: 'heading', text: 'Term of Confidentiality' },
  { type: 'subheading', text: 'Trade Secrets' },
  { type: 'body', text: 'In connection with Confidential Information that constitutes a trade secret, confidentiality obligations shall continue for so long as such information remains a trade secret under applicable law.' },
  { type: 'subheading', text: 'Other Confidential Information' },
  { type: 'body', text: 'With respect to all other Confidential Information, the confidentiality obligations under this Agreement shall commence on the Effective Date and shall continue for a period of {{validityPeriod}} following termination or expiration of this Agreement.' },
  { type: 'heading', text: 'Mutual Representations' },
  { type: 'subheading', text: 'Authority and Capacity' },
  { type: 'body', text: 'Each party represents that it has the authority and legal capacity to enter into this Agreement.' },
  { type: 'subheading', text: 'Execution and Delivery' },
  { type: 'body', text: 'Each party represents that this Agreement has been duly executed and delivered.' },
  { type: 'subheading', text: 'Enforceability' },
  { type: 'body', text: 'This agreement constitutes a legal, valid, and binding obligation, enforceable against each party in accordance with its terms.' },
  { type: 'subheading', text: 'No Conflicts' },
  { type: 'body', text: 'Each party represents that entering into and performing obligations under this Agreement will not violate any other agreement, obligation, or legal restriction applicable to that party.' },
  { type: 'heading', text: 'No Warranty' },
  { type: 'body', text: 'The disclosing party makes no representation or warranty, express or implied, regarding the accuracy, completeness, or suitability of the Confidential Information disclosed under this Agreement.' },
  { type: 'heading', text: 'No License Right' },
  { type: 'body', text: 'No express or implied license, ownership right, or other interest in any intellectual property, software, source code, trademarks, designs, or proprietary materials is granted under this Agreement, except as expressly authorized herein.' },
  { type: 'heading', text: 'No Other Obligations' },
  { type: 'body', text: 'Nothing contained in this Agreement shall obligate either party to purchase, provide, or enter into any additional products, services, business relationship, or agreement.' },
  { type: 'heading', text: 'Independent Development' },
  { type: 'body', text: 'The parties acknowledge that either party may independently develop or acquire products, services, software, ideas, concepts, systems, or information that may be similar to or competitive with the Confidential Information disclosed under this Agreement, provided that such development does not involve the unauthorized use of Confidential Information.' },
  { type: 'heading', text: 'Termination on Notice' },
  { type: 'body', text: 'Either party may terminate this Agreement by providing {{terminationNoticeDays}} Business Days prior written notice to the other party.' },
  { type: 'heading', text: 'Indemnification' },
  { type: 'subheading', text: 'Indemnification Obligation' },
  { type: 'body', text: 'The receiving party shall indemnify and hold harmless the disclosing party against losses, damages, claims, liabilities, or expenses arising from:' },
  { type: 'bullet', text: 'unauthorized or improper use or disclosure of any Confidential Information,' },
  { type: 'bullet', text: 'breach of its obligations under this Agreement, or' },
  { type: 'bullet', text: 'negligence, misconduct, or unlawful actions by the receiving party or its representatives.' },
  { type: 'subheading', text: 'Notice and Failure to Notify' },
  { type: 'body', text: 'Notice Requirement. Before bringing a claim for indemnification, the indemnified party shall notify the indemnifying party of the indemnifiable proceeding, and deliver to the indemnifying party all legal pleadings and other documents reasonably necessary to indemnify or defend the indemnifiable proceeding.', boldLead: true },
  { type: 'body', text: "Failure to Notify. If the indemnified party fails to notify the indemnifying party of the indemnifiable proceeding, the indemnifying will be relieved of its indemnification obligations to the extent it was prejudiced by the indemnified party's failure.", boldLead: true },
  { type: 'subheading', text: 'Exclusive Remedy' },
  { type: 'body', text: 'The parties right to indemnification is the exclusive remedy available in connection with the indemnifiable proceedings described in this section "INDEMNIFICATION".' },
  { type: 'heading', text: 'Equitable Relief' },
  { type: 'subheading', text: 'Acknowledgment of Irreparable Harm' },
  { type: 'body', text: 'Each party acknowledges that their breach or threatened breach of their obligations under sections "CONFIDENTIALITY", and "NON-SOLICITATION" would result in irreparable harm to the other party that cannot be adequately relieved by money damages alone.' },
  { type: 'subheading', text: 'Intent to Allow for Equitable Remedies' },
  { type: 'body', text: 'Accordingly, the parties hereby acknowledge their mutual intent that after any breach of the obligations listed in the paragraph directly above, the non-breaching party may request any applicable equitable remedies from a court, including injunctive relief, without the need for that party to post any security.' },
  { type: 'heading', text: 'Definitions' },
  { type: 'body', text: '"Affiliates" means with respect to each party, any other person that, directly or indirectly, controls, or is controlled by, or is under common control with, such party.' },
  { type: 'body', text: '"Business Day" means a day other than a Saturday, Sunday, or public holiday in {{jurisdiction}}.' },
  { type: 'body', text: '"Confidential Information" is defined in section "CONFIDENTIAL INFORMATION".' },
  { type: 'body', text: '"Governmental Authority" means any federal, state, local, or foreign government, any agency or instrumentality of any such government or political subdivision, any self-regulated organization or other non-governmental regulatory authority or quasi-governmental authority, and any arbitrator, court or tribunal of competent jurisdiction.' },
  { type: 'body', text: '"Intellectual Property" means all intellectual and proprietary rights, including trademarks, service marks, copyrights, trade secrets, patents, software, source code, designs, logos, websites, domain names, documentation, and all related rights and protections.' },
  { type: 'body', text: '"Law" means any law, statute, by-law, rule, regulation, order, ordinance, treaty, decree, judgment, official directive, protocol, code, guideline, notice, approval, order, policy, or other requirement of any Governmental Authority having the force of law.' },
  { type: 'body', text: '"Non-Solicitation Period" is defined in section "NON-SOLICITATION".' },
  { type: 'body', text: '"Person" includes any corporation, company, limited liability company, partnership, Governmental Authority, joint venture, fund, trust, association, syndicate, organization, other entity or group of persons, and any individual.' },
  { type: 'body', text: '"Purpose" is defined in section "PURPOSE".' },
  { type: 'body', text: '"Representative" means a party directors, officers, employees, contractors, consultants, legal advisors, agents, and other authorized representatives who require access to Confidential Information for purposes related to this Agreement.' },
  { type: 'heading', text: 'Entire Agreement' },
  { type: 'body', text: 'This Agreement constitutes the complete understanding between the parties with respect to its subject matter and supersedes all prior or contemporaneous discussions, communications, understandings, and agreements, whether written or oral.' },
  { type: 'heading', text: 'Counterparts' },
  { type: 'body', text: 'This Agreement may be executed in counterparts, each of which shall be deemed an original, and all counterparts together shall constitute one and the same Agreement.' },
  { type: 'heading', text: 'Amendment' },
  { type: 'body', text: 'This Agreement can be amended only through a written document signed by both parties.' },
  { type: 'heading', text: 'Notices' },
  { type: 'body', text: 'Method of Notice. The parties shall give all notices and communications between the parties in writing by personal delivery, registered or certified mail, recognized courier service, or electronic mail to the party address specified in this agreement, or to the address that a party has notified to be that party address for the purposes of this section.', boldLead: true },
  { type: 'body', text: 'Receipt of Notice. A notice given under this agreement will be effective on the other party receipt of it, or if mailed, on the {{noticeReceiptDays}} Business Day after mailing.', boldLead: true },
  { type: 'heading', text: 'Assignment' },
  { type: 'body', text: 'Neither party may assign this agreement or any of their rights or obligations under this agreement without the other party written consent.' },
  { type: 'heading', text: 'Governing Law' },
  { type: 'body', text: 'This agreement shall be governed, construed, and enforced in accordance with the laws of India, without regard to its conflict of laws rules.' },
  { type: 'heading', text: 'Waiver' },
  { type: 'body', text: 'The failure or neglect by a party to enforce any of its rights under this agreement will not be deemed to be a waiver of that party rights.' },
  { type: 'heading', text: 'Severability' },
  { type: 'body', text: 'If any part of this agreement is declared unenforceable or invalid, the remainder will continue to be valid and enforceable.' },
  { type: 'heading', text: 'Headings' },
  { type: 'body', text: 'The section headings contained in this agreement are for reference purposes only and shall not affect the meaning or interpretation of this agreement.' },
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function blocksToClauses(blocks = []) {
  const clauses = [];
  let current = null;
  let activeHeading = '';

  const startClause = (clause) => {
    current = {
      id: clause.id || `nda-clause-${clauses.length + 1}`,
      type: clause.type || 'clause',
      heading: normalizeText(clause.heading),
      subheading: normalizeText(clause.subheading),
      content: '',
      enabled: true,
    };
    clauses.push(current);
  };

  blocks.forEach((block) => {
    if (block.type === 'title') {
      activeHeading = '';
      startClause({ type: 'title', heading: block.text });
      return;
    }

    if (block.type === 'heading') {
      activeHeading = block.text;
      current = null;
      return;
    }

    if (block.type === 'subheading') {
      startClause({ heading: activeHeading, subheading: block.text });
      return;
    }

    if (block.type === 'body' || block.type === 'bullet') {
      if (!current) startClause({ heading: activeHeading });
      const line = block.type === 'bullet' ? `- ${block.text}` : block.text;
      current.content = [current.content, line].filter(Boolean).join('\n');
    }
  });

  return clauses;
}

const DEFAULT_NDA_CLAUSES = blocksToClauses(DEFAULT_BLOCKS);

function normalizeClause(clause = {}, index = 0) {
  return {
    id: String(clause.id || `nda-clause-${Date.now()}-${index}`),
    type: clause.type === 'title' ? 'title' : 'clause',
    heading: normalizeText(clause.heading || clause.title || (clause.type === 'title' ? 'Non-Disclosure Agreement (NDA)' : 'New Clause')),
    subheading: normalizeText(clause.subheading || clause.subHeading),
    content: String(clause.content || clause.body || '').trim(),
    enabled: clause.enabled !== false,
  };
}

function normalizeClauses(clauses = DEFAULT_NDA_CLAUSES) {
  const source = Array.isArray(clauses) ? clauses : DEFAULT_NDA_CLAUSES;
  return source.map(normalizeClause).filter((clause) => clause.heading || clause.content);
}

function contentLinesToBlocks(content) {
  return String(content || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      if (/^[-•]\s+/.test(line)) {
        return { type: 'bullet', text: line.replace(/^[-•]\s+/, '') };
      }
      return { type: 'body', text: line };
    });
}

function blocksFromClauses(clauses = []) {
  const blocks = [];
  let lastHeading = '';
  let sectionNumber = 0;
  let subSectionNumber = 0;

  normalizeClauses(clauses)
    .forEach((clause, index) => {
      if (clause.enabled === false) return;

      const heading = normalizeText(clause.heading);
      const subheading = normalizeText(clause.subheading);
      const source = {
        sourceClauseId: clause.id,
        sourceClauseIndex: index,
      };

      if (clause.type === 'title') {
        blocks.push({ type: 'title', text: heading || 'Non-Disclosure Agreement (NDA)', ...source });
        blocks.push(...contentLinesToBlocks(clause.content).map((block) => ({ ...block, ...source })));
        lastHeading = '';
        return;
      }

      if (heading && heading !== lastHeading) {
        sectionNumber += 1;
        subSectionNumber = 0;
        blocks.push({ type: 'heading', text: `${sectionNumber}. ${heading}`, rawText: heading, numberLabel: `${sectionNumber}`, ...source });
        lastHeading = heading;
      }

      if (subheading) {
        subSectionNumber += 1;
        const numberLabel = sectionNumber ? `${sectionNumber}.${subSectionNumber}` : `${subSectionNumber}`;
        blocks.push({ type: 'subheading', text: `${numberLabel} ${subheading}`, rawText: subheading, numberLabel, ...source });
      }

      blocks.push(...contentLinesToBlocks(clause.content).map((block) => ({ ...block, ...source })));
    });

  return blocks;
}

function styleForBlock(block) {
  const base = {
    id: `nda-${Math.random().toString(36).slice(2, 10)}`,
    text: block.text,
    sourceClauseId: block.sourceClauseId || '',
    sourceClauseIndex: Number.isInteger(block.sourceClauseIndex) ? block.sourceClauseIndex : null,
    x: 54,
    y: 140,
    width: 487,
    fontSize: 10,
    fontFamily: 'Times-Roman',
    alignment: block.type === 'body' || block.type === 'bullet' ? 'justify' : 'left',
    letterSpacing: 0,
    lineHeight: 1.3,
    isBold: false,
    isItalic: false,
    color: '#111111',
    isCollapsed: true,
    highlightPlaceholders: /\{\{[^}]+\}\}/.test(block.text),
    placeholderHighlightColor: '#fff3a3',
  };

  if (block.type === 'title') {
    return { ...base, fontSize: 18, alignment: 'center', isBold: true, lineHeight: 1.2 };
  }
  if (block.type === 'heading') {
    return { ...base, fontSize: 11.5, isBold: true, lineHeight: 1.2 };
  }
  if (block.type === 'subheading') {
    return { ...base, fontSize: 10.5, isBold: true, lineHeight: 1.2 };
  }
  if (block.type === 'bullet') {
    return { ...base, x: 70, width: 471, text: `- ${block.text}` };
  }
  if (block.boldLead) {
    return { ...base, isBold: false };
  }
  return base;
}

function estimateHeight(paragraph) {
  const charsPerLine = Math.max(30, Math.floor((paragraph.width || 487) / ((paragraph.fontSize || 10) * 0.47)));
  const lineCount = Math.max(1, Math.ceil(String(paragraph.text || '').length / charsPerLine));
  return Math.ceil(lineCount * (paragraph.fontSize || 10) * (paragraph.lineHeight || 1.3)) + 7;
}

function newPage(index = 0) {
  return {
    showHeader: index === 0,
    backgroundUrl: '',
    placeholders: [],
    highlightedAreas: [],
    paragraphs: [],
  };
}

function paginateBlocks(blocks) {
  const pages = [newPage(0)];
  const pageHeight = A4.portrait.height;
  const firstPageTop = 132;
  const continuationTop = 84;
  const bottom = 64;
  const gap = 5;
  let y = firstPageTop;

  const addPage = () => {
    pages.push(newPage(pages.length));
    y = pages[pages.length - 1].showHeader ? firstPageTop : continuationTop;
  };

  blocks.forEach((block) => {
    const paragraph = styleForBlock(block);
    const height = estimateHeight(paragraph);
    if (y + height > pageHeight - bottom && pages[pages.length - 1].paragraphs.length > 0) {
      addPage();
    }
    paragraph.y = y;
    pages[pages.length - 1].paragraphs.push(paragraph);
    y += height + gap;
  });

  const signatureIntroHeight = 32;
  if (y + 165 > pageHeight - bottom) {
    addPage();
  }

  const signaturePage = pages[pages.length - 1];
  signaturePage.paragraphs.push({
    ...styleForBlock({ type: 'body', text: 'This agreement has been executed and signed by the parties.' }),
    id: 'nda-signature-intro',
    y,
    isCollapsed: false,
  });
  y += signatureIntroHeight;

  signaturePage.paragraphs.push({
    ...styleForBlock({ type: 'body', text: '{{companyName}}' }),
    id: 'nda-party-a-name',
    x: 54,
    y,
    width: 220,
    isBold: true,
    alignment: 'left',
    highlightPlaceholders: true,
  });
  signaturePage.paragraphs.push({
    ...styleForBlock({ type: 'body', text: '{{clientCompanyName}}' }),
    id: 'nda-party-b-name',
    x: 318,
    y,
    width: 220,
    isBold: true,
    alignment: 'left',
    highlightPlaceholders: true,
  });

  const rows = [
    ['signatoryName', 'clientName', 'Full Name:'],
    ['signatoryTitle', 'clientSignatoryTitle', 'Title:'],
    ['todayDate', 'todayDate', 'Date:'],
    ['companySignature', 'clientSignature', 'Signature:'],
  ];
  rows.forEach(([leftKey, rightKey, label], index) => {
    const rowY = y + 28 + (index * 26);
    signaturePage.paragraphs.push({
      ...styleForBlock({ type: 'body', text: label }),
      id: `nda-signature-left-label-${index}`,
      x: 54,
      y: rowY,
      width: 70,
      alignment: 'left',
    });
    signaturePage.paragraphs.push({
      ...styleForBlock({ type: 'body', text: label }),
      id: `nda-signature-right-label-${index}`,
      x: 318,
      y: rowY,
      width: 70,
      alignment: 'left',
    });
    signaturePage.highlightedAreas.push({
      key: leftKey,
      x: 126,
      y: rowY - 3,
      width: 145,
      height: 18,
      fontSize: 10,
      isBold: index === 0,
      color: '#111111',
      backgroundColor: '#fff3a3',
      borderColor: '#f0c94a',
    });
    signaturePage.highlightedAreas.push({
      key: rightKey,
      x: 390,
      y: rowY - 3,
      width: 145,
      height: 18,
      fontSize: 10,
      isBold: index === 0,
      color: '#111111',
      backgroundColor: '#fff3a3',
      borderColor: '#f0c94a',
    });
  });

  return pages;
}

function createDefaultNdaTemplate() {
  const clauses = clone(DEFAULT_NDA_CLAUSES);
  return {
    id: 'default-nda-format-sample',
    name: 'NDA Format Sample',
    sourceDocument: 'docs/NDA Format Sample.docx',
    version: '1.0',
    orientation: 'portrait',
    header: clone(DEFAULT_HEADER),
    clauses,
    pages: paginateBlocks(blocksFromClauses(clauses)),
  };
}

function mergePageShell(generatedPages, existingPages = []) {
  return generatedPages.map((page, index) => {
    const existing = existingPages[index] || {};
    return {
      ...page,
      showHeader: typeof existing.showHeader === 'boolean' ? existing.showHeader : page.showHeader,
      backgroundUrl: existing.backgroundUrl || page.backgroundUrl || '',
      placeholders: Array.isArray(existing.placeholders) ? existing.placeholders : page.placeholders,
      highlightedAreas: Array.isArray(existing.highlightedAreas) ? existing.highlightedAreas : page.highlightedAreas,
    };
  });
}

function normalizeTemplate(template = {}) {
  const defaultTemplate = createDefaultNdaTemplate();
  const normalized = {
    ...defaultTemplate,
    ...(template || {}),
  };
  normalized.orientation = normalized.orientation === 'landscape' ? 'landscape' : 'portrait';
  normalized.header = { ...clone(DEFAULT_HEADER), ...(normalized.header || {}) };
  normalized.clauses = normalizeClauses(normalized.clauses);
  normalized.pages = mergePageShell(
    paginateBlocks(blocksFromClauses(normalized.clauses)),
    Array.isArray(normalized.pages) ? normalized.pages : []
  );
  return normalized;
}

module.exports = {
  A4,
  DEFAULT_NDA_CLAUSES,
  NDA_PLACEHOLDERS,
  blocksFromClauses,
  createDefaultNdaTemplate,
  normalizeClauses,
  normalizeTemplate,
};
