const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

function formatDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value || '');
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

async function getAssetBuffer(source) {
  const value = String(source || '').trim();
  if (!value) return null;

  if (value.startsWith('data:')) {
    const [, payload = ''] = value.split(',', 2);
    return payload ? Buffer.from(payload, 'base64') : null;
  }

  if (/^https?:\/\//i.test(value)) {
    try {
      const response = await fetch(value);
      if (!response.ok) return null;
      return Buffer.from(await response.arrayBuffer());
    } catch {
      return null;
    }
  }

  const candidates = [
    value,
    path.resolve(__dirname, '..', value),
    path.resolve(__dirname, '..', '..', '..', value),
  ];
  const existing = candidates.find((candidate) => fs.existsSync(candidate));
  return existing ? fs.readFileSync(existing) : null;
}

function drawHeader(doc, data, width, margin) {
  const contentWidth = width - (margin * 2);
  const cursorY = margin;

  // Draw Logo (fixed max size fit: [120, 50])
  let logoBuffer = null;
  if (data.companyLogo) {
    // If we have a base64 logo or path from settings
    logoBuffer = data.companyLogo; 
  }

  if (logoBuffer) {
    try {
      const isBuffer = Buffer.isBuffer(logoBuffer);
      if (isBuffer || (typeof logoBuffer === 'string' && logoBuffer.startsWith('data:'))) {
        const buf = isBuffer ? logoBuffer : Buffer.from(logoBuffer.split(',')[1], 'base64');
        doc.image(buf, margin, cursorY, { fit: [120, 50] });
      } else {
        doc.font('Helvetica-Bold').fontSize(14).fillColor('#1e293b').text(data.companyName, margin, cursorY, { width: 150 });
      }
    } catch (e) {
      console.error('Failed to draw logo image:', e);
      doc.font('Helvetica-Bold').fontSize(14).fillColor('#1e293b').text(data.companyName, margin, cursorY, { width: 150 });
    }
  } else {
    doc.font('Helvetica-Bold').fontSize(14).fillColor('#1e293b').text(data.companyName, margin, cursorY, { width: 150 });
  }

  // Draw Company Details on Right (Name, Address, Phone, Website, Email)
  const detailsX = margin + 160;
  const detailsWidth = contentWidth - 160;

  doc.font('Helvetica-Bold').fontSize(10).fillColor('#1e293b').text(data.companyName.toUpperCase(), detailsX, cursorY, { align: 'right', width: detailsWidth });

  let detailsText = '';
  if (data.companyAddress) detailsText += `${data.companyAddress}\n`;
  let contactInfo = [];
  if (data.companyPhone) contactInfo.push(`Tel: ${data.companyPhone}`);
  if (data.companyEmail) contactInfo.push(`Email: ${data.companyEmail}`);
  if (data.companyWebsite) contactInfo.push(`Web: ${data.companyWebsite}`);
  if (contactInfo.length) detailsText += contactInfo.join(' | ');

  doc.font('Helvetica').fontSize(8).fillColor('#64748b').text(detailsText, detailsX, cursorY + 14, { align: 'right', width: detailsWidth, lineGap: 2 });

  // Divider line
  doc.moveTo(margin, margin + 65).lineTo(width - margin, margin + 65).lineWidth(1).strokeColor('#e2e8f0').stroke();
}

