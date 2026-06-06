import { PDFDocument } from 'pdf-lib';
import * as fs from 'fs';
import * as path from 'path';

async function check() {
    const files = ['Participation_Certificate.png', 'appre_certificate.png', 'judge_certificate.png'];
    for (const file of files) {
        const filePath = path.resolve('public', file);
        if (fs.existsSync(filePath)) {
            const bytes = fs.readFileSync(filePath);
            const pdfDoc = await PDFDocument.create();
            const pngImage = await pdfDoc.embedPng(bytes);
            const { width, height } = pngImage.scale(1.0);
            console.log(`${file}: width=${width}, height=${height}`);
        } else {
            console.log(`${file} does not exist at ${filePath}`);
        }
    }
}

check();
