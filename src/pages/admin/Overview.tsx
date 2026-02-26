import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { BarChart3, Users, FileText, Calendar, ArrowUpRight, Plus, Download, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getDashboardStats } from "@/services/supabaseService";

interface RecentRegistration {
    id: string;
    participantName: string;
    email: string;
    college: string;
    registeredAt: string;
    paymentStatus: string;
    approvalStatus: string;
}

export default function AdminOverview() {
    const navigate = useNavigate();
    const [stats, setStats] = useState([
        { label: "Total Registrations", value: "0", change: "+0%", icon: Users, trend: "neutral" },
        { label: "Payments Collected", value: "₹0", change: "+0%", icon: BarChart3, trend: "neutral" },
        { label: "Active Sessions", value: "0", change: "Scheduled", icon: Calendar, trend: "neutral" },
        { label: "Abstracts Submitted", value: "0", change: "+0%", icon: FileText, trend: "neutral" },
    ]);
    const [recentUsers, setRecentUsers] = useState<RecentRegistration[]>([]);

    useEffect(() => {
        const loadDashboard = async () => {
            try {
                const data = await getDashboardStats();

                setStats([
                    { label: "Total Registrations", value: data.totalStudents.toString(), change: "+12%", icon: Users, trend: "up" },
                    { label: "Payments Collected", value: `₹${Number(data.totalRevenue).toLocaleString()}`, change: "+8%", icon: BarChart3, trend: "up" },
                    { label: "Total Sessions", value: data.totalSessions.toString(), change: "Scheduled", icon: Calendar, trend: "neutral" },
                    { label: "Pending Abstracts", value: data.pendingAbstracts.toString(), change: "+5%", icon: FileText, trend: "up" },
                ]);

                setRecentUsers(data.recentRegistrations || []);
            } catch (error) {
                console.error("Failed to load dashboard", error);
            }
        };
        loadDashboard();
    }, []);

    const quickActions = [
        { label: "Add Judge", icon: Plus, action: () => navigate("/dashboard/admin/judges?action=add") },
        { label: "Event Config", icon: Calendar, action: () => navigate("/dashboard/admin/events") },
        { label: "Generate Report", icon: Download, action: () => navigate("/dashboard/admin/reports") },
        { label: "Certificates", icon: Send, action: () => navigate("/dashboard/admin/certificates") },
    ];

    const formatTime = (dateStr?: string) => {
        if (!dateStr) return "Unknown";
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        if (diffMins < 60) return `${diffMins}m ago`;
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `${diffHours}h ago`;
        return `${Math.floor(diffHours / 24)}d ago`;
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-1">
                <h1 className="font-display text-2xl font-bold tracking-tight">Admin Dashboard</h1>
                <p className="text-muted-foreground">Welcome back. Here's what's happening today.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {stats.map((stat) => (
                    <Card key={stat.label}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">
                                {stat.label}
                            </CardTitle>
                            <stat.icon className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stat.value}</div>
                            <p className="text-xs text-muted-foreground mt-1 flex items-center">
                                {stat.trend === "up" && <ArrowUpRight className="w-3 h-3 mr-1 text-green-500" />}
                                <span className={stat.trend === "up" ? "text-green-500 font-medium" : ""}>{stat.change}</span>
                                {stat.trend === "up" && <span className="ml-1 text-muted-foreground">from last month</span>}
                            </p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="grid gap-6 lg:grid-cols-7">
                <Card className="lg:col-span-4">
                    <CardHeader>
                        <CardTitle>Recent Registrations</CardTitle>
                        <CardDescription>Latest student signups awaiting approval.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {recentUsers.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No recent registrations.</p>
                            ) : (
                                recentUsers.map((s, i) => (
                                    <div key={i} className="flex items-center justify-between p-3 rounded-lg border bg-card/50 hover:bg-accent/10 transition-colors">
                                        <div className="space-y-1">
                                            <p className="text-sm font-medium leading-none">{s.participantName}</p>
                                            <p className="text-xs text-muted-foreground">{s.college}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-muted-foreground">{formatTime(s.registeredAt)}</span>
                                            <Badge variant={s.approvalStatus === "APPROVED" ? "default" : "secondary"} className="text-xs capitalize">
                                                {s.approvalStatus || "Pending"}
                                            </Badge>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </CardContent>
                </Card>

                <Card className="lg:col-span-3">
                    <CardHeader>
                        <CardTitle>Quick Actions</CardTitle>
                        <CardDescription>Manage your event efficiently.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-3">
                            {quickActions.map((action) => (
                                <Button
                                    key={action.label}
                                    variant="outline"
                                    className="w-full justify-start h-auto py-4 px-4 hover:bg-accent hover:text-accent-foreground border-muted"
                                    onClick={action.action}
                                >
                                    <div className="bg-primary/10 p-2 rounded-full mr-4">
                                        <action.icon className="h-5 w-5 text-primary" />
                                    </div>
                                    <div className="text-left">
                                        <div className="font-semibold">{action.label}</div>
                                        <div className="text-xs text-muted-foreground">Click to manage</div>
                                    </div>
                                </Button>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
