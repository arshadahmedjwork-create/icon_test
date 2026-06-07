import { createClient } from "@supabase/supabase-js";
import { generateCertificatePDF } from "./certificateEngine";
import { logCertificateAction } from "./supabaseService";
import { generateSignedUrl } from "./signedUrlHelper";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://fzxtxumrmhudvzhxvawa.supabase.co";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const EMAILJS_CONFIG = {
    publicKey: import.meta.env.VITE_EMAILJS_PUBLIC_KEY || 'lrlURJI71d3rcNXHt',
    serviceId: import.meta.env.VITE_EMAILJS_SERVICE_ID || 'service_q8vimpl',
    templateId: 'template_wuprf28', // certificate template
};

// Helper function to send email via EmailJS with attachment
async function sendCertificateEmailJS(
    toEmail: string,
    toName: string,
    pdfBase64: string,
    certificateType: string,
    eventName: string,
    certificateUrl: string,
    program: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const type = (certificateType || '').toLowerCase();
        let subject = `Your Official Certificate - ${program} 2026`;
        let greeting = `Dear ${toName}`;
        let body = `Thank you for your participation in ${program} 2026. Your certificate has been generated successfully.`;
        let message = `Dear ${toName},\n\nThank you for participating in ${program}.\n\nYour certificate is attached.\n\nRegards,\nOrganising Committee`;

        if (type === 'judge') {
            subject = `Certificate of Appreciation - Judge - ${program} 2026`;
            greeting = `Dear Dr. ${toName}`;
            body = `Thank you for your invaluable contribution as a scientific judge in the proceedings of ${program} 2026. Your official certificate of appreciation has been generated and digitally registered.`;
            message = `Dear Dr. ${toName},\n\nThank you for your valuable contribution as a judge at ${program} 2026.\n\nYour certificate is attached.\n\nRegards,\nOrganising Committee`;
        } else if (type === 'winner') {
            subject = `Official Certificate of Excellence - Winner - ${program} 2026`;
            greeting = `Congratulations, ${toName}`;
            body = `Congratulations on securing a winning position in the scientific proceedings of ${program} 2026. Your official certificate of excellence has been generated and digitally registered.`;
            message = `Dear ${toName},\n\nCongratulations on winning a prize at ${program} 2026!\n\nYour certificate is attached.\n\nRegards,\nOrganising Committee`;
        } else {
            subject = `Your Official Certificate of Participation - ${program} 2026`;
            greeting = `Congratulations, ${toName}`;
            body = `Thank you for your valuable participation and academic contribution to the scientific proceedings of ${program} 2026. Your official participation certificate has been generated and digitally registered.`;
            message = `Dear ${toName},\n\nThank you for participating in ${program} 2026.\n\nYour certificate is attached.\n\nRegards,\nOrganising Committee`;
        }

        const emailParams = {
            to_email: toEmail,
            student_email: toEmail,
            student_name: toName,
            to_name: toName,
            subject: subject,
            message: message,
            event_name: eventName,
            certificate_url: certificateUrl,
            program: program,
            greeting: greeting,
            body: body,
            // Pass base64 attachment in parameter (Supported by EmailJS file parameter/attachments array depending on template settings)
            certificate_attachment: pdfBase64,
        };

        const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                service_id: EMAILJS_CONFIG.serviceId,
                template_id: EMAILJS_CONFIG.templateId,
                user_id: EMAILJS_CONFIG.publicKey,
                template_params: emailParams,
            }),
        });

        if (response.ok) {
            return { success: true };
        } else {
            const errorText = await response.text();
            return { success: false, error: errorText };
        }
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

// Convert Uint8Array to base64 string
function uint8ArrayToBase64(arr: Uint8Array): string {
    let binary = '';
    const len = arr.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(arr[i]);
    }
    return window.btoa(binary);
}

export interface EmailWorkerResult {
    userId: string;
    email: string;
    success: boolean;
    error?: string;
}

