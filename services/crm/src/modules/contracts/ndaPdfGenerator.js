const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { A4, normalizeTemplate } = require('./ndaTemplate');

function formatDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value || '');
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function resolveValue(key, data = {}) {
  const [rawKey, fallback = ''] = String(key || '').split('|');
  const cleanKey = rawKey.trim();
  let value = data[cleanKey];
  if ((value === undefined || value === null || value === '') && fallback) value = fallback.trim();
  if (value === undefined || value === null) value = '';
  if (/date/i.test(cleanKey) && value) return formatDate(value);
  return String(value);
}

function resolveParagraphText(text, data = {}) {
  return String(text || '').replace(/\{\{([^}]+)\}\}/g, (_match, key) => resolveValue(key, data));
}

function tokenizeParagraph(text, data = {}) {
  const tokens = [];
  const source = String(text || '');
  let lastIndex = 0;
  source.replace(/\{\{([^}]+)\}\}/g, (match, key, index) => {
    if (index > lastIndex) tokens.push({ text: source.slice(lastIndex, index), highlight: false });
    tokens.push({ text: resolveValue(key, data), highlight: true });
    lastIndex = index + match.length;
    return match;
  });
  if (lastIndex < source.length) tokens.push({ text: source.slice(lastIndex), highlight: false });
  return tokens;
}

function safeNumber(value, fallback, min = -Infinity, max = Infinity) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}

function safeColor(value, fallback) {
  const color = String(value || '').trim();
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(color) ? color : fallback;
}

function setPdfFont(doc, fontFamily, isBold, isItalic) {
  const family = String(fontFamily || '').toLowerCase();
  if (family.includes('courier')) {
    if (isBold && isItalic) return doc.font('Courier-BoldOblique');
    if (isBold) return doc.font('Courier-Bold');
    if (isItalic) return doc.font('Courier-Oblique');
    return doc.font('Courier');
  }
  if (family.includes('helvetica') || family.includes('inter') || family.includes('outfit') || family.includes('montserrat')) {
    if (isBold && isItalic) return doc.font('Helvetica-BoldOblique');
    if (isBold) return doc.font('Helvetica-Bold');
    if (isItalic) return doc.font('Helvetica-Oblique');
    return doc.font('Helvetica');
  }
  if (isBold && isItalic) return doc.font('Times-BoldItalic');
  if (isBold) return doc.font('Times-Bold');
  if (isItalic) return doc.font('Times-Italic');
  return doc.font('Times-Roman');
}

async function getAssetBuffer(source) {
  const value = String(source || '').trim();
  if (!value) return null;

  if (value.startsWith('data:')) {
    const [, payload = ''] = value.split(',', 2);
    return payload ? Buffer.from(payload, 'base64') : null;
  }

  if (/^https?:\/\//i.test(value)) {
    const response = await fetch(value);
    if (!response.ok) return null;
    return Buffer.from(await response.arrayBuffer());
  }

  const cleanValue = value.startsWith('/') ? value.substring(1) : value;
  const candidates = [
    value,
    path.resolve(__dirname, '..', value),
    path.resolve(__dirname, '..', '..', '..', value),
    // Resolve frontend assets relative to workspace root
    path.resolve(__dirname, '..', '..', '..', 'apps/sales/admin-crm/public', cleanValue),
    path.resolve(__dirname, '..', '..', '..', 'apps/sales/admin-crm/public/assets/icon', path.basename(cleanValue)),
  ];
  const existing = candidates.find((candidate) => fs.existsSync(candidate));
  return existing ? fs.readFileSync(existing) : null;
}

function findLogoPath() {
  const candidates = [
    path.resolve(__dirname, '..', '..', '..', 'apps/sales/admin-crm/public/assets/icon/softrate-transparent-logo.png'),
    path.resolve(__dirname, '..', '..', '..', 'apps/sales/admin-crm/public/assets/icon/logo.png'),
    path.resolve(__dirname, '..', '..', 'hrms/assets/images/pdf_logo.png'),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) || '';
}

function findHeaderImagePath() {
  const candidates = [
    path.resolve(__dirname, '..', 'assets/images/softrate-nda-header.png'),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) || '';
}

