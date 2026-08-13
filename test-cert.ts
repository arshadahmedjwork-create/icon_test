import { generateCertificatePDF } from './src/services/certificateEngine.ts';
import fs from 'fs';

async function run() {
    console.log("Generating test certificate...");
    try {
        const pdfBytes = await generateCertificatePDF({
            certificateId: 'test-winner-123',
            participantName: 'Arshad Ahmed',
            sessionName: 'Oral Pathology',
            role: 'winner',
            date: '20/6/2026',
            eventName: "MADRAS ICON' 26",
            type: 'winner',
            rank: 1
        });
        
        fs.writeFileSync('test-winner-cert.pdf', pdfBytes);
        console.log("Saved to test-winner-cert.pdf");
    } catch (e) {
        console.error(e);
    }
}

run();
