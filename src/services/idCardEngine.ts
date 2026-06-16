import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import QRCode from 'qrcode';

export interface IDCardDetails {
    studentName: string;
    iconId: string;
    registrationId?: string;
    qrData?: string; // What the QR code should contain
    templateName?: string;
}

// These are coordinates you can adjust when testing locally
export interface IDCardCoordinates {
    nameX: number;
    nameY: number;
    nameSize: number;
    
    iconIdX: number;
    iconIdY: number;
    iconIdSize: number;
    
    regIdX: number;
    regIdY: number;
    regIdSize: number;

    qrX: number;
    qrY: number;
    qrSize: number;
}

const defaultCoordinates: IDCardCoordinates = {
    nameX: 100,
    nameY: 250,
    nameSize: 20,
    
    iconIdX: 100,
    iconIdY: 220,
    iconIdSize: 16,
    
    regIdX: 100,
    regIdY: 190,
    regIdSize: 14,

    qrX: 100,
    qrY: 50,
    qrSize: 80,
};

export async function generateIdCardPDF(
    details: IDCardDetails,
    coords: IDCardCoordinates = defaultCoordinates
): Promise<Uint8Array> {
    // 1. Load the template PDF
    let pdfBytes: ArrayBuffer;
    const isNode = typeof window === 'undefined';
    
    // Default to the delegates card if no specific one is set
    const templateName = details.templateName || 'DELIGATES_ID_CARD.pdf';
    
    if (isNode) {
        const fs = await import('fs');
        const path = await import('path');
        const templatePath = path.resolve('public', templateName);
        if (fs.existsSync(templatePath)) {
            pdfBytes = fs.readFileSync(templatePath);
        } else {
            throw new Error(`Template PDF not found at ${templatePath}`);
        }
    } else {
        const templateUrl = `/${templateName}?t=${Date.now()}`;
        const response = await fetch(templateUrl);
        if (!response.ok) {
            throw new Error(`Failed to load ID card template: ${response.statusText}`);
        }
        pdfBytes = await response.arrayBuffer();
    }

    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pages = pdfDoc.getPages();
    const firstPage = pages[0];

    const pageWidth = firstPage.getWidth();
    const pageHeight = firstPage.getHeight();

    // The left sidebar (red/blue) takes about 55 points.
    const startX = 55;
    const availableWidth = pageWidth - startX;
    const centerX = startX + (availableWidth / 2);

    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);

    // New coordinates for ~269x357 PDF size
    // Adjusting these to fit neatly into the white area
    const nameY = 180;
    const iconIdY = 155;
    const regIdY = 130;
    
    // Make QR smaller and place it between Reg ID and the venue text
    const qrSize = 55;
    const qrY = 65;

    // 2. Draw Name
    const nameText = details.studentName.toUpperCase();
    const nameSize = 18; // scaled down from 36
    let nameWidth = helveticaBold.widthOfTextAtSize(nameText, nameSize);
    
    // Scale down name if it's too long
    let finalNameSize = nameSize;
    while (nameWidth > availableWidth - 20 && finalNameSize > 8) {
        finalNameSize -= 1;
        nameWidth = helveticaBold.widthOfTextAtSize(nameText, finalNameSize);
    }
    
    firstPage.drawText(nameText, {
        x: centerX - (nameWidth / 2),
        y: nameY,
        size: finalNameSize,
        font: helveticaBold,
        color: rgb(0.12, 0.22, 0.4),
    });

    // 3. Draw ICON ID
    const iconIdText = `ICON ID: ${details.iconId}`;
    const iconIdSize = 14;
    const iconIdWidth = helveticaBold.widthOfTextAtSize(iconIdText, iconIdSize);
    firstPage.drawText(iconIdText, {
        x: centerX - (iconIdWidth / 2),
        y: iconIdY,
        size: iconIdSize,
        font: helveticaBold,
        color: rgb(0.2, 0.2, 0.2),
    });

    // 4. Draw Registration ID (if exists)
    if (details.registrationId) {
        const regIdText = `Reg ID: ${details.registrationId}`;
        const regIdSize = 12;
        const regIdWidth = helvetica.widthOfTextAtSize(regIdText, regIdSize);
        firstPage.drawText(regIdText, {
            x: centerX - (regIdWidth / 2),
            y: regIdY,
            size: regIdSize,
            font: helvetica,
            color: rgb(0.3, 0.3, 0.3),
        });
    }

    // 5. Draw QR Code
    const qrContent = details.qrData || `ICON ID: ${details.iconId}\nName: ${details.studentName}`;
    const qrDataUrl = await QRCode.toDataURL(qrContent, {
        margin: 1,
        width: qrSize,
    });
    const qrImage = await pdfDoc.embedPng(qrDataUrl);

    firstPage.drawImage(qrImage, {
        x: centerX - (qrSize / 2),
        y: qrY,
        width: qrSize,
        height: qrSize,
    });

    return await pdfDoc.save();
}

export async function downloadIdCard(student: any, coords = defaultCoordinates) {
    const regNo = student.registrationId || '';
    const delegateType = student.delegateType || '';
    const isPG = delegateType === 'PG' || regNo.includes('PG');
    const isDelegate = regNo.includes('DG') || delegateType === 'Clinician' || delegateType === 'Academician';
    
    let templateName = 'DELIGATES_ID_CARD.pdf';
    if (isPG) {
        templateName = 'PG_ID.pdf';
    } else if (isDelegate) {
        templateName = 'DELIGATES_ID_CARD.pdf';
    }

    const details = {
        studentName: student.name || student.participantName || "Student",
        iconId: student.midasId || "PENDING",
        registrationId: student.registrationId || "",
        qrData: `ICON ID: ${student.midasId || "N/A"}\nName: ${student.name || student.participantName || "N/A"}`,
        templateName
    };
    const pdfBytes = await generateIdCardPDF(details, coords);
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `ID_Card_${student.midasId || student.id}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
}

export async function bulkDownloadIdCards(students: any[], coords = defaultCoordinates) {
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();

    for (const student of students) {
        if (!student.midasId) continue; // Skip those without ID
        
        const regNo = student.registrationId || '';
        const delegateType = student.delegateType || '';
        const isPG = delegateType === 'PG' || regNo.includes('PG');
        const isDelegate = regNo.includes('DG') || delegateType === 'Clinician' || delegateType === 'Academician';
        
        let templateName = 'DELIGATES_ID_CARD.pdf';
        if (isPG) {
            templateName = 'PG_ID.pdf';
        } else if (isDelegate) {
            templateName = 'DELIGATES_ID_CARD.pdf';
        }

        const details = {
            studentName: student.name || student.participantName || "Student",
            iconId: student.midasId || "PENDING",
            registrationId: student.registrationId || "",
            qrData: `ICON ID: ${student.midasId || "N/A"}\nName: ${student.name || student.participantName || "N/A"}`,
            templateName
        };
        try {
            const pdfBytes = await generateIdCardPDF(details, coords);
            zip.file(`ID_Card_${student.midasId}.pdf`, pdfBytes);
        } catch (e) {
            console.error("Failed to generate ID card for", student.midasId, e);
        }
    }

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(zipBlob);
    link.download = `Bulk_ID_Cards_${new Date().toISOString().split('T')[0]}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
}