async function drawHeader(doc, template, width, data) {
  const header = template.header || {};
  if (header.enabled === false) return;

  const margin = 54;
  const logoAreaWidth = 130;
  const cursorY = 46;

  // Resolve company details from data, fallback to header template defaults
  const companyName = data?.companyName || header.companyTitle || 'SOFTRATE TECHNOLOGIES PRIVATE LIMITED';
  const companyAddress = data?.companyAddress || header.addressLine || '';
  const companyPhone = data?.companyPhone || '';
  const companyEmail = data?.companyEmail || '';
  const companyWebsite = data?.companyWebsite || '';

  // ------------------------------------------------------------------
  // Draw Logo (fixed max fit: 120 × 50) — resolves via getAssetBuffer
  // so it handles data:, http(s):, absolute paths AND relative paths
  // stored in the database (e.g. /assets/icon/softrate-transparent-logo.png)
  // ------------------------------------------------------------------
  let logoBuffer = data?.companyLogo || null;
  let logoResolved = false;

  if (logoBuffer) {
    try {
      let buf = null;
      if (Buffer.isBuffer(logoBuffer)) {
        buf = logoBuffer;
      } else if (typeof logoBuffer === 'string' && logoBuffer.startsWith('data:')) {
        buf = Buffer.from(logoBuffer.split(',')[1], 'base64');
      } else if (typeof logoBuffer === 'string') {
        // Could be a relative path like /assets/icon/... — try getAssetBuffer
        buf = await getAssetBuffer(logoBuffer);
      }
      if (buf) {
        doc.image(buf, margin, cursorY, { fit: [120, 50] });
        logoResolved = true;
      }
    } catch (e) {
      console.error('[NDA Header] Failed to draw logo from companyLogo:', e.message);
    }
  }

  if (!logoResolved) {
    // Fallback: try well-known Softrate logo path on disk
    const logoPath = header.logoPath || findLogoPath();
    if (logoPath) {
      try {
        doc.image(logoPath, margin, cursorY, { fit: [120, 50] });
        logoResolved = true;
      } catch {
        // fall through
      }
    }
  }

  if (!logoResolved) {
    // Last resort: render company name text where logo would go
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#1e293b')
       .text(companyName, margin, cursorY + 10, { width: logoAreaWidth });
  }

  // ------------------------------------------------------------------
  // Company info block — right side of the header
  // ------------------------------------------------------------------
  const textX = margin + logoAreaWidth + 10;
  const textWidth = width - margin - textX;

  // Company Name
  doc.font('Helvetica-Bold')
     .fontSize(10)
     .fillColor('#0f172a')
     .text(companyName.toUpperCase(), textX, cursorY + 2, {
       align: 'right',
       width: textWidth,
       characterSpacing: 0.8,
     });

  // Address
  if (companyAddress) {
    doc.font('Helvetica')
       .fontSize(7.5)
       .fillColor('#64748b')
       .text(companyAddress.toUpperCase(), textX, cursorY + 16, {
         align: 'right',
         width: textWidth,
         characterSpacing: 0.3,
       });
  }

  // Contact Info Line (Phone | Email | Website)
  const contactParts = [];
  if (companyPhone) {
    let p = companyPhone;
    if (p.startsWith('+91')) p = `(+91) ${p.substring(3).trim()}`;
    contactParts.push(p);
  }
  if (companyEmail) contactParts.push(companyEmail.toLowerCase());
  if (companyWebsite) contactParts.push(companyWebsite.toLowerCase());

  // Fallback to template contactLine if no data
  if (contactParts.length === 0 && header.contactLine) contactParts.push(header.contactLine);

  if (contactParts.length > 0) {
    doc.font('Helvetica')
       .fontSize(7.5)
       .fillColor('#64748b')
       .text(contactParts.join('  |  '), textX, cursorY + 30, {
         align: 'right',
         width: textWidth,
         characterSpacing: 0.3,
       });
  }

  // Divider line
  doc.moveTo(margin, 108)
     .lineTo(width - margin, 108)
     .lineWidth(0.75)
     .strokeColor('#cbd5e1')
     .stroke();
}

async function drawBackground(doc, page, width, height) {
  if (!page.backgroundUrl) return;
  const buffer = await getAssetBuffer(page.backgroundUrl);
  if (buffer) doc.image(buffer, 0, 0, { width, height });
}

