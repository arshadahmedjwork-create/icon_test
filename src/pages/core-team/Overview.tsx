import { useState, useEffect } from "react";
import { BarChart3, Calendar, FileText, Database, ArrowRight, Activity, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getSessions, getAbstracts, getJudges } from "@/services/supabaseService";

export default function CoreTeamOverview() {
    const navigate = useNavigate();
    const [stats, setStats] = useState([
        { label: "Scheduled Sessions", value: "0", icon: Calendar, desc: "Across all subjects", color: "text-blue-500", bg: "bg-blue-500/10" },
        { label: "Approved Abstracts", value: "0", icon: FileText, desc: "Ready for presentation", color: "text-green-500", bg: "bg-green-500/10" },
        { label: "Ongoing Sessions", value: "0", icon: Activity, desc: "Currently active", color: "text-amber-500", bg: "bg-amber-500/10" },
        { label: "Judge Pool", value: "0", icon: Database, desc: "Active judges assigned", color: "text-purple-500", bg: "bg-purple-500/10" },
    ]);

    useEffect(() => {
        const loadStats = async () => {
            const [sessions, abstracts, judges] = await Promise.all([
                getSessions(),
                getAbstracts(),
                getJudges()
            ]);

            const scheduled = sessions.length;
            const approved = abstracts.filter(a => a.status === "approved").length;
            const ongoing = sessions.filter(s => s.status === "in_progress").length;
            const totalJudges = judges.length;

            setStats([
                { label: "Scheduled Sessions", value: scheduled.toString(), icon: Calendar, desc: "Across all subjects", color: "text-blue-500", bg: "bg-blue-500/10" },
                { label: "Approved Abstracts", value: approved.toString(), icon: FileText, desc: "Ready for presentation", color: "text-green-500", bg: "bg-green-500/10" },
                { label: "Ongoing Sessions", value: ongoing.toString(), icon: Activity, desc: "Active now", color: "text-amber-500", bg: "bg-amber-500/10" },
                { label: "Judge Pool", value: totalJudges.toString(), icon: Database, desc: "Active judges assigned", color: "text-purple-500", bg: "bg-purple-500/10" },
            ]);
        };
        loadStats();
    }, []);

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header Section */}
            <div className="flex flex-col gap-1.5">
                <h1 className="font-display text-3xl font-bold tracking-tight">Scientific Team Dashboard</h1>
                <p className="text-muted-foreground text-sm md:text-base max-w-2xl">
                    Manage real-time sessions, abstract approvals, and evaluation results efficiently.
                </p>
            </div>

            {/* Stats Grid */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {stats.map((stat) => (
                    <Card key={stat.label} className="border-border/50 shadow-sm hover:shadow-md transition-all duration-200 cursor-default">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                {stat.label}
                            </CardTitle>
                            <div className={`p-2 rounded-full ${stat.bg}`}>
                                <stat.icon className={`h-4 w-4 ${stat.color}`} />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold tracking-tight">{stat.value}</div>
                            <p className="text-xs text-muted-foreground mt-1 font-medium">
                                {stat.desc}
                            </p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Main Content Split */}
            <div className="grid gap-6 lg:grid-cols-3">

                {/* Quick Actions Panel */}
                <Card className="lg:col-span-2 border-border/50 shadow-sm">
                    <CardHeader>
                        <CardTitle>Quick Actions</CardTitle>
                        <CardDescription>Common tasks for the scientific committee.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4 sm:grid-cols-2">
                        <Button
                            className="h-auto py-4 px-4 flex flex-col items-start gap-1 w-full justify-start border-muted hover:bg-accent/50 hover:border-accent"
                            variant="outline"
                            onClick={() => navigate("/dashboard/core-team/sessions")}
                        >
                            <div className="flex items-center gap-2 w-full mb-1">
                                <div className="p-1.5 rounded bg-blue-500/10 text-blue-600">
                                    <Calendar className="h-4 w-4" />
                                </div>
                                <span className="font-semibold text-foreground">Manage Sessions</span>
                            </div>
                            <span className="text-xs text-muted-foreground font-normal text-left">
                                Schedule, edit, or cancel scientific sessions.
                            </span>
                        </Button>

                        <Button
                            className="h-auto py-4 px-4 flex flex-col items-start gap-1 w-full justify-start border-muted hover:bg-accent/50 hover:border-accent"
                            variant="outline"
                            onClick={() => navigate("/dashboard/core-team/results")}
                        >
                            <div className="flex items-center gap-2 w-full mb-1">
                                <div className="p-1.5 rounded bg-green-500/10 text-green-600">
                                    <BarChart3 className="h-4 w-4" />
                                </div>
                                <span className="font-semibold text-foreground">View Results</span>
                            </div>
                            <span className="text-xs text-muted-foreground font-normal text-left">
                                Analyze scores and generate leaderboards.
                            </span>
                        </Button>

                        <Button
                            className="h-auto py-4 px-4 flex flex-col items-start gap-1 w-full justify-start border-muted hover:bg-accent/50 hover:border-accent"
                            variant="outline"
                            onClick={() => navigate("/dashboard/core-team/judge-database")}
                        >
                            <div className="flex items-center gap-2 w-full mb-1">
                                <div className="p-1.5 rounded bg-purple-500/10 text-purple-600">
                                    <Database className="h-4 w-4" />
                                </div>
                                <span className="font-semibold text-foreground">Judge Database</span>
                            </div>
                            <span className="text-xs text-muted-foreground font-normal text-left">
                                View and manage judge assignments.
                            </span>
                        </Button>
                    </CardContent>
                </Card>

                {/* Session Status Panel */}
                <Card className="lg:col-span-1 border-border/50 shadow-sm flex flex-col">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Activity className="h-4 w-4 text-primary" />
                            Live Status
                        </CardTitle>
                        <CardDescription>Real-time session updates.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 min-h-[180px]">
                        <div className="flex flex-col items-center justify-center h-full border rounded-lg bg-muted/10 p-6 text-center space-y-3">
                            <div className="p-3 bg-muted rounded-full">
                                <Clock className="h-6 w-6 text-muted-foreground" />
                            </div>
                            <div className="space-y-1">
                                <p className="text-sm font-medium text-foreground">No Live Sessions</p>
                                <p className="text-xs text-muted-foreground px-4">
                                    All scheduled sessions have either finished or haven't started yet.
                                </p>
                            </div>
                            <Button variant="ghost" size="sm" className="text-xs" onClick={() => navigate("/dashboard/core-team/sessions")}>
                                View Schedule <ArrowRight className="ml-1 h-3 w-3" />
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
