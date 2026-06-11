const PDFDocument = require('pdfkit');
const fs = require('fs');

const doc = new PDFDocument({ size: 'A4', margin: 40 });
doc.pipe(fs.createWriteStream('test_pdfkit_justify.pdf'));

doc.font('Helvetica');
doc.fontSize(14);

// Test justified alignment with continued
doc.text("We are pleased to offer you an Internship opportunity as a/an ", 50, 50, { width: 400, align: 'justify', continued: true });
doc.font('Helvetica-Bold');
doc.text("Cyber Security", { continued: true });
doc.font('Helvetica');
doc.text(" at Softrate Global (India). This is a longer text to force wrapping and justify to see if it works correctly without overlapping or breaking the text. Let's add more words to make it span multiple lines.");

doc.end();
console.log("PDF Justify test generated.");