function drawPlaceholder(doc, placeholder, data) {
  const fontSize = safeNumber(placeholder.fontSize, 12, 6, 120);
  setPdfFont(doc, placeholder.fontFamily || 'Helvetica', placeholder.isBold, false);
  doc
    .fontSize(fontSize)
    .fillColor(safeColor(placeholder.color, '#000000'))
    .text(resolveValue(placeholder.key, data), safeNumber(placeholder.x, 0), safeNumber(placeholder.y, 0), {
      width: safeNumber(placeholder.width, 220, 20, 820),
      lineBreak: false,
    });
}

function drawHighlightedArea(doc, area, data) {
  const x = safeNumber(area.x, 0);
  const y = safeNumber(area.y, 0);
  const width = safeNumber(area.width, 140, 20, 820);
  const height = safeNumber(area.height, 20, 10, 200);
  const fontSize = safeNumber(area.fontSize, 11, 6, 80);

  setPdfFont(doc, area.fontFamily || 'Helvetica', area.isBold, area.isItalic);
  doc
    .fontSize(fontSize)
    .fillColor(safeColor(area.color, '#111111'))
    .text(resolveValue(area.key, data), x + 4, y + Math.max(2, (height - fontSize) / 2 - 1), {
      width: Math.max(10, width - 8),
      height: Math.max(8, height - 2),
      ellipsis: true,
      lineBreak: false,
    });
}

function splitDrawablePieces(segment) {
  return String(segment.text || '')
    .split(/(\s+|\n)/)
    .flatMap((piece) => piece.includes('\n')
      ? piece.split(/(\n)/).filter(Boolean)
      : [piece])
    .filter((piece) => piece.length);
}

function drawParagraph(doc, paragraph, data) {
  const text = resolveParagraphText(paragraph.text, data);
  if (!text && !paragraph.text) return;

  const fontSize = safeNumber(paragraph.fontSize, 10, 6, 120);
  setPdfFont(doc, paragraph.fontFamily || 'Helvetica', paragraph.isBold, paragraph.isItalic);
  doc.fontSize(fontSize).fillColor(safeColor(paragraph.color, '#111111'));

  const desiredLineHeight = safeNumber(paragraph.lineHeight, 1.3, 1, 3);
  const lineGap = Math.max(0, (desiredLineHeight - 1.15) * fontSize);
  const x = safeNumber(paragraph.x, 54);
  const y = safeNumber(paragraph.y, 140);
  const width = safeNumber(paragraph.width, 487, 20, 820);
  const characterSpacing = safeNumber(paragraph.letterSpacing, 0, 0, 0.5) * fontSize;

  // Hanging indent for bullet items: draw the bullet marker at x, text body indented +12
  if (text.startsWith('- ') && paragraph.isBullet !== false) {
    const bulletMarker = '\u2022';
    const markerWidth = 12;
    // Draw the bullet marker
    doc.text(bulletMarker, x, y, {
      width: markerWidth,
      align: 'left',
      characterSpacing,
      lineGap,
      continued: false,
    });
    // Draw the text body with hanging indent
    doc.text(text.slice(2), x + markerWidth, y, {
      width: Math.max(20, width - markerWidth),
      align: 'justify',
      characterSpacing,
      lineGap,
    });
    return;
  }

  doc.text(text, x, y, {
    width,
    align: paragraph.alignment || 'left',
    characterSpacing,
    lineGap,
  });
}

async function generateDynamicNdaPDF(data, rawTemplate = {}) {

  const template = normalizeTemplate(rawTemplate);
  const orientation = template.orientation || 'portrait';
  const { width, height } = A4[orientation] || A4.portrait;
  const pages = Array.isArray(template.pages) && template.pages.length ? template.pages : normalizeTemplate().pages;

  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        layout: orientation,
        margin: 0,
        autoFirstPage: false,
        bufferPages: false,
      });
      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      for (const [index, page] of pages.entries()) {
        doc.addPage({ size: 'A4', layout: orientation, margin: 0 });
        doc.rect(0, 0, width, height).fill('#ffffff');
        await drawBackground(doc, page, width, height);
        if (index === 0 && page.showHeader !== false) await drawHeader(doc, template, width, data);
        (page.paragraphs || []).forEach((paragraph) => drawParagraph(doc, paragraph, data));
        (page.highlightedAreas || []).forEach((area) => drawHighlightedArea(doc, area, data));
        (page.placeholders || []).forEach((placeholder) => drawPlaceholder(doc, placeholder, data));
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = {
  generateDynamicNdaPDF,
  generateDynamicPDF: generateDynamicNdaPDF,
  resolveParagraphText,
  resolveValue,
};
