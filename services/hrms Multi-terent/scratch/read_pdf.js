const fs = require('fs');
const pdf = require('pdf-parse');

let dataBuffer1 = fs.readFileSync('test_pdfkit_justify.pdf');
let dataBuffer2 = fs.readFileSync('test_pdfkit_justify2.pdf');

pdf(dataBuffer1).then(function(data) {
    console.log("=== PDF 1 ===");
    console.log(data.text);
    return pdf(dataBuffer2);
}).then(function(data) {
    console.log("=== PDF 2 ===");
    console.log(data.text);
}).catch(console.error);
