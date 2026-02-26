import { useEffect } from "react";
import { useAdminAudit } from "@/hooks/useAdminAudit";
import { AuditEntry } from "@/services/adminAuditService";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, Clock, LogIn, LogOut, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

function formatDateTime(iso: string | null): string {
    if (!iso) return "—";
    return new Date(iso).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
    });
}

export default function AuditLog() {
    const { entries, refresh } = useAdminAudit();

    // Auto-refresh every 30 seconds for reactivity
    useEffect(() => {
        const interval = setInterval(refresh, 30000);
        return () => clearInterval(interval);
    }, [refresh]);

    const activeCount = entries.filter((e: AuditEntry) => !e.logoutTime).length;
    const totalSessions = entries.length;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold font-display flex items-center gap-2">
                        <Shield className="h-6 w-6 text-primary" />
                        Audit Log
                    </h2>
                    <p className="text-muted-foreground">
                        Track admin login/logout activity and session durations.
                    </p>
                </div>
                <Button variant="outline" size="sm" onClick={refresh}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Refresh
                </Button>
            </div>

            {/* Summary Cards */}
            <div className="grid gap-4 sm:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Total Sessions
                        </CardTitle>
                        <Clock className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalSessions}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            All recorded admin sessions
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Active Sessions
                        </CardTitle>
                        <div className="relative">
                            <LogIn className="h-4 w-4 text-green-500" />
                            {activeCount > 0 && (
                                <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                            )}
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">
                            {activeCount}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Currently logged in
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Completed Sessions
                        </CardTitle>
                        <LogOut className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {totalSessions - activeCount}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Logged out properly
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Audit Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Session History</CardTitle>
                    <CardDescription>
                        Detailed record of all admin login and logout events.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="border rounded-lg overflow-hidden">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Admin</TableHead>
                                    <TableHead>Login Time</TableHead>
                                    <TableHead>Logout Time</TableHead>
                                    <TableHead>Duration</TableHead>
                                    <TableHead className="text-right">Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {entries.length === 0 ? (
                                    <TableRow>
                                        <TableCell
                                            colSpan={5}
                                            className="text-center h-32 text-muted-foreground"
                                        >
                                            <div className="flex flex-col items-center gap-2">
                                                <Shield className="h-8 w-8 opacity-20" />
                                                <p className="font-medium">No audit entries yet</p>
                                                <p className="text-xs">
                                                    Admin login/logout events will appear here
                                                    automatically.
                                                </p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    entries.map((entry: AuditEntry) => (
                                        <TableRow key={entry.id}>
                                            <TableCell>
                                                <div className="font-medium">{entry.adminName}</div>
                                                <div className="text-xs text-muted-foreground">
                                                    {entry.adminEmail}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-1.5">
                                                    <LogIn className="h-3.5 w-3.5 text-green-500" />
                                                    <span className="text-sm">
                                                        {formatDateTime(entry.loginTime)}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {entry.logoutTime ? (
                                                    <div className="flex items-center gap-1.5">
                                                        <LogOut className="h-3.5 w-3.5 text-red-400" />
                                                        <span className="text-sm">
                                                            {formatDateTime(entry.logoutTime)}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-muted-foreground italic">
                                                        Still logged in
                                                    </span>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <span className="text-sm font-mono">
                                                    {entry.sessionDuration || "—"}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {entry.logoutTime ? (
                                                    <Badge
                                                        variant="secondary"
                                                        className="text-xs bg-slate-100 text-slate-600"
                                                    >
                                                        Completed
                                                    </Badge>
                                                ) : (
                                                    <Badge className="text-xs bg-green-100 text-green-700 border-green-200">
                                                        Active
                                                    </Badge>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
