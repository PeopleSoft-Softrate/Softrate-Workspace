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

  const candidates = [
    value,
    path.resolve(__dirname, '..', value),
    path.resolve(__dirname, '..', '..', '..', value),
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

function drawHeader(doc, template, width) {
  const header = template.header || {};
  if (header.enabled === false) return;

  const headerImagePath = header.imagePath || findHeaderImagePath();
  if (headerImagePath) {
    try {
      doc.image(headerImagePath, 18, 14, { width: width - 36 });
      doc.moveTo(28, 116).lineTo(width - 28, 116).lineWidth(0.5).strokeColor('#d5d5d5').stroke();
      return;
    } catch {
      // Fall back to constructed text header.
    }
  }

  const logoPath = header.logoPath || findLogoPath();
  if (logoPath) {
    try {
      doc.image(logoPath, 30, 18, { width: 138, fit: [138, 62] });
    } catch {
      // Continue without a logo if PDFKit cannot read the asset.
    }
  }

  doc
    .font('Times-Bold')
    .fontSize(18)
    .fillColor('#444444')
    .text(header.companyTitle || 'SOFTRATE TECHNOLOGIES (P) LTD', 190, 28, {
      width: width - 210,
      align: 'center',
      characterSpacing: 2,
    });

  doc
    .font('Times-Roman')
    .fontSize(10.5)
    .fillColor('#444444')
    .text(header.addressLine || '', 190, 62, { width: width - 210, align: 'center', characterSpacing: 1.5 })
    .text(header.contactLine || '', 190, 86, { width: width - 210, align: 'center', characterSpacing: 1.2 });

  doc.moveTo(28, 116).lineTo(width - 28, 116).lineWidth(0.5).strokeColor('#d5d5d5').stroke();
}

async function drawBackground(doc, page, width, height) {
  if (!page.backgroundUrl) return;
  const buffer = await getAssetBuffer(page.backgroundUrl);
  if (buffer) doc.image(buffer, 0, 0, { width, height });
}

function drawPlaceholder(doc, placeholder, data) {
  const fontSize = safeNumber(placeholder.fontSize, 12, 6, 120);
  setPdfFont(doc, placeholder.fontFamily || 'Times-Roman', placeholder.isBold, false);
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
  const backgroundColor = safeColor(area.backgroundColor, '#fff3a3');
  const borderColor = safeColor(area.borderColor, '#f0c94a');

  doc.save();
  doc.roundedRect(x, y, width, height, 2).fillAndStroke(backgroundColor, borderColor);
  doc.restore();

  setPdfFont(doc, area.fontFamily || 'Times-Roman', area.isBold, area.isItalic);
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

function drawInlineText(doc, paragraph, data) {
  const x = safeNumber(paragraph.x, 54);
  const y = safeNumber(paragraph.y, 140);
  const width = safeNumber(paragraph.width, 487, 20, 820);
  const fontSize = safeNumber(paragraph.fontSize, 10, 6, 120);
  const lineHeight = fontSize * safeNumber(paragraph.lineHeight, 1.3, 1, 3);
  const highlightColor = safeColor(paragraph.placeholderHighlightColor, '#fff3a3');
  let cursorX = x;
  let cursorY = y;

  setPdfFont(doc, paragraph.fontFamily || 'Times-Roman', paragraph.isBold, paragraph.isItalic);
  doc.fontSize(fontSize).fillColor(safeColor(paragraph.color, '#111111'));

  for (const segment of tokenizeParagraph(paragraph.text, data)) {
    for (const piece of splitDrawablePieces(segment)) {
      if (piece === '\n') {
        cursorX = x;
        cursorY += lineHeight;
        continue;
      }

      const measured = doc.widthOfString(piece);
      if (!/^\s+$/.test(piece) && cursorX > x && cursorX + measured > x + width) {
        cursorX = x;
        cursorY += lineHeight;
      }

      if (segment.highlight && piece.trim()) {
        doc.save();
        doc.roundedRect(cursorX - 1, cursorY - 1, measured + 2, fontSize + 4, 2).fill(highlightColor);
        doc.restore();
      }

      doc.fillColor(safeColor(paragraph.color, '#111111')).text(piece, cursorX, cursorY, { lineBreak: false });
      cursorX += measured;
    }
  }
}

function drawParagraph(doc, paragraph, data) {
  const text = resolveParagraphText(paragraph.text, data);
  if (!text && !paragraph.text) return;

  const fontSize = safeNumber(paragraph.fontSize, 10, 6, 120);
  setPdfFont(doc, paragraph.fontFamily || 'Times-Roman', paragraph.isBold, paragraph.isItalic);
  doc.fontSize(fontSize).fillColor(safeColor(paragraph.color, '#111111'));

  if (paragraph.highlightPlaceholders && /\{\{[^}]+\}\}/.test(String(paragraph.text || ''))) {
    drawInlineText(doc, paragraph, data);
    return;
  }

  const desiredLineHeight = safeNumber(paragraph.lineHeight, 1.3, 1, 3);
  const lineGap = Math.max(0, (desiredLineHeight - 1.15) * fontSize);
  doc.text(text, safeNumber(paragraph.x, 54), safeNumber(paragraph.y, 140), {
    width: safeNumber(paragraph.width, 487, 20, 820),
    align: paragraph.alignment || 'left',
    characterSpacing: safeNumber(paragraph.letterSpacing, 0, 0, 0.5) * fontSize,
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

      for (const page of pages) {
        doc.addPage({ size: 'A4', layout: orientation, margin: 0 });
        doc.rect(0, 0, width, height).fill('#ffffff');
        await drawBackground(doc, page, width, height);
        drawHeader(doc, template, width);
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
