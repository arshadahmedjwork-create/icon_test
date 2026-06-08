/**
 * MIDAS Frontend Email Service
 * 
 * Client-side EmailJS integration for triggering emails from the frontend.
 * Uses a UNIFIED allocation template — the backend pre-renders mode-specific
 * HTML blocks (Online → Meet link, Offline → Venue card) before sending.
 * 
 * Setup Instructions:
 * 1. Go to https://www.emailjs.com/ and create an account
 * 2. Create a new email service (Gmail, Outlook, etc.)
 * 3. Create 2 email templates:
 *    - template_midas_reg   → paste from server/src/templates/registration-confirmation.html
 *    - template_midas_alloc → paste from server/src/templates/competition-allocation.html
 * 4. Replace the placeholder keys below with your actual keys
 */

// ─── EmailJS Configuration ───────────────────────────────────────────────────

const EMAILJS_CONFIG = {
    publicKey: import.meta.env.VITE_EMAILJS_PUBLIC_KEY || 'lrlURJI71d3rcNXHt',
    serviceId: import.meta.env.VITE_EMAILJS_SERVICE_ID || 'service_q8vimpl',
    templates: {
        registration: 'template_rt3pe6e',
        allocation: 'template_midas_alloc',  // Single unified template
        acceptance: 'template_midas_accpt',  // Provisional acceptance
        approval: 'template_rt3pe6e',    // Staff Approval with Temp Password
        account_creation: 'template_rt3pe6e', // For Judges, Core Team, etc.
    },
};

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RegistrationEmailData {
    student_name: string;
    student_email: string;
    midas_id: string;
    college_name: string;
    event_type: string;
    mode: string;
    qr_code_url: string;
    registration_date: string;
}

export interface ProvisionalAcceptanceEmailData {
    student_name: string;
    student_email: string;
    abstract_title: string;
    event_type: string;
    subject: string;
}

export interface ApprovalEmailData {
    student_name: string;
    student_email: string;
    temp_password: string;
    login_url: string;
}

export interface AccountCreationEmailData {
    user_name: string;
    user_email: string;
    temp_password: string;
    login_url: string;
    role?: string;
}

export async function sendAccountCreationEmail(data: AccountCreationEmailData) {
    console.log('[EmailService] Sending account creation credentials to:', data.user_email);
    
    // Choose template based on role:
    // UG, PG, Student, Academician, Clinician use template_rt3pe6e (student welcome)
    // Judge, Volunteer, Core Team, Admin, Staff Coordinator use template_h87xu0d (staff welcome)
    const normalizedRole = (data.role || '').toLowerCase();
    const isStaffRole = ['judge', 'volunteer', 'core_team', 'core_scientific_team', 'staff_coordinator', 'staff', 'admin'].some(r => normalizedRole.includes(r));
    
    const templateId = isStaffRole ? 'template_h87xu0d' : 'template_rt3pe6e';
    
    const templateParams = {
        to_email: data.user_email,
        student_email: data.user_email,
        to_name: data.user_name,
        user_name: data.user_name,
        student_name: data.user_name,
        role: normalizedRole.replace('_', ' '),
        temp_password: data.temp_password,
        login_url: data.login_url,
    };
    
    return sendEmailJS(templateId, templateParams);
}

export interface AllocationEmailData {
    student_name: string;
    student_email: string;
    midas_id: string;
    college_name: string;
    event_type: string;
    mode: string;              // "Online" | "Offline" — drives which sections appear
    subject_category: string;
    session_date: string;
    session_time: string;
    reporting_time: string;
    presentation_duration: string;
    qr_code_url: string;
    // Online
    gmeet_link?: string;
    // Offline
    venue_name?: string;
    hall_number?: string;
    institution_address?: string;
    coordinator_name?: string;
    coordinator_phone?: string;
}

// ─── QR Code URL Generator ──────────────────────────────────────────────────

