const PDFDocument = require('pdfkit');
const fs = require('fs');

const doc = new PDFDocument({ size: 'A4', margin: 40 });
doc.pipe(fs.createWriteStream('test_pdfkit_spaces.pdf'));

doc.font('Helvetica').fontSize(14);

let lineText = "opportunity as a/an **Cyber Security** at Softrate Global (India)";
const parts = lineText.split(/(\*\*.*?\*\*)/g);
const formattedParts = [];

for (let j = 0; j < parts.length; j++) {
    const part = parts[j];
    if (!part) continue;
    const isInlineBold = part.startsWith('**') && part.endsWith('**');
    const actualText = isInlineBold ? part.slice(2, -2) : part;
    formattedParts.push({ text: actualText, isBold: isInlineBold });
}

for (let j = 1; j < formattedParts.length; j++) {
    const match = formattedParts[j].text.match(/^(\s+)/);
    if (match) {
        formattedParts[j-1].text += match[1];
        formattedParts[j].text = formattedParts[j].text.substring(match[1].length);
    }
}

let isFirstPart = true;
for (let j = 0; j < formattedParts.length; j++) {
    const fp = formattedParts[j];
    if (!fp.text && j !== formattedParts.length - 1) continue; 
    
    if (fp.isBold) doc.font('Helvetica-Bold');
    else doc.font('Helvetica');
    
    const isLastPart = (j === formattedParts.length - 1) || (formattedParts.slice(j+1).every(p => !p.text));
    
    if (isFirstPart) {
        doc.text(fp.text, 50, 50, { width: 400, align: 'justify', continued: !isLastPart });
        isFirstPart = false;
    } else {
        doc.text(fp.text, { continued: !isLastPart });
    }
    if (isLastPart) break;
}

doc.end();
console.log("Test generated with fix.", JSON.stringify(formattedParts));
