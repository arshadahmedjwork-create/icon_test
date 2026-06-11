import { useState, useEffect } from "react";
import {
    getEventStudents,
    getAbstracts,
    getSessions
} from "@/services/supabaseService";
import { User, Abstract, Session, Student } from "@/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, PieChart, BarChart, Users, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useProgram } from "@/contexts/ProgramContext";

export default function Reports() {
    const [stats, setStats] = useState({
        totalUsers: 0,
        students: 0,
        registered: 0,
        paid: 0,
        abstracts: 0,
        sessions: 0
    });
    const { currentProgram } = useProgram();
    const isIcon = currentProgram === 'ICON';

    useEffect(() => {
        const loadStats = async () => {
            try {
                const [students, abstracts, sessions] = await Promise.all([
                    getEventStudents(currentProgram),
                    getAbstracts(currentProgram),
                    getSessions(currentProgram)
                ]);

                setStats({
                    totalUsers: students.length,
                    students: students.length,
                    registered: students.filter((s: any) => s.approvalStatus === "APPROVED" || s.paymentStatus === "PAID").length,
                    paid: students.filter((s: any) => s.paymentStatus === "PAID").length,
                    abstracts: abstracts.length,
                    sessions: sessions.length
                });
            } catch (error) {
                console.error("Failed to load reports data", error);
            }
        };

        loadStats();
    }, [currentProgram]);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-bold font-display">{isIcon ? 'Madras ICON' : 'MIDAS'} System Reports</h2>
                    <p className="text-muted-foreground">Overview of {isIcon ? 'ICON' : 'MIDAS'} event participation and status.</p>
                </div>
                <Button variant="outline">
                    <Download className="w-4 h-4 mr-2" /> Download Full Report
                </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Registrations</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.registered} / {stats.students}</div>
                        <p className="text-xs text-muted-foreground">
                            Approved/Completed registrations vs Total Signups
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Payments Completed</CardTitle>
                        <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">₹ Revenue</Badge>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.paid}</div>
                        <p className="text-xs text-muted-foreground">
                            Students with successful payments
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Abstract Submissions</CardTitle>
                        <FileText className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.abstracts}</div>
                        <p className="text-xs text-muted-foreground">
                            Total abstracts submitted for review
                        </p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Session Stats</CardTitle>
                        <CardDescription>Breakdown by session status</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-center h-40 bg-muted/20 rounded-lg border border-dashed">
                            <div className="text-center">
                                <BarChart className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                                <span className="text-sm font-medium">{stats.sessions} Sessions Scheduled</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Demographics</CardTitle>
                        <CardDescription>Participation by college/role</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-center h-40 bg-muted/20 rounded-lg border border-dashed">
                            <div className="text-center">
                                <PieChart className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                                <span className="text-sm font-medium">Chart Placeholder</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

// Helper icons removed - using lucide-react imports instead
