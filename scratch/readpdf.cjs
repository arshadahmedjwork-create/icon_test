const fs = require('fs');
const pdf = require('pdf-parse');

let dataBuffer = fs.readFileSync('public/ID CARD/PG registrations.pdf');
pdf(dataBuffer).then(function(data) {
    fs.writeFileSync('scratch/pg_pdf_text.txt', data.text);
    console.log('Length:', data.text.length);
}).catch(console.error);
