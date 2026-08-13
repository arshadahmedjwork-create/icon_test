const fs = require('fs');
const txt = fs.readFileSync('scratch/pg_pdf_text.txt', 'utf8');
const lines = txt.split('\n');
let pgs = [];
const regex = /^(\d+)\s*(.*?)(PD\d{3})/;
for (const line of lines) {
    const match = line.trim().match(regex);
    if (match) {
        pgs.push({ name: match[2].trim(), regId: match[3] });
    }
}
console.log('Total PGs:', pgs.length);
console.log(pgs.slice(0, 3));
