const PDFDocument = require('pdfkit');
const fs = require('fs');

const doc = new PDFDocument({ size: 'A4', margin: 40 });
doc.pipe(fs.createWriteStream('test_pdfkit_spaces.pdf'));

doc.font('Helvetica').fontSize(14);

// Test 1: Trailing space
doc.text("Test One ", { continued: true, align: 'justify', width: 400 });
doc.text("merged", { continued: true });
doc.text(" normal line wrap here to see justify.");

doc.moveDown();

// Test 2: NBSP
doc.text("Test Two", { continued: true, align: 'justify', width: 400 });
doc.text("\u00A0merged", { continued: true });
doc.text(" normal line wrap here to see justify.");

doc.end();
console.log("Test generated.");
