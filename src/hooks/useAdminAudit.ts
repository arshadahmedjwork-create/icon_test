import { useState, useCallback, useEffect } from "react";
import { getAdminAuditLog, AuditEntry } from "@/services/adminAuditService";

/**
 * Custom hook for reactive access to the admin audit log.
 * Provides the audit entries and a manual refresh function.
 */
export function useAdminAudit() {
    const [entries, setEntries] = useState<AuditEntry[]>([]);

    const refresh = useCallback(async () => {
        try {
            const data = await getAdminAuditLog();
            setEntries(data);
        } catch (error) {
            console.error("Failed to refresh audit log:", error);
        }
    }, []);

    // Initial load
    useEffect(() => {
        refresh();
    }, [refresh]);

    return { entries, refresh } as const;
}
