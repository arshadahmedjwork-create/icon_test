
import DashboardLayout from "@/components/layout/DashboardLayout";
import { GraduationCap, FileText, CreditCard, Award, Calendar } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Routes, Route, Navigate } from "react-router-dom";

const navItems = [
    { label: "Overview", href: "/dashboard/student-event", icon: <GraduationCap className="w-4 h-4" /> },
    { label: "My Participation", href: "/dashboard/student-event/events", icon: <Calendar className="w-4 h-4" /> },
    { label: "Abstract Submission", href: "/dashboard/student-event/submissions", icon: <FileText className="w-4 h-4" /> },
    { label: "Payment Receipt", href: "/dashboard/student-event/payments", icon: <CreditCard className="w-4 h-4" /> },
    { label: "Certificates", href: "/dashboard/student-event/certificates", icon: <Award className="w-4 h-4" /> },
];

export default function StudentEventDashboard() {
    const { user } = useAuth();

    // In a real app, check if user type is STUDENT_EVENT
    if (!user) return <Navigate to="/member-login" />;

    return (
        <DashboardLayout roleName="UG Delegate" roleColor="bg-[#004d40]/10 text-[#004d40]" navItems={navItems}>
            <Routes>
                <Route path="/" element={<StudentEventOverview />} />
                <Route path="*" element={<Navigate to="/dashboard/student-event" replace />} />
            </Routes>
        </DashboardLayout>
    );
}

function StudentEventOverview() {
    const { user } = useAuth();

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="font-display text-2xl font-bold text-slate-900">Welcome, {user?.name || "Delegate"}</h1>
                    <p className="text-sm text-slate-500">MIDAS Scientific Event Delegate Dashboard</p>
                </div>
                <div className="px-4 py-2 bg-green-100 text-green-700 rounded-full text-xs font-bold uppercase tracking-wider border border-green-200">
                    Status: Paid
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-2">
                    <span className="text-slate-400 text-xs font-bold uppercase">Payment Status</span>
                    <p className="text-xl font-black text-green-600">PAID</p>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-2">
                    <span className="text-slate-400 text-xs font-bold uppercase">Approval Status</span>
                    <p className="text-xl font-black text-amber-500">PENDING</p>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-2">
                    <span className="text-slate-400 text-xs font-bold uppercase">MIDAS ID</span>
                    <p className="text-xl font-black text-slate-300">WAITING FOR APPROVAL</p>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 text-center space-y-4">
                <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto">
                    <FileText className="w-8 h-8 text-blue-600" />
                </div>
                <h3 className="text-lg font-bold">Submit Your Abstract</h3>
                <p className="text-slate-500 max-w-md mx-auto">Once your registration is approved, the abstract submission portal will be fully unlocked for Paper and Poster presentations.</p>
                <button className="px-6 py-3 bg-slate-900 text-white rounded-xl font-bold opacity-50 cursor-not-allowed">
                    Submit Abstract
                </button>
            </div>
        </div>
    );
}
