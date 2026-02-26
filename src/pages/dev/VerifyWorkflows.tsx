import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getEventConfig, getUsers, getAbstracts, getSessions } from "@/services/supabaseService";

export default function VerifyWorkflows() {
    const { user, login } = useAuth();
    const [logs, setLogs] = useState<string[]>([]);

    const log = (msg: string) => setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);

    const runDataCheck = async () => {
        const [users, abstracts, sessions, config] = await Promise.all([
            getUsers(),
            getAbstracts(),
            getSessions(),
            getEventConfig()
        ]);

        log(`Total Users: ${users.length}`);
        log(`Total Abstracts: ${abstracts.length}`);
        log(`Total Sessions: ${sessions.length}`);

        // Check Capacity
        const paperOnlineEvents = users.filter(u => u.role === "student" && u.selectedEvents?.some((e: any) => e.type === "Paper Presentation" && e.mode === "Online"));
        log(`Paper Online Enrollment: ${paperOnlineEvents.length} / ${config.capacities.paperOnline}`);

        // Check Conflicts
        // (Simplified check)
        sessions.forEach(s => {
            if (s.judges && s.judges.length < 3) log(`WARNING: Session ${s.name} has fewer than 3 judges.`);
        });
    };

    return (
        <div className="p-8 space-y-6">
            <h1 className="text-2xl font-bold">Workflow Verification Dashboard</h1>

            <div className="grid grid-cols-2 gap-6">
                <Card>
                    <CardHeader><CardTitle>System Health Check</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <Button onClick={runDataCheck} className="w-full">Run Data Integrity Check</Button>
                        <div className="bg-black/90 text-green-400 font-mono p-4 rounded-md h-64 overflow-y-auto text-sm">
                            {logs.map((l, i) => <div key={i}>{l}</div>)}
                            {logs.length === 0 && <span className="text-gray-500">Ready to run checks...</span>}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader><CardTitle>Quick Role Switch</CardTitle></CardHeader>
                    <CardContent className="grid gap-2">
                        <Button variant="outline" onClick={() => login("student@example.com", "password")}>Login as Student</Button>
                        <Button variant="outline" onClick={() => login("staff@example.com", "password")}>Login as Staff</Button>
                        <Button variant="outline" onClick={() => login("judge@example.com", "password")}>Login as Judge</Button>
                        <Button variant="outline" onClick={() => login("volunteer@example.com", "password")}>Login as Volunteer</Button>
                        <Button variant="outline" onClick={() => login("admin@example.com", "admin123")}>Login as Admin</Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