async function generateSlaPDF(data) {
  const orientation = 'portrait';
  const width = 595.28; // A4 width
  const height = 841.89; // A4 height
  const margin = 54;
  const contentWidth = width - (margin * 2);

  // Fetch logo buffer if available
  if (data.companyLogo && typeof data.companyLogo === 'string') {
    try {
      const buffer = await getAssetBuffer(data.companyLogo);
      if (buffer) {
        data.companyLogo = buffer;
      }
    } catch {
      data.companyLogo = null;
    }
  }

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        layout: orientation,
        margin: 0,
        autoFirstPage: false,
      });

      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      // --- PAGE 1 ---
      doc.addPage({ size: 'A4', layout: orientation, margin: 0 });
      doc.rect(0, 0, width, height).fill('#ffffff');

      // Draw Header
      drawHeader(doc, data, width, margin);

      let cursorY = margin + 85;

      // Title
      doc.font('Helvetica-Bold').fontSize(16).fillColor('#0f172a').text('SERVICE LEVEL AGREEMENT', margin, cursorY, { align: 'center', width: contentWidth });
      cursorY += 24;

      const dateStr = formatDate(data.effectiveDate || new Date());
      doc.font('Helvetica-Oblique').fontSize(9).fillColor('#475569').text(`Effective Date: ${dateStr}`, margin, cursorY, { align: 'center', width: contentWidth });
      cursorY += 25;

      // Agreement Intro
      doc.font('Helvetica').fontSize(9.5).fillColor('#334155').text(
        `This Service Level Agreement ("Agreement" or "SLA") defines the core support standards and service level commitments provided by the Provider to the Client.`,
        margin, cursorY, { align: 'justify', width: contentWidth, lineGap: 3 }
      );
      cursorY += 45;

      // 1. Parties Cards
      doc.font('Helvetica-Bold').fontSize(10.5).fillColor('#0f172a').text('1. PARTIES & REPRESENTATIVES', margin, cursorY);
      cursorY += 16;

      // Provider details card
      doc.rect(margin, cursorY, contentWidth / 2 - 10, 85).fillAndStroke('#f8fafc', '#e2e8f0');
      doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(9).text('PROVIDER', margin + 10, cursorY + 10);
      doc.font('Helvetica').fontSize(8).fillColor('#475569').text(
        `Company: ${data.companyName}\nAddress: ${data.companyAddress || 'N/A'}\nEmail: ${data.companyEmail || 'N/A'}\nPhone: ${data.companyPhone || 'N/A'}`,
        margin + 10, cursorY + 22, { width: contentWidth / 2 - 30, lineGap: 2 }
      );

      // Client details card
      doc.rect(margin + contentWidth / 2 + 10, cursorY, contentWidth / 2 - 10, 85).fillAndStroke('#f8fafc', '#e2e8f0');
      doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(9).text('CLIENT', margin + contentWidth / 2 + 20, cursorY + 10);
      doc.font('Helvetica').fontSize(8).fillColor('#475569').text(
        `Company: ${data.clientCompanyName}\nRepresentative: ${data.clientName || 'N/A'}\nEmail: ${data.clientEmail || 'N/A'}\nAddress: ${data.clientAddress || 'N/A'}`,
        margin + contentWidth / 2 + 20, cursorY + 22, { width: contentWidth / 2 - 30, lineGap: 2 }
      );

      cursorY += 105;

      // 2. Commitments & Response Times
      doc.font('Helvetica-Bold').fontSize(10.5).fillColor('#0f172a').text('2. SERVICE COMMITMENT & RESPONSE TIMES', margin, cursorY);
      cursorY += 16;

      doc.font('Helvetica').fontSize(9.5).fillColor('#334155').text(
        `The Provider agrees to respond to service requests and support inquiries from the Client according to the priority levels outlined in the table below:`,
        margin, cursorY, { align: 'justify', width: contentWidth, lineGap: 3 }
      );
      cursorY += 30;

      // Draw Response Time Table
      const colWidths = [110, 240, 137];
      const tableHeaders = ['Priority Level', 'Description / Scope', 'Response Target'];

      // Draw header row
      doc.rect(margin, cursorY, contentWidth, 20).fill('#1e293b');
      let currentX = margin;
      tableHeaders.forEach((h, i) => {
        doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8.5).text(h, currentX + 6, cursorY + 5, { width: colWidths[i] - 12 });
        currentX += colWidths[i];
      });

      cursorY += 20;

      const rows = [
        ['P1 - Critical', 'System crash, core business operations blocked with no workaround.', '2 Hours (24/7)'],
        ['P2 - High', 'Core features degraded or failed, causing significant operational impact.', '4 Hours (Business Hours)'],
        ['P3 - Medium', 'Minor bugs or functionality issues with an existing workaround.', '8 Hours (Business Hours)'],
        ['P4 - Low', 'General inquiries, feedback, cosmetic bugs, or enhancement requests.', '24 Hours (Business Hours)']
      ];

      rows.forEach((row, rowIndex) => {
        const rowHeight = 26;
        const bg = rowIndex % 2 === 0 ? '#f8fafc' : '#ffffff';
        doc.rect(margin, cursorY, contentWidth, rowHeight).fillAndStroke(bg, '#e2e8f0');

        let x = margin;
        row.forEach((cell, cellIndex) => {
          doc.fillColor('#334155').font(cellIndex === 0 ? 'Helvetica-Bold' : 'Helvetica').fontSize(8).text(cell, x + 6, cursorY + 7, { width: colWidths[cellIndex] - 12 });
          x += colWidths[cellIndex];
        });
        cursorY += rowHeight;
      });

      // --- PAGE 2 ---
      doc.addPage({ size: 'A4', layout: orientation, margin: 0 });
      doc.rect(0, 0, width, height).fill('#ffffff');

      // Draw Header on Page 2
      drawHeader(doc, data, width, margin);

      cursorY = margin + 85;

      // 3. Standards
      doc.font('Helvetica-Bold').fontSize(10.5).fillColor('#0f172a').text('3. STANDARDS & AMENDMENTS', margin, cursorY);
      cursorY += 16;
      doc.font('Helvetica').fontSize(9.5).fillColor('#334155').text(
        `This Agreement will remain in force unless modified by mutual consent or terminated under the terms of the main Service Agreement. The Provider reserves the right to adjust support processes to improve quality of service.`,
        margin, cursorY, { align: 'justify', width: contentWidth, lineGap: 3 }
      );

      cursorY += 60;

      // Signatures header
      doc.font('Helvetica-Bold').fontSize(10.5).fillColor('#0f172a').text('IN WITNESS WHEREOF, the parties hereto have executed this Service Level Agreement.', margin, cursorY);

      cursorY += 60;

      // Left: Provider Signature Line
      doc.moveTo(margin, cursorY + 40).lineTo(margin + 200, cursorY + 40).lineWidth(0.5).strokeColor('#64748b').stroke();
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#0f172a').text('For Provider:', margin, cursorY - 15);
      doc.font('Helvetica').fontSize(8.5).fillColor('#475569').text(
        `Name: ${data.signatoryName || 'Authorized Representative'}\nTitle: ${data.signatoryTitle || 'Authorized Signatory'}\nDate: ${dateStr}`,
        margin, cursorY + 46, { lineGap: 3 }
      );

      // Right: Client Signature Line
      const clientSigX = margin + 267;
      doc.moveTo(clientSigX, cursorY + 40).lineTo(clientSigX + 200, cursorY + 40).lineWidth(0.5).strokeColor('#64748b').stroke();
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#0f172a').text('For Client:', clientSigX, cursorY - 15);
      doc.font('Helvetica').fontSize(8.5).fillColor('#475569').text(
        `Name: ${data.clientName || 'Client Representative'}\nTitle: ${data.clientSignatoryTitle || 'Authorized Signatory'}\nDate: ${dateStr}`,
        clientSigX, cursorY + 46, { lineGap: 3 }
      );

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = {
  generateSlaPDF,
};
