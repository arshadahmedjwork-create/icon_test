import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import QRCode from 'qrcode';
import { cleanCertificateName } from '../lib/utils';

export interface CertificateDetails {
    certificateId: string;
    participantName: string;
    sessionName: string;
    role: 'student' | 'judge' | 'participation' | 'winner';
    date: string;
    eventName: string;
    type?: string;
}

export async function generateCertificatePDF(details: CertificateDetails): Promise<Uint8Array> {
    const certType = (details.type || details.role || 'participation').toLowerCase();
    const isPortrait = certType === 'judge';
    const width = isPortrait ? 595 : 842;
    const height = isPortrait ? 842 : 595;

    const pdfDoc = await PDFDocument.create();
    const firstPage = pdfDoc.addPage([width, height]);

    // Check if we are in Node environment (Vite config / server) or Browser
    const isNode = typeof window === 'undefined';
    let imageBytes: ArrayBuffer | Buffer;

    const imageName = isPortrait 
        ? 'judge_certificate.png' 
        : (certType === 'winner' ? 'appre_certificate.png' : 'Participation_Certificate.png');

    if (isNode) {
        const fs = await import('fs');
        const path = await import('path');
        const imagePath = path.resolve('public', imageName);
        if (fs.existsSync(imagePath)) {
            imageBytes = fs.readFileSync(imagePath);
        } else {
            throw new Error(`Template image not found at ${imagePath}`);
        }
    } else {
        const imageUrl = `/${imageName}`;
        const response = await fetch(imageUrl);
        if (!response.ok) {
            throw new Error(`Failed to load certificate template image: ${response.statusText}`);
        }
        imageBytes = await response.arrayBuffer();
    }

    const backgroundImage = await pdfDoc.embedPng(imageBytes);
    firstPage.drawImage(backgroundImage, {
        x: 0,
        y: 0,
        width: width,
        height: height
    });

    // QR code points to verify URL
    const verifyUrl = `https://portal.domain.com/certificate/verify/${details.certificateId}`;
    const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
        margin: 1,
        width: 150
    });
    const qrImage = await pdfDoc.embedPng(qrDataUrl);

    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);

    // Draw participant name centered on the underline space
    const nameText = cleanCertificateName(details.participantName);
    let nameFontSize = 28;
    let nameWidth = helveticaBold.widthOfTextAtSize(nameText, nameFontSize);
    let nameX = 0;

    if (!isPortrait) {
        // Align to the underline space (X from 280 to 720, center at 500)
        const minX = 280;
        const maxX = 720;
        const maxWidth = maxX - minX;

        while (nameWidth > maxWidth && nameFontSize > 14) {
            nameFontSize -= 1;
            nameWidth = helveticaBold.widthOfTextAtSize(nameText, nameFontSize);
        }
        nameX = minX + (maxWidth - nameWidth) / 2;
    } else {
        // For portrait, center on the page
        const maxWidth = width - 80;
        while (nameWidth > maxWidth && nameFontSize > 14) {
            nameFontSize -= 1;
            nameWidth = helveticaBold.widthOfTextAtSize(nameText, nameFontSize);
        }
        nameX = (width - nameWidth) / 2;
    }

    const nameY = isPortrait ? height * 0.52 : height * 0.545; // Aligns with name lines on templates

    firstPage.drawText(nameText, {
        x: nameX,
        y: nameY,
        size: nameFontSize,
        font: helveticaBold,
        color: rgb(0.12, 0.22, 0.4) // Navy theme color
    });

    // Draw metadata
    const certIdText = `Certificate ID: ${details.certificateId}`;
    const dateText = `Generated on: ${details.date}`;

    firstPage.drawText(certIdText, {
        x: 90,
        y: 35,
        size: 8,
        font: helveticaBold,
        color: rgb(0.2, 0.2, 0.2)
    });

    firstPage.drawText(dateText, {
        x: 90,
        y: 22,
        size: 8,
        font: helvetica,
        color: rgb(0.4, 0.4, 0.4)
    });

    // Draw QR code beside metadata in bottom corner
    firstPage.drawImage(qrImage, {
        x: 90 + helveticaBold.widthOfTextAtSize(certIdText, 8) + 15,
        y: 15,
        width: 32,
        height: 32
    });

    const pdfBytes = await pdfDoc.save();
    return pdfBytes;
}

