import { useEffect, useState } from "react";
import { useAdminAudit } from "@/hooks/useAdminAudit";
import { AuditEntry, getActionLogs } from "@/services/adminAuditService";
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
import { Shield, Clock, LogIn, LogOut, RefreshCw, Activity, Database, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
    const [actionLogs, setActionLogs] = useState<any[]>([]);
    const [loadingActions, setLoadingActions] = useState(false);

    const loadActionData = async () => {
        setLoadingActions(true);
        const logs = await getActionLogs();
        setActionLogs(logs);
        setLoadingActions(false);
    };

    // Auto-refresh every 30 seconds for reactivity
    useEffect(() => {
        loadActionData();
        const interval = setInterval(() => {
            refresh();
            loadActionData();
        }, 30000);
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
                        Track admin activity and system structural changes.
                    </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => { refresh(); loadActionData(); }}>
                    <RefreshCw className={`w-4 h-4 mr-2 ${loadingActions ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
            </div>

            <Tabs defaultValue="sessions" className="w-full">
                <TabsList className="bg-slate-100 p-1 rounded-xl mb-4">
                    <TabsTrigger value="sessions" className="rounded-lg px-6 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                        <LogIn className="w-4 h-4 mr-2" /> Login Sessions
                    </TabsTrigger>
                    <TabsTrigger value="actions" className="rounded-lg px-6 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                        <Activity className="w-4 h-4 mr-2" /> System Actions
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="sessions">
                    {/* Summary Cards */}
                    <div className="grid gap-4 sm:grid-cols-3 mb-6">
                        <Card className="rounded-2xl border-none shadow-sm bg-white">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">Total Sessions</CardTitle>
                                <Clock className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{totalSessions}</div>
                            </CardContent>
                        </Card>
                        <Card className="rounded-2xl border-none shadow-sm bg-white">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">Active Sessions</CardTitle>
                                <div className="relative">
                                    <LogIn className="h-4 w-4 text-green-500" />
                                    {activeCount > 0 && <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full animate-pulse" />}
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-green-600">{activeCount}</div>
                            </CardContent>
                        </Card>
                        <Card className="rounded-2xl border-none shadow-sm bg-white">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">Completed</CardTitle>
                                <LogOut className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{totalSessions - activeCount}</div>
                            </CardContent>
                        </Card>
                    </div>

                    <Card className="rounded-2xl border-none shadow-sm">
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader>
                                    <TableRow className="hover:bg-transparent">
                                        <TableHead className="px-6 py-4">Admin</TableHead>
                                        <TableHead>Login Time</TableHead>
                                        <TableHead>Logout Time</TableHead>
                                        <TableHead>Duration</TableHead>
                                        <TableHead className="text-right pr-6">Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {entries.length === 0 ? (
                                        <TableRow><TableCell colSpan={5} className="text-center h-32 text-muted-foreground">No sessions yet</TableCell></TableRow>
                                    ) : (
                                        entries.map((entry: AuditEntry) => (
                                            <TableRow key={entry.id}>
                                                <TableCell className="px-6">
                                                    <div className="font-bold text-slate-900">{entry.adminName}</div>
                                                    <div className="text-xs text-slate-500">{entry.adminEmail}</div>
                                                </TableCell>
                                                <TableCell>{formatDateTime(entry.loginTime)}</TableCell>
                                                <TableCell>{entry.logoutTime ? formatDateTime(entry.logoutTime) : <span className="text-xs italic text-slate-400">Still active</span>}</TableCell>
                                                <TableCell className="font-mono text-xs">{entry.sessionDuration || "—"}</TableCell>
                                                <TableCell className="text-right pr-6">
                                                    {entry.logoutTime ? <Badge variant="secondary" className="bg-slate-100 text-slate-500 border-none">Completed</Badge> : <Badge className="bg-emerald-100 text-emerald-700 border-none">Active</Badge>}
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="actions">
                    <Card className="rounded-2xl border-none shadow-sm overflow-hidden">
                        <CardContent className="p-0 text-xs">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-slate-50/50">
                                        <TableHead className="px-6">Actor</TableHead>
                                        <TableHead>Action</TableHead>
                                        <TableHead>Resource</TableHead>
                                        <TableHead>Details</TableHead>
                                        <TableHead className="text-right pr-6">Timestamp</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {actionLogs.length === 0 ? (
                                        <TableRow><TableCell colSpan={5} className="text-center h-32 text-muted-foreground">No actions recorded yet</TableCell></TableRow>
                                    ) : (
                                        actionLogs.map((log: any) => (
                                            <TableRow key={log.id} className="hover:bg-slate-50/50">
                                                <TableCell className="px-6 py-4">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                                                            <User className="w-4 h-4 text-slate-500" />
                                                        </div>
                                                        <div>
                                                            <div className="font-bold text-slate-900">{log.actor_name}</div>
                                                            <div className="opacity-60 text-[10px] uppercase font-bold tracking-wider">{log.actor_role}</div>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge className={`${log.action.includes('CREATE') ? 'bg-blue-50 text-blue-700' : log.action.includes('DELETE') ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'} border-none rounded-md px-1.5`}>
                                                        {log.action}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-1.5 py-1 px-2 bg-slate-100 rounded-md w-fit">
                                                        <Database className="w-3 h-3 text-slate-500" />
                                                        <span className="font-mono text-[11px]">{log.resource_type}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="max-w-[200px] truncate">
                                                    {log.metadata ? JSON.stringify(log.metadata) : '—'}
                                                </TableCell>
                                                <TableCell className="text-right pr-6 text-slate-500">
                                                    {formatDateTime(log.timestamp)}
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
