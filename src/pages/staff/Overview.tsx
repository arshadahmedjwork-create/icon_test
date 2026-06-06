import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getAbstracts, getDeadlines } from "@/services/supabaseService";
import { supabase } from "@/lib/supabaseClient";
import {
    Users, FileText, CheckCircle, XCircle, Clock, ClipboardCheck,
    TrendingUp, AlertTriangle, Calendar, ArrowRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { User, Abstract, Deadline } from "@/types";
import { useProgram } from "@/contexts/ProgramContext";

export default function StaffOverview() {
    const { user } = useAuth();
    const navigate = useNavigate();

    const [allStudents, setAllStudents] = useState<any[]>([]);
    const [allAbstracts, setAllAbstracts] = useState<Abstract[]>([]);
    const [deadlines, setDeadlines] = useState<Deadline[]>([]);

    const staffCollege = user?.college || "Your College";
    const { currentProgram } = useProgram();

    useEffect(() => {
        const loadData = async () => {
            const query = supabase.from('event_students').select('*').eq('program', currentProgram);
            if (staffCollege !== "Your College" && staffCollege) {
                query.eq('college', staffCollege);
            }

            const [studentsRes, fetchedAbstracts, fetchedDeadlines] = await Promise.all([
                query,
                getAbstracts(currentProgram),
                getDeadlines()
            ]);

            setAllStudents(studentsRes.data || []);
            setAllAbstracts(fetchedAbstracts);
            setDeadlines(fetchedDeadlines);
        };
        loadData();
    }, [staffCollege, currentProgram]);


    const pendingRegistrations = allStudents.filter((s) => s.approvalStatus === "PENDING");
    const approvedRegistrations = allStudents.filter((s) => s.approvalStatus === "APPROVED");
    const rejectedRegistrations = allStudents.filter((s) => s.approvalStatus === "REJECTED");
    const completedRegistrations = allStudents.filter((s) => s.paymentStatus === "PAID");

    // Abstract stats for college students
    const studentIds = new Set(allStudents.map((s) => s.id));
    const collegeAbstracts = allAbstracts.filter((a) => studentIds.has(a.studentId));
    const pendingAbstracts = collegeAbstracts.filter((a) => a.status === "pending");
    const approvedAbstracts = collegeAbstracts.filter((a) => a.status === "approved");
    const rejectedAbstracts = collegeAbstracts.filter((a) => a.status === "rejected");
    const revisionAbstracts = collegeAbstracts.filter((a) => a.status === "revision_requested");

    // Payment and MIDAS ID stats
    const paidStudents = allStudents.filter((s) => s.paymentStatus === "PAID");
    const midasIdIssued = allStudents.filter((s) => s.midasId);

    // Upcoming deadlines
    const now = new Date();
    const upcomingDeadlines = deadlines
        .filter((d) => new Date(d.date) > now)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .slice(0, 3);

    const statCards = [
        {
            label: "Total Students",
            value: allStudents.length,
            icon: <Users className="w-5 h-5" />,
            color: "from-blue-500 to-blue-600",
            bgColor: "bg-blue-50 dark:bg-blue-950/40",
            textColor: "text-blue-700 dark:text-blue-300",
        },
        {
            label: "Pending Approvals",
            value: pendingRegistrations.length,
            icon: <Clock className="w-5 h-5" />,
            color: "from-amber-500 to-orange-500",
            bgColor: "bg-amber-50 dark:bg-amber-950/40",
            textColor: "text-amber-700 dark:text-amber-300",
            alert: pendingRegistrations.length > 0,
        },
        {
            label: "Approved",
            value: approvedRegistrations.length,
            icon: <CheckCircle className="w-5 h-5" />,
            color: "from-emerald-500 to-green-600",
            bgColor: "bg-emerald-50 dark:bg-emerald-950/40",
            textColor: "text-emerald-700 dark:text-emerald-300",
        },
        {
            label: "Abstracts Received",
            value: collegeAbstracts.length,
            icon: <FileText className="w-5 h-5" />,
            color: "from-violet-500 to-purple-600",
            bgColor: "bg-violet-50 dark:bg-violet-950/40",
            textColor: "text-violet-700 dark:text-violet-300",
        },
    ];

    // Recent pending students (latest 5)
    const recentPending = pendingRegistrations.slice(0, 5);

    return (
        <div className="space-y-8">
            {/* Header */}
            <div>
                <h1 className="font-display text-2xl font-bold mb-1">Staff Coordinator Dashboard</h1>
                <p className="text-sm text-muted-foreground">
                    Welcome back! Here's an overview for <span className="font-semibold text-foreground">{staffCollege}</span>.
                </p>
            </div>

            {/* Stat Cards */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {statCards.map((stat) => (
                    <div
                        key={stat.label}
                        className="relative p-5 rounded-xl bg-card border border-border shadow-card overflow-hidden group hover:shadow-lg transition-shadow"
                    >
                        {/* deco gradient bar */}
                        <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${stat.color}`} />

                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-xs text-muted-foreground mb-1">{stat.label}</p>
                                <span className="font-display text-3xl font-bold">{stat.value}</span>
                            </div>
                            <div className={`p-2.5 rounded-lg ${stat.bgColor}`}>
                                <span className={stat.textColor}>{stat.icon}</span>
                            </div>
                        </div>

                        {stat.alert && (
                            <div className="mt-3 flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                                <AlertTriangle className="w-3 h-3" />
                                <span>Needs your attention</span>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Two-column layout */}
            <div className="grid lg:grid-cols-5 gap-6">
                {/* Registration Pipeline — wider */}
                <div className="lg:col-span-3 p-6 rounded-xl bg-card border border-border shadow-card">
                    <div className="flex items-center justify-between mb-5">
                        <h3 className="font-display font-semibold">Registration Pipeline</h3>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs"
                            onClick={() => navigate("/dashboard/staff/registrations")}
                        >
                            View All <ArrowRight className="w-3 h-3 ml-1" />
                        </Button>
                    </div>

                    {/* Pipeline visualization */}
                    <div className="grid grid-cols-4 gap-3 mb-6">
                        {[
                            { label: "Pending", count: pendingRegistrations.length, color: "bg-amber-500", bg: "bg-amber-100 dark:bg-amber-950/40" },
                            { label: "Approved", count: approvedRegistrations.length, color: "bg-emerald-500", bg: "bg-emerald-100 dark:bg-emerald-950/40" },
                            { label: "Rejected", count: rejectedRegistrations.length, color: "bg-red-500", bg: "bg-red-100 dark:bg-red-950/40" },
                            { label: "Completed", count: completedRegistrations.length, color: "bg-blue-500", bg: "bg-blue-100 dark:bg-blue-950/40" },
                        ].map((stage) => (
                            <div key={stage.label} className={`p-3 rounded-lg ${stage.bg} text-center`}>
                                <div className="text-2xl font-bold mb-0.5">{stage.count}</div>
                                <div className="text-xs text-muted-foreground">{stage.label}</div>
                                <div className={`h-1 rounded-full mt-2 ${stage.color} opacity-80`} />
                            </div>
                        ))}
                    </div>

                    {/* Progress bar */}
                    {allStudents.length > 0 && (
                        <div>
                            <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                                <span>Approval Progress</span>
                                <span>
                                    {approvedRegistrations.length + completedRegistrations.length} / {allStudents.length}
                                </span>
                            </div>
                            <div className="h-2 bg-secondary rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-emerald-500 to-green-400 rounded-full transition-all duration-500"
                                    style={{
                                        width: `${((approvedRegistrations.length + completedRegistrations.length) / allStudents.length) * 100}%`,
                                    }}
                                />
                            </div>
                        </div>
                    )}

                    {/* Recent pending list */}
                    {recentPending.length > 0 && (
                        <div className="mt-5 pt-5 border-t border-border">
                            <h4 className="text-sm font-medium mb-3">Recent Pending Registrations</h4>
                            <div className="space-y-2.5">
                                {recentPending.map((student) => (
                                    <div
                                        key={student.id}
                                        className="flex items-center justify-between py-2 px-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors"
                                    >
                                        <div>
                                            <span className="text-sm font-medium">{student.participantName}</span>
                                            <span className="text-xs text-muted-foreground ml-2">{student.email}</span>
                                        </div>
                                        <Badge variant="outline" className="text-xs border-amber-300 text-amber-600 dark:text-amber-400">
                                            Pending
                                        </Badge>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {recentPending.length === 0 && (
                        <div className="mt-5 pt-5 border-t border-border text-center py-6">
                            <CheckCircle className="w-8 h-8 mx-auto text-emerald-500 mb-2" />
                            <p className="text-sm text-muted-foreground">All registrations reviewed!</p>
                        </div>
                    )}
                </div>

                {/* Right Column */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Abstract Scrutiny Summary */}
                    <div className="p-6 rounded-xl bg-card border border-border shadow-card">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-display font-semibold">Abstract Scrutiny</h3>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="text-xs"
                                onClick={() => navigate("/dashboard/staff/abstracts")}
                            >
                                Review <ArrowRight className="w-3 h-3 ml-1" />
                            </Button>
                        </div>

                        <div className="space-y-3">
                            {[
                                { label: "Pending Review", count: pendingAbstracts.length, color: "bg-amber-500" },
                                { label: "Approved", count: approvedAbstracts.length, color: "bg-emerald-500" },
                                { label: "Revision Requested", count: revisionAbstracts.length, color: "bg-blue-500" },
                                { label: "Rejected", count: rejectedAbstracts.length, color: "bg-red-500" },
                            ].map((item) => (
                                <div key={item.label} className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full ${item.color}`} />
                                        <span className="text-sm">{item.label}</span>
                                    </div>
                                    <span className="font-semibold text-sm">{item.count}</span>
                                </div>
                            ))}
                        </div>

                        {collegeAbstracts.length === 0 && (
                            <div className="text-center py-4 mt-2">
                                <FileText className="w-6 h-6 mx-auto text-muted-foreground mb-1" />
                                <p className="text-xs text-muted-foreground">No abstracts submitted yet.</p>
                            </div>
                        )}
                    </div>

                    {/* Upcoming Deadlines */}
                    <div className="p-6 rounded-xl bg-card border border-border shadow-card">
                        <h3 className="font-display font-semibold mb-4">Upcoming Deadlines</h3>
                        {upcomingDeadlines.length > 0 ? (
                            <div className="space-y-3">
                                {upcomingDeadlines.map((deadline) => {
                                    const daysUntil = Math.ceil(
                                        (new Date(deadline.date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
                                    );
                                    return (
                                        <div key={deadline.id} className="flex items-start gap-3 p-3 rounded-lg bg-secondary/50">
                                            <div className="p-1.5 rounded-md bg-primary/10 mt-0.5">
                                                <Calendar className="w-3.5 h-3.5 text-primary" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm font-medium">{deadline.name}</div>
                                                <div className="text-xs text-muted-foreground">
                                                    {new Date(deadline.date).toLocaleDateString("en-IN", {
                                                        day: "numeric",
                                                        month: "short",
                                                        year: "numeric",
                                                    })}
                                                </div>
                                            </div>
                                            <Badge
                                                variant="outline"
                                                className={`text-xs shrink-0 ${daysUntil <= 3
                                                    ? "border-red-300 text-red-600 dark:text-red-400"
                                                    : daysUntil <= 7
                                                        ? "border-amber-300 text-amber-600 dark:text-amber-400"
                                                        : "border-emerald-300 text-emerald-600 dark:text-emerald-400"
                                                    }`}
                                            >
                                                {daysUntil} day{daysUntil !== 1 ? "s" : ""} left
                                            </Badge>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground text-center py-4">No upcoming deadlines.</p>
                        )}
                    </div>

                    {/* Quick Actions */}
                    <div className="p-6 rounded-xl bg-card border border-border shadow-card">
                        <h3 className="font-display font-semibold mb-4">Quick Actions</h3>
                        <div className="grid grid-cols-2 gap-3">
                            {[
                                { label: "Review Registrations", action: () => navigate("/dashboard/staff/registrations"), icon: <ClipboardCheck className="w-4 h-4" /> },
                                { label: "Scrutinize Abstracts", action: () => navigate("/dashboard/staff/abstracts"), icon: <FileText className="w-4 h-4" /> },
                            ].map((item) => (
                                <button
                                    key={item.label}
                                    onClick={item.action}
                                    className="flex flex-col items-center gap-2 p-4 rounded-lg bg-secondary hover:bg-secondary/80 text-sm font-medium text-secondary-foreground transition-colors text-center"
                                >
                                    {item.icon}
                                    {item.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