export function generateQRCodeUrl(
    id: string,
    studentName: string,
    college: string,
    size: number = 300,
    program: string = 'MIDAS'
): string {
    const payload = `${program}|${id}|${studentName}|${college}`;
    const encodedPayload = encodeURIComponent(payload);
    return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodedPayload}&format=png&margin=10&color=1a1a2e&bgcolor=ffffff`;
}

// ─── ID Generator ─────────────────────────────────────────────────────

let clientSequence = 0;
export function generateMidasId(base?: string | number, program: string = 'MIDAS'): string {
    const year = new Date().getFullYear();
    const prefix = program === 'ICON' ? 'ICON' : 'MIDAS';
    let nextSeq = 1;

    if (typeof base === 'number') {
        nextSeq = base + 1;
    } else if (typeof base === 'string') {
        // Extract sequence from "PREFIX-YYYY-XXXX"
        const parts = base.split('-');
        if (parts.length === 3) {
            const lastSeq = parseInt(parts[2], 10);
            if (!isNaN(lastSeq)) {
                nextSeq = lastSeq + 1;
            }
        }
    } else {
        nextSeq = ++clientSequence;
    }

    const seqStr = nextSeq.toString().padStart(4, '0');
    return `${prefix}-${year}-${seqStr}`;
}

// ─── Mode-Specific HTML Builders (Client-side) ──────────────────────────────

function buildOnlineMeetSection(gmeetLink: string): string {
    return `
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:linear-gradient(135deg,#1e40af,#3b82f6);border-radius:12px;">
            <tr><td style="padding:24px;text-align:center;">
                <p style="font-size:12px;color:rgba(255,255,255,0.7);text-transform:uppercase;letter-spacing:1px;margin:0 0 12px;">🔗 Google Meet Link</p>
                <a href="${gmeetLink}" target="_blank" style="display:inline-block;background:#ffffff;color:#1e40af;font-size:14px;font-weight:700;padding:12px 32px;border-radius:8px;text-decoration:none;">Join Meeting →</a>
                <p style="font-size:11px;color:rgba(255,255,255,0.6);margin:12px 0 0;word-break:break-all;">${gmeetLink}</p>
            </td></tr>
        </table>`;
}

function buildOfflineVenueSection(data: AllocationEmailData): string {
    return `
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:linear-gradient(135deg,#166534,#15803d);border-radius:12px;">
            <tr><td style="padding:24px;">
                <p style="font-size:12px;color:rgba(255,255,255,0.7);text-transform:uppercase;letter-spacing:1px;margin:0 0 12px;">📍 Venue Details</p>
                <p style="font-size:18px;color:#ffffff;font-weight:700;margin:0 0 4px;">${data.venue_name}</p>
                <p style="font-size:14px;color:rgba(255,255,255,0.85);margin:0 0 4px;">Hall: <strong>${data.hall_number}</strong></p>
                <p style="font-size:13px;color:rgba(255,255,255,0.7);margin:0 0 16px;">${data.institution_address || ''}</p>
                <table role="presentation" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,0.15);border-radius:8px;width:100%;">
                    <tr><td style="padding:12px 16px;">
                        <p style="font-size:11px;color:rgba(255,255,255,0.7);margin:0 0 2px;">Onsite Coordinator</p>
                        <p style="font-size:13px;color:#ffffff;font-weight:600;margin:0;">${data.coordinator_name || ''} | ${data.coordinator_phone || ''}</p>
                    </td></tr>
                </table>
            </td></tr>
        </table>`;
}

// ─── EmailJS Send (via REST API) ─────────────────────────────────────────────

async function sendEmailJS(
    templateId: string,
    templateParams: Record<string, string>
): Promise<{ success: boolean; error?: string }> {
    try {
        const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                service_id: EMAILJS_CONFIG.serviceId,
                template_id: templateId,
                user_id: EMAILJS_CONFIG.publicKey,
                template_params: {
                    ...templateParams,
                    to_email: templateParams.student_email || templateParams.to_email,
                },
            }),
        });

        if (response.ok) {
            return { success: true };
        } else {
            const errorText = await response.text();
            return { success: false, error: `HTTP ${response.status}: ${errorText}` };
        }
    } catch (err) {
        return { success: false, error: (err as Error).message };
    }
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function sendRegistrationEmail(data: RegistrationEmailData) {
    console.log('[EmailService] Sending registration confirmation to:', data.student_email);
    return sendEmailJS(EMAILJS_CONFIG.templates.registration, data as unknown as Record<string, string>);
}

export async function sendProvisionalAcceptanceEmail(data: ProvisionalAcceptanceEmailData) {
    console.log('[EmailService] Sending provisional acceptance to:', data.student_email);
    return sendEmailJS(EMAILJS_CONFIG.templates.acceptance, data as unknown as Record<string, string>);
}

export interface AbstractStatusEmailData {
    student_name: string;
    student_email: string;
    abstract_title: string;
    status: string;
    remarks: string;
    program: string;
    login_url: string;
}

export async function sendAbstractStatusEmail(data: AbstractStatusEmailData) {
    console.log('[EmailService] Sending abstract evaluation status email to:', data.student_email);
    return sendEmailJS('template_n4x2ljs', data as unknown as Record<string, string>);
}

export async function sendApprovalEmail(data: ApprovalEmailData) {
    console.log('[EmailService] Sending registration approval to:', data.student_email);
    return sendEmailJS(EMAILJS_CONFIG.templates.approval, data as unknown as Record<string, string>);
}



export async function sendAllocationEmail(data: AllocationEmailData) {
    const isOnline = data.mode.toLowerCase() === 'online';

    // Pre-render mode-specific HTML sections
    const params: Record<string, string> = {
        ...(data as unknown as Record<string, string>),
        mode_icon: isOnline ? '🖥️' : '🏛️',
        mode_badge_color: isOnline ? 'rgba(59,130,246,0.8)' : 'rgba(22,101,52,0.8)',
        venue_or_meet_section: isOnline
            ? buildOnlineMeetSection(data.gmeet_link || '')
            : buildOfflineVenueSection(data),
        instructions_html: isOnline
            ? `<ul style="margin:0;padding-left:20px;color:#374151;font-size:13px;line-height:1.8;">
                <li style="margin-bottom:8px;">Join Google Meet <strong>15 minutes early</strong></li>
                <li style="margin-bottom:8px;">Keep PPT/PDF ready to share screen</li>
                <li style="margin-bottom:8px;">Ensure <strong>stable internet</strong> (min 5 Mbps)</li>
                <li style="margin-bottom:8px;">Use laptop with mic &amp; camera</li>
                <li>Keep MIDAS ID ready for verification</li>
              </ul>`
            : `<ul style="margin:0;padding-left:20px;color:#374151;font-size:13px;line-height:1.8;">
                <li style="margin-bottom:8px;">Carry <strong>valid photo ID proof</strong></li>
                <li style="margin-bottom:8px;">Bring presentation on <strong>USB drive</strong></li>
                <li style="margin-bottom:8px;"><strong>QR Code mandatory</strong> for venue entry</li>
                <li style="margin-bottom:8px;">Report <strong>30 minutes before</strong> your slot</li>
                <li>Contact onsite coordinator for help</li>
              </ul>`,
        instructions_bg_color: isOnline ? '#fefce8' : '#fef2f2',
        instructions_border_color: isOnline ? '#eab308' : '#ef4444',
        instructions_title_color: isOnline ? '#854d0e' : '#991b1b',
        instructions_title: isOnline
            ? '⚠️ Important Instructions — Online'
            : '🚨 Mandatory Requirements — Offline',
        qr_title: isOnline ? 'Your QR Code for Verification' : '⚠️ QR CODE MANDATORY FOR ENTRY',
        qr_description: isOnline
            ? 'Keep accessible for identity verification during the session'
            : 'Screenshot this QR or keep it on your phone — required at venue entry',
    };

    console.log(`[EmailService] Sending ${data.mode} allocation email to:`, data.student_email);
    return sendEmailJS(EMAILJS_CONFIG.templates.allocation, params);
}

/**
 * Send email via backend API (preferred — includes retry + dead-letter queue).
 * Falls back to client-side EmailJS if backend is unreachable.
 */
export async function sendViaBackend(
    endpoint: 'registration' | 'allocation',
    data: RegistrationEmailData | AllocationEmailData
): Promise<{ success: boolean; data?: unknown; error?: string }> {
    try {
        const response = await fetch(`/api/email/${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        const result = await response.json();

        if (response.ok) {
            return { success: true, data: result };
        } else {
            console.warn('[EmailService] Backend failed, falling back to client-side EmailJS');
            return endpoint === 'registration'
                ? sendRegistrationEmail(data as RegistrationEmailData)
                : sendAllocationEmail(data as AllocationEmailData);
        }
    } catch {
        console.warn('[EmailService] Backend unreachable, using client-side EmailJS');
        return endpoint === 'registration'
            ? sendRegistrationEmail(data as RegistrationEmailData)
            : sendAllocationEmail(data as AllocationEmailData);
    }
}