// Lightweight queue processing with concurrency limit
export async function triggerCertificateDistribution(
    sessionId: string,
    program: string = "MIDAS",
    concurrencyLimit: number = 5
): Promise<EmailWorkerResult[]> {
    console.log(`[EmailWorker] Starting certificate distribution for session: ${sessionId}`);

    // 1. Fetch certificates that haven't been emailed yet for this session
    const { data: certs, error: certsErr } = await supabase
        .from('certificates')
        .select('*')
        .eq('session_id', sessionId)
        .eq('email_sent', false);

    if (certsErr || !certs || certs.length === 0) {
        console.log(`[EmailWorker] No pending certificates to email for session ${sessionId}`);
        return [];
    }

    const results: EmailWorkerResult[] = [];
    
    // Process certificates in batches/pool of concurrent workers
    const pendingCerts = [...certs];
    const activePromises: Promise<void>[] = [];

    const processNext = async (): Promise<void> => {
        if (pendingCerts.length === 0) return;
        const cert = pendingCerts.shift()!;
        
        const userId = cert.user_id || cert.eventStudentId;
        const role = cert.role || cert.certificateType?.toLowerCase() || 'student';
        
        let recipientName = "Attendee";
        let recipientEmail = "";

        try {
            // Get user details
            if (role === 'judge') {
                const { data: judge } = await supabase
                    .from('judges')
                    .select('fullName, memberId')
                    .eq('id', userId)
                    .single();
                if (judge) {
                    recipientName = judge.fullName;
                    const { data: member } = await supabase
                        .from('members')
                        .select('email')
                        .eq('id', judge.memberId)
                        .single();
                    if (member) {
                        recipientEmail = member.email;
                    }
                }
            } else {
                const { data: student } = await supabase
                    .from('event_students')
                    .select('participantName, email')
                    .eq('id', userId)
                    .single();
                if (student) {
                    recipientName = student.participantName;
                    recipientEmail = student.email;
                }
            }

            if (!recipientEmail) {
                throw new Error("Could not find recipient email");
            }

            // Fetch session details
            const { data: session } = await supabase
                .from('sessions')
                .select('name')
                .eq('id', sessionId)
                .single();
            const sessionName = session?.name || "MIDAS / IDA Session";

            // Generate PDF in memory
            const pdfBytes = await generateCertificatePDF({
                certificateId: cert.id,
                participantName: recipientName,
                sessionName: sessionName,
                role: role as 'student' | 'judge',
                date: new Date(cert.generatedAt || cert.generated_at || Date.now()).toLocaleDateString(),
                eventName: "MADRAS ICON'26"
            });

            // Convert to Base64
            const base64Pdf = uint8ArrayToBase64(pdfBytes);

            // Send email
            const certificateUrl = window.location.origin + generateSignedUrl(cert.id);
            const emailRes = await sendCertificateEmailJS(
                recipientEmail,
                recipientName,
                base64Pdf,
                cert.certificateType,
                sessionName,
                certificateUrl,
                program
            );

            if (emailRes.success) {
                // Update certificates metadata
                await supabase
                    .from('certificates')
                    .update({ email_sent: true })
                    .eq('id', cert.id);
                
                await logCertificateAction(userId, sessionId, 'EMAILED', `Emailed successfully to ${recipientEmail}`);
                
                results.push({ userId, email: recipientEmail, success: true });
            } else {
                throw new Error(emailRes.error || "EmailJS failed");
            }
        } catch (err: any) {
            console.error(`[EmailWorker] Failed for cert ${cert.id}:`, err);
            await logCertificateAction(userId, sessionId, 'EMAILED_FAILED', `Failed to send email to ${recipientEmail || 'unknown'}: ${err.message}`);
            results.push({ userId, email: recipientEmail, success: false, error: err.message });
        }

        // Continue processing
        return processNext();
    };

    // Initialize the concurrent workers pool
    for (let i = 0; i < Math.min(concurrencyLimit, pendingCerts.length); i++) {
        activePromises.push(processNext());
    }

    await Promise.all(activePromises);
    console.log(`[EmailWorker] Finished certificate distribution for session: ${sessionId}. Total: ${results.length}`);
    return results;
}

export async function sendSingleCertificateEmail(
    certificateId: string,
    program: string = "MIDAS"
): Promise<{ success: boolean; error?: string }> {
    try {
        const { data: cert, error: certErr } = await supabase
            .from('certificates')
            .select('*')
            .eq('id', certificateId)
            .single();

        if (certErr || !cert) {
            throw new Error(certErr?.message || "Certificate not found");
        }

        const userId = cert.user_id || cert.eventStudentId;
        const role = cert.role || cert.certificateType?.toLowerCase() || 'student';
        
        let recipientName = "Attendee";
        let recipientEmail = "";

        if (role === 'judge') {
            const { data: judge } = await supabase
                .from('judges')
                .select('fullName, memberId')
                .eq('id', userId)
                .single();
            if (judge) {
                recipientName = judge.fullName;
                const { data: member } = await supabase
                    .from('members')
                    .select('email')
                    .eq('id', judge.memberId)
                    .single();
                if (member) {
                    recipientEmail = member.email;
                }
            }
        } else {
            const { data: student } = await supabase
                .from('event_students')
                .select('participantName, email')
                .eq('id', userId)
                .single();
            if (student) {
                recipientName = student.participantName;
                recipientEmail = student.email;
            }
        }

        if (!recipientEmail) {
            throw new Error("Could not find recipient email");
        }

        const sessionId = cert.session_id || cert.eventId;
        let sessionName = "MIDAS / IDA Session";
        if (sessionId) {
            const { data: session } = await supabase
                .from('sessions')
                .select('name')
                .eq('id', sessionId)
                .single();
            if (session?.name) {
                sessionName = session.name;
            }
        }

        const pdfBytes = await generateCertificatePDF({
            certificateId: cert.id,
            participantName: recipientName,
            sessionName: sessionName,
            role: role as 'student' | 'judge',
            date: new Date(cert.generatedAt || cert.generated_at || Date.now()).toLocaleDateString(),
            eventName: "MADRAS ICON'26"
        });

        const base64Pdf = uint8ArrayToBase64(pdfBytes);
        const certificateUrl = window.location.origin + generateSignedUrl(cert.id);
        const emailRes = await sendCertificateEmailJS(
            recipientEmail,
            recipientName,
            base64Pdf,
            cert.certificateType,
            sessionName,
            certificateUrl,
            program
        );

        if (emailRes.success) {
            await supabase
                .from('certificates')
                .update({ email_sent: true })
                .eq('id', cert.id);
            
            await logCertificateAction(userId, sessionId, 'EMAILED', `Emailed successfully to ${recipientEmail} (Manual Resend)`);
            return { success: true };
        } else {
            throw new Error(emailRes.error || "EmailJS failed");
        }
    } catch (err: any) {
        console.error(`[EmailWorker] Failed for cert ${certificateId}:`, err);
        return { success: false, error: err.message };
    }
}
