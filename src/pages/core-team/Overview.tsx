import { useState, useEffect } from "react";
import { BarChart3, Calendar, FileText, Database, ArrowRight, Activity, Clock, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getSessions, getAbstracts, getJudges, getEventStudents } from "@/services/supabaseService";
import { Session, Abstract, Student, Judge } from "@/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

import { useProgram } from "@/contexts/ProgramContext";

export default function CoreTeamOverview() {
    const navigate = useNavigate();
    const { currentProgram } = useProgram();
    const [stats, setStats] = useState([
        { label: "Scheduled Sessions", value: "0", icon: Calendar, desc: "Across all subjects", color: "text-blue-500", bg: "bg-blue-500/10" },
        { label: "Approved Abstracts", value: "0", icon: FileText, desc: "Ready for presentation", color: "text-green-500", bg: "bg-green-500/10" },
        { label: "Ongoing Sessions", value: "0", icon: Activity, desc: "Currently active", color: "text-amber-500", bg: "bg-amber-500/10" },
        { label: "Judge Pool", value: "0", icon: Database, desc: "Active judges assigned", color: "text-purple-500", bg: "bg-purple-500/10" },
    ]);
    const [ongoingSessions, setOngoingSessions] = useState<Session[]>([]);
    const [allStudents, setAllStudents] = useState<Student[]>([]);
    const [allAbstracts, setAllAbstracts] = useState<Abstract[]>([]);
    const [allJudges, setAllJudges] = useState<Judge[]>([]);
    const [loading, setLoading] = useState(true);

    const isIcon = currentProgram === 'ICON';

    useEffect(() => {
        const loadStats = async () => {
            setLoading(true);
            try {
                const [sessions, abstracts, judges, students] = await Promise.all([
                    getSessions(currentProgram),
                    getAbstracts(currentProgram),
                    getJudges(currentProgram),
                    getEventStudents(currentProgram)
                ]);

                const scheduled = sessions.length;
                const approved = abstracts.filter(a => a.status === "approved").length;
                const ongoing = sessions.filter(s => s.status === "in_progress");
                const totalJudges = judges.length;

                setOngoingSessions(ongoing);
                setAllStudents(students);
                setAllAbstracts(abstracts);
                setAllJudges(judges);

                setStats([
                    { label: "Scheduled Sessions", value: scheduled.toString(), icon: Calendar, desc: `Across all ${isIcon ? 'Specialities' : 'Subjects'}`, color: "text-blue-500", bg: "bg-blue-500/10" },
                    { label: "Approved Abstracts", value: approved.toString(), icon: FileText, desc: "Ready for presentation", color: "text-green-500", bg: "bg-green-500/10" },
                    { label: "Ongoing Sessions", value: ongoing.length.toString(), icon: Activity, desc: "Active now", color: "text-amber-500", bg: "bg-amber-500/10" },
                    { label: "Judge Pool", value: totalJudges.toString(), icon: Database, desc: "Active judges assigned", color: "text-purple-500", bg: "bg-purple-500/10" },
                ]);
            } catch (err) {
                console.error("Failed to load dashboard data", err);
            } finally {
                setLoading(false);
            }
        };
        loadStats();
    }, [currentProgram]);

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
                        {ongoingSessions.length === 0 ? (
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
                        ) : (
                            <div className="space-y-4">
                                {ongoingSessions.map(session => {
                                    const currentPresenter = allStudents.find(s => s.id === session.currentPresenterId);
                                    const sessionJudges = allJudges.filter(j => session.judges?.includes(j.id));
                                    
                                    // Calculate remaining participants
                                    const sessionAbstracts = allAbstracts.filter(a => session.abstractIds?.includes(a.id));
                                    const remainingCounts = sessionAbstracts.length - (session.currentPresenterId ? 1 : 0);
                                    const participants = sessionAbstracts.map(a => ({
                                        id: a.id,
                                        name: allStudents.find(s => s.id === a.studentId)?.participantName || "Unknown",
                                        isCurrent: a.studentId === session.currentPresenterId
                                    }));

                                    return (
                                        <Card key={session.id} className="border-accent/20 bg-accent/5 overflow-hidden border shadow-sm">
                                            <div className="p-4 space-y-3">
                                                <div 
                                                    className="flex flex-col gap-1 cursor-pointer hover:opacity-80 transition-opacity"
                                                    onClick={() => navigate("/dashboard/core-team/sessions")}
                                                >
                                                    <Badge className="w-fit bg-accent text-accent-foreground text-[10px] h-4 px-1.5 mb-1 animate-pulse">LIVE NOW</Badge>
                                                    <h3 className="font-bold text-sm leading-tight text-foreground">{session.name}</h3>
                                                    <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">ID: {session.id.slice(0, 8)}</p>
                                                </div>

                                                <div className="space-y-2 py-1 border-y border-border/50">
                                                    <div className="flex items-center gap-2">
                                                        <div className="p-1 rounded bg-accent/10">
                                                            <Activity className="h-3 w-3 text-accent" />
                                                        </div>
                                                        <div>
                                                            <p className="text-[10px] text-muted-foreground font-medium uppercase">Presenting</p>
                                                            <p className="text-xs font-semibold">{currentPresenter?.participantName || "Waiting to start..."}</p>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-start gap-2">
                                                        <div className="p-1 rounded bg-blue-500/10">
                                                            <Users className="h-3 w-3 text-blue-500" />
                                                        </div>
                                                        <div className="flex-1">
                                                            <p className="text-[10px] text-muted-foreground font-medium uppercase">Judges</p>
                                                            <p className="text-[11px] font-medium leading-relaxed">
                                                                {sessionJudges.length > 0 ? sessionJudges.map(j => j.name).join(", ") : "None Assigned"}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>

                                                <Dialog>
                                                    <DialogTrigger asChild>
                                                        <Button variant="outline" size="sm" className="w-full text-[11px] h-8 font-medium">
                                                            View Participants ({remainingCounts} remaining)
                                                        </Button>
                                                    </DialogTrigger>
                                                    <DialogContent className="max-w-md">
                                                        <DialogHeader>
                                                            <DialogTitle>{session.name} - Participants</DialogTitle>
                                                        </DialogHeader>
                                                        <div className="space-y-2 mt-4">
                                                            {participants.map((p, idx) => (
                                                                <div key={p.id} className={`flex items-center justify-between p-3 rounded-lg border ${p.isCurrent ? 'bg-accent/10 border-accent/30' : 'bg-muted/5'}`}>
                                                                    <div className="flex items-center gap-3">
                                                                        <span className="text-xs font-mono text-muted-foreground">{idx + 1}.</span>
                                                                        <span className={`text-sm font-medium ${p.isCurrent ? 'text-accent' : ''}`}>{p.name}</span>
                                                                    </div>
                                                                    {p.isCurrent && (
                                                                        <Badge className="bg-accent text-accent-foreground text-[10px] h-5">Presenting</Badge>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </DialogContent>
                                                </Dialog>
                                            </div>
                                        </Card>
                                    );
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
