import fs from 'fs';
import path from 'path';
import xlsx from 'xlsx';
import JSZip from 'jszip';
import { generateIdCardPDF } from '../src/services/idCardEngine';

async function main() {
    console.log("Starting bulk ID generation...");
    
    const delegateZip = new JSZip();
    const pgZip = new JSZip();

    const delegateStudents: any[] = [];
    const pgStudents: any[] = [];

    // 1. Parse Excel for Delegates
    const excelPath = path.join(process.cwd(), 'public', 'ID CARD', 'Delegate reg.in excel (2).xlsx');
    if (fs.existsSync(excelPath)) {
        console.log("Parsing Delegates Excel...");
        const wb = xlsx.readFile(excelPath);
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = xlsx.utils.sheet_to_json(ws) as any[];
        
        for (const row of data) {
            const regId = row['Registration Id'] || row['Registration ID'];
            const name = row['Name'];
            if (regId && name) {
                delegateStudents.push({
                    name,
                    registrationId: regId,
                    delegateType: 'Delegate',
                });
            }
        }
    } else {
        console.warn(`Excel file not found at ${excelPath}`);
    }

    // 2. Parse PG PDF Text
    const pgTxtPath = path.join(process.cwd(), 'scratch', 'pg_pdf_text.txt');
    if (fs.existsSync(pgTxtPath)) {
        console.log("Parsing PG PDF text...");
        const txtContent = fs.readFileSync(pgTxtPath, 'utf8');
        const lines = txtContent.split('\n');
        
        const regexWithPD = /^(\d+)\s*(.*?)(PD\d{3})/;
        const regexWithoutPD = /^(\d+)\s*(.*?)(PCC\d?|6\d{9}|7\d{9}|8\d{9}|9\d{9})/;

        for (const line of lines) {
            const trimLine = line.trim();
            if (!trimLine) continue;

            let match = trimLine.match(regexWithPD);
            if (match) {
                pgStudents.push({
                    name: match[2].trim(),
                    registrationId: match[3],
                    delegateType: 'PG',
                });
            } else {
                match = trimLine.match(regexWithoutPD);
                if (match) {
                    pgStudents.push({
                        name: match[2].trim(),
                        registrationId: '', // Missing in PDF
                        delegateType: 'PG',
                    });
                }
            }
        }
    } else {
        console.warn(`PG PDF Text file not found at ${pgTxtPath}`);
    }

    // 3. Generate Delegates
    console.log(`Generating ${delegateStudents.length} Delegates...`);
    for (let i = 0; i < delegateStudents.length; i++) {
        const student = delegateStudents[i];
        const details = {
            studentName: student.name,
            iconId: "", // EMPTY SO IT'S NOT DRAWN
            registrationId: student.registrationId,
            qrData: student.registrationId ? `Reg ID: ${student.registrationId}\nName: ${student.name}` : `Name: ${student.name}`,
            templateName: 'DELIGATES_ID_CARD.pdf'
        };

        try {
            const pdfBytes = await generateIdCardPDF(details);
            delegateZip.file(`ID_Card_${student.registrationId}.pdf`, pdfBytes);
        } catch (e) {
            console.error(`Failed to generate ID card for ${student.name}`, e);
        }
    }

    // 4. Generate PGs
    console.log(`Generating ${pgStudents.length} PGs...`);
    for (let i = 0; i < pgStudents.length; i++) {
        const student = pgStudents[i];
        const details = {
            studentName: student.name,
            iconId: "", // EMPTY
            registrationId: student.registrationId,
            qrData: student.registrationId ? `Reg ID: ${student.registrationId}\nName: ${student.name}` : `Name: ${student.name}`, 
            templateName: 'PG_ID.pdf'
        };

        try {
            const pdfBytes = await generateIdCardPDF(details);
            const fileName = student.registrationId ? `ID_Card_${student.registrationId}.pdf` : `ID_Card_${student.name.replace(/[^a-z0-9]/gi, '_')}.pdf`;
            pgZip.file(fileName, pdfBytes);
        } catch (e) {
            console.error(`Failed to generate ID card for ${student.name}`, e);
        }
    }

    // 5. Save Zips
    console.log("Saving Delegate zip file...");
    const delegateZipContent = await delegateZip.generateAsync({ type: 'nodebuffer' });
    const delegateOutPath = path.join(process.cwd(), 'public', 'Offline_Delegate_IDs.zip');
    fs.writeFileSync(delegateOutPath, delegateZipContent);

    console.log("Saving PG zip file...");
    const pgZipContent = await pgZip.generateAsync({ type: 'nodebuffer' });
    const pgOutPath = path.join(process.cwd(), 'public', 'Offline_PG_IDs.zip');
    fs.writeFileSync(pgOutPath, pgZipContent);

    console.log(`Saved successfully!`);
}

main().catch(console.error);
