/**
 * Admin Audit Service
 * Tracks admin login/logout events with session duration.
 * Uses Supabase (audit_logs table) for persistent logging.
 */

import { supabase } from "@/lib/supabaseClient";

export interface AuditEntry {
    id: string;
    sessionId: string;
    adminName: string;
    adminEmail: string;
    loginTime: string;
    logoutTime: string | null;
    sessionDuration: string | null;
}

const SESSION_KEY = "midas_admin_session_id";
const DB_UUID_KEY = "midas_admin_audit_id"; // To track the DB record ID for logout

/**
 * Record a new admin login event.
 * Prevents duplicate entries for the same browser session via sessionStorage.
 */
export async function recordAdminLogin(adminName: string, adminEmail: string): Promise<string> {
    // Check if a session is already active in this tab
    const existingSessionId = sessionStorage.getItem(SESSION_KEY);
    if (existingSessionId) {
        return existingSessionId;
    }

    const sessionId = crypto.randomUUID();
    const loginTime = new Date().toISOString();

    const { data, error } = await supabase.from('audit_logs').insert({
        session_id: sessionId,
        admin_name: adminName,
        admin_email: adminEmail,
        login_time: loginTime
    }).select('id').single();

    if (error) {
        console.error("Failed to log admin login:", error);
        // Fallback: don't block login if audit fails, but log error
        return sessionId;
    }

    // Store session ID and DB record ID in sessionStorage
    sessionStorage.setItem(SESSION_KEY, sessionId);
    if (data) {
        sessionStorage.setItem(DB_UUID_KEY, data.id);
    }

    return sessionId;
}

/**
 * Record admin logout by updating the matching audit entry.
 */
export async function recordAdminLogout(): Promise<void> {
    const dbId = sessionStorage.getItem(DB_UUID_KEY);
    if (!dbId) return;

    const logoutTime = new Date().toISOString();

    // We need login time to calculate duration or just store logout time and calculate on read/display.
    // However, DB can just store logout_time.
    // Let's fetch the login time first to compute duration, or compute it in UI.
    // For simplicity, let's update logout_time and let UI compute duration.
    // But existing UI expects 'sessionDuration'.
    // Let's fetch the record.
    const { data: entry } = await supabase.from('audit_logs').select('login_time').eq('id', dbId).single();

    let duration = null;
    if (entry) {
        duration = computeDuration(entry.login_time, logoutTime);
    }

    await supabase.from('audit_logs').update({
        logout_time: logoutTime,
        duration: duration
    }).eq('id', dbId);

    // Clear session markers
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(DB_UUID_KEY);
}

function computeDuration(loginISO: string, logoutISO: string): string {
    const loginMs = new Date(loginISO).getTime();
    const logoutMs = new Date(logoutISO).getTime();
    const diffMs = Math.max(logoutMs - loginMs, 0);

    const totalSeconds = Math.floor(diffMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
}

/**
 * Get the full audit log, sorted newest-first.
 */
export async function getAdminAuditLog(): Promise<AuditEntry[]> {
    const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .order('login_time', { ascending: false });

    if (error) {
        console.error("Failed to fetch audit logs:", error);
        return [];
    }

    return data.map((log: any) => ({
        id: log.id,
        sessionId: log.session_id,
        adminName: log.admin_name,
        adminEmail: log.admin_email,
        loginTime: log.login_time,
        logoutTime: log.logout_time,
        sessionDuration: log.duration
    }));
}

export function hasActiveAdminSession(): boolean {
    return sessionStorage.getItem(SESSION_KEY) !== null;
}

/**
 * Log a structural action (Create/Update/Delete) by an Admin or Core Team member.
 */
export async function logAction(
    action: string, 
    resourceType: string, 
    resourceId?: string, 
    metadata: any = {}
): Promise<void> {
    // Current user context
    const userJson = localStorage.getItem("midas_user");
    if (!userJson) return;

    try {
        const user = JSON.parse(userJson);
        const { error } = await supabase.from('action_logs').insert({
            actor_id: user.id,
            actor_name: user.name,
            actor_role: user.role,
            action,
            resource_type: resourceType,
            resource_id: resourceId,
            metadata
        });

        if (error) console.error("Failed to log action:", error);
    } catch (e) {
        console.error("Error parsing user for audit log:", e);
    }
}

/**
 * Get the full action log (structural changes).
 */
export async function getActionLogs(): Promise<any[]> {
    const { data, error } = await supabase
        .from('action_logs')
        .select('*')
        .order('timestamp', { ascending: false });

    if (error) {
        console.error("Failed to fetch action logs:", error);
        return [];
    }

    return data;
}
