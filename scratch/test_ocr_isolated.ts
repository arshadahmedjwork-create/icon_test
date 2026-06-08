import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';

async function testOCRDirectly() {
    console.log("Reading local DCI CERTIFICATE.pdf...");
    const filePath = path.resolve('DCI CERTIFICATE.pdf');
    if (!fs.existsSync(filePath)) {
        console.error("Local certificate file not found at:", filePath);
        return;
    }

    const fileBuffer = fs.readFileSync(filePath);
    
    // We will send the PDF as form data to OCR.space
    const formData = new FormData();
    formData.append('apikey', 'helloworld');
    formData.append('filetype', 'PDF');
    formData.append('OCREngine', '2');
    
    // Convert buffer to Blob/File for FormData
    const blob = new Blob([fileBuffer], { type: 'application/pdf' });
    formData.append('file', blob, 'DCI_CERTIFICATE.pdf');

    console.log("Sending file directly to OCR.space API...");
    try {
        const response = await axios.post('https://api.ocr.space/parse/image', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            }
        });

        const ocrData = response.data;
        if (ocrData.IsErroredOnProcessing) {
            console.error("OCR API returned error:", ocrData.ErrorMessage);
            return;
        }

        const extractedText = ocrData.ParsedResults?.[0]?.ParsedText || '';
        console.log("\n--- EXTRACTED TEXT START ---");
        console.log(extractedText);
        console.log("--- EXTRACTED TEXT END ---\n");

        // Verification inputs
        const providedDciNumber = '24324';
        const providedName = 'SAVITHA LAKSHMI R';

        // 1. DCI Number Match
        const normalizedProvidedDci = String(providedDciNumber).trim();
        const hasDciMatch = normalizedProvidedDci.length > 0 && extractedText.includes(normalizedProvidedDci);

        // 2. Name Match
        const nameComponents = String(providedName)
            .toLowerCase()
            .split(/\s+/)
            .filter(part => part.length > 2);
        
        const matchedNameParts = nameComponents.filter(part => extractedText.toLowerCase().includes(part));
        const hasNameMatch = nameComponents.length > 0 && matchedNameParts.length >= Math.min(2, nameComponents.length);

        console.log("Verification results:");
        console.log("- DCI Number Match:", hasDciMatch ? "MATCHED ✅" : "MISMATCH ❌");
        console.log("- Name Match:", hasNameMatch ? "MATCHED ✅" : "MISMATCH ❌", `(Matched parts: ${matchedNameParts.join(', ')})`);
        
        if (hasDciMatch && hasNameMatch) {
            console.log("\nVERIFICATION STATUS: VERIFIED 🎉");
        } else {
            console.log("\nVERIFICATION STATUS: FAILED ❌");
        }

    } catch (err: any) {
        console.error("API request failed:", err.message || err);
    }
}

testOCRDirectly();
