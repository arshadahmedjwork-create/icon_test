import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import QRCode from 'qrcode';
import { cleanCertificateName } from '../lib/utils';
import { supabase } from '../lib/supabaseClient';

export interface CertificateDetails {
    certificateId: string;
    participantName: string;
    sessionName: string;
    role: 'student' | 'judge' | 'participation' | 'winner';
    date: string;
    eventName: string;
    type?: string;
    rank?: number | string;
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

    let imageName = 'Participation_Certificate.jpg';
    if (isPortrait) {
        imageName = 'judge_certificate.png';
    } else if (certType === 'winner') {
        const rankNum = details.rank ? Number(details.rank) : 1;
        if (rankNum === 1) {
            imageName = 'first_place.png';
        } else if (rankNum === 2) {
            imageName = 'second_place.png';
        } else if (rankNum === 3) {
            imageName = 'third_place.png';
        } else {
            imageName = 'first_place.png'; // default fallback for winner
        }
    }

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
        const imageUrl = `/${imageName}?t=${Date.now()}`;
        const response = await fetch(imageUrl);
        if (!response.ok) {
            throw new Error(`Failed to load certificate template image: ${response.statusText}`);
        }
        imageBytes = await response.arrayBuffer();
    }

    const isJpg = imageName.toLowerCase().endsWith('.jpg') || imageName.toLowerCase().endsWith('.jpeg');
    const backgroundImage = isJpg ? await pdfDoc.embedJpg(imageBytes) : await pdfDoc.embedPng(imageBytes);
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
        // Landscape certificate: center perfectly on the page
        const maxWidth = width - 160;

        while (nameWidth > maxWidth && nameFontSize > 14) {
            nameFontSize -= 1;
            nameWidth = helveticaBold.widthOfTextAtSize(nameText, nameFontSize);
        }
        nameX = (width - nameWidth) / 2;
    } else {
        // For portrait, center on the page
        const maxWidth = width - 80;
        while (nameWidth > maxWidth && nameFontSize > 14) {
            nameFontSize -= 1;
            nameWidth = helveticaBold.widthOfTextAtSize(nameText, nameFontSize);
        }
        nameX = (width - nameWidth) / 2;
    }

    const nameY = isPortrait ? height * 0.52 : 280; // Adjusted for landscape to sit on the underline

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

export async function downloadCertificate(certificateId: string): Promise<void> {
    // 1. Fetch certificate metadata
    const { data: cert, error: certErr } = await supabase
        .from('certificates')
        .select('*')
        .eq('id', certificateId)
        .single();

    if (certErr || !cert) {
        throw new Error(certErr?.message || 'Certificate metadata not found.');
    }

    // Determine recipient details
    let recipientName = 'Attendee';
    const role = (cert.role || cert.certificateType || cert.type || 'participation').toLowerCase();
    const userId = cert.user_id || cert.eventStudentId;

    if (role === 'judge') {
        const { data: judge } = await supabase
            .from('judges')
            .select('fullName')
            .eq('id', userId)
            .single();
        if (judge) {
            recipientName = judge.fullName;
        }
    } else {
        const { data: student } = await supabase
            .from('event_students')
            .select('participantName')
            .eq('id', userId)
            .single();
        if (student) {
            recipientName = student.participantName;
        }
    }

    // Fetch session details
    let sessionName = 'Session Event';
    const sessionId = cert.session_id || cert.eventId;
    if (sessionId) {
        const { data: session } = await supabase
            .from('sessions')
            .select('name')
            .eq('id', sessionId)
            .single();
        if (session) {
            sessionName = session.name;
        }
    }

    // Generate PDF in memory using our existing generator
    const dateStr = new Date(cert.generatedAt || cert.generated_at || cert.createdAt || Date.now()).toLocaleDateString();
    const pdfBytes = await generateCertificatePDF({
        certificateId: cert.id,
        participantName: recipientName,
        sessionName: sessionName,
        role: role as any,
        date: dateStr,
        eventName: "MADRAS ICON'26",
        type: role,
        rank: cert.rank
    });

    // Create blob and trigger download
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `certificate_${certificateId}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);

    // Log downloaded status to certificate_audit_logs table
    await supabase.from('certificate_audit_logs').insert({
        userId: userId,
        sessionId: sessionId || null,
        action: 'DOWNLOADED',
        details: 'Downloaded via client-side web browser'
    });
}


