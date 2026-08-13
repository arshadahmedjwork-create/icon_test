import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';
import { generateIdCardPDF } from '../src/services/idCardEngine';

async function main() {
    console.log("Starting Organisers ID generation...");
    
    const zip = new JSZip();
    const students: any[] = [];

    const csvPath = path.join(process.cwd(), 'scratch', 'organisers.csv');
    if (fs.existsSync(csvPath)) {
        const csvContent = fs.readFileSync(csvPath, 'utf8');
        const rows = csvContent.split('\n');
        for (let i = 1; i < rows.length; i++) {
            const line = rows[i].trim();
            if (!line) continue;
            // Handle quotes in CSV
            const match = line.match(/^([^,]+),"(.*?)"$/);
            if (match) {
                const regId = match[1];
                const name = match[2];
                students.push({
                    name,
                    registrationId: regId
                });
            }
        }
    }

    console.log(`Generating ${students.length} Organisers...`);
    for (let i = 0; i < students.length; i++) {
        const student = students[i];
        const details = {
            studentName: student.name,
            iconId: "", 
            registrationId: student.registrationId,
            qrData: `Reg ID: ${student.registrationId}\nName: ${student.name}`, 
            templateName: 'ORGANISER_ID.pdf'
        };

        try {
            const pdfBytes = await generateIdCardPDF(details);
            zip.file(`ID_Card_${student.registrationId}.pdf`, pdfBytes);
        } catch (e) {
            console.error(`Failed to generate ID card for ${student.name}`, e);
        }
    }

    console.log("Saving zip file...");
    const zipContent = await zip.generateAsync({ type: 'nodebuffer' });
    const outPath = path.join(process.cwd(), 'public', 'Offline_Organiser_IDs.zip');
    fs.writeFileSync(outPath, zipContent);

    console.log(`Saved successfully!`);
}

main().catch(console.error);
