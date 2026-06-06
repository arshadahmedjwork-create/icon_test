
import DashboardLayout from "@/components/layout/DashboardLayout";
import { GraduationCap, FileText, CreditCard, Award, Calendar } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Routes, Route, Navigate } from "react-router-dom";
import ChangePasswordModal from "@/components/ChangePasswordModal";
import { PaymentComponent } from "@/pages/student/PaymentComponent";
import { cn } from "@/lib/utils";

import { useProgram } from "@/contexts/ProgramContext";

const navItems = [
    { label: "Overview", href: "/dashboard/student-event", icon: <GraduationCap className="w-4 h-4" /> },
    { label: "My Participation", href: "/dashboard/student-event/events", icon: <Calendar className="w-4 h-4" /> },
    { label: "Abstract Submission", href: "/dashboard/student-event/submissions", icon: <FileText className="w-4 h-4" /> },
    { label: "Payment Receipt", href: "/dashboard/student-event/payments", icon: <CreditCard className="w-4 h-4" /> },
    { label: "Certificates", href: "/dashboard/student-event/certificates", icon: <Award className="w-4 h-4" /> },
];

export default function StudentEventDashboard() {
    const { user, refreshUser } = useAuth();

    // In a real app, check if user type is STUDENT_EVENT
    if (!user) return <Navigate to="/member-login" />;

    const handlePaymentComplete = async () => {
        await refreshUser();
    };

    const { currentProgram } = useProgram();
    const isIcon = currentProgram === 'ICON';

    return (
        <DashboardLayout 
            roleName={isIcon ? "Professional Delegate" : "UG Delegate"} 
            roleColor={isIcon ? "bg-primary/10 text-primary" : "bg-[#004d40]/10 text-[#004d40]"} 
            navItems={navItems}
        >
            {user.mustChangePassword && <ChangePasswordModal />}
            <Routes>
                <Route path="/" element={<StudentEventOverview onPaymentComplete={handlePaymentComplete} />} />
                <Route path="*" element={<Navigate to="/dashboard/student-event" replace />} />
            </Routes>
        </DashboardLayout>
    );
}

function StudentEventOverview({ onPaymentComplete }: { onPaymentComplete: () => void }) {
    const { user } = useAuth();
    const { currentProgram } = useProgram();
    if (!user) return null;
    
    const isIcon = currentProgram === 'ICON';

    const isPaid = user.paymentStatus === 'PAID';
    const isApproved = user.approvalStatus === 'APPROVED';

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="font-display text-2xl font-bold text-slate-900">Welcome, {user.name || "Delegate"}</h1>
                    <p className="text-sm text-slate-500">{isIcon ? 'Madras ICON' : 'MIDAS'} Scientific Event Delegate Dashboard</p>
                </div>
                <div className={cn(
                    "px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider border",
                    isPaid ? "bg-green-100 text-green-700 border-green-200" : "bg-amber-100 text-amber-700 border-amber-200"
                )}>
                    Status: {isPaid ? "Paid" : "Unpaid"}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-2">
                    <span className="text-slate-400 text-xs font-bold uppercase">Payment Status</span>
                    <p className={cn(
                        "text-xl font-black",
                        isPaid ? "text-green-600" : "text-amber-500"
                    )}>{isPaid ? "PAID" : "PENDING"}</p>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-2">
                    <span className="text-slate-400 text-xs font-bold uppercase">Approval Status</span>
                    <p className={cn(
                        "text-xl font-black",
                        isApproved ? "text-green-600" : "text-amber-500"
                    )}>{user.approvalStatus || "PENDING"}</p>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-2">
                    <span className="text-slate-400 text-xs font-bold uppercase">{isIcon ? 'ICON' : 'MIDAS'} ID</span>
                    <p className={cn(
                        "text-xl font-black",
                        user.midasId ? "text-primary" : "text-slate-300"
                    )}>
                        {user.midasId || "WAITING FOR PAYMENT"}
                    </p>
                </div>
            </div>

            {!isPaid && isApproved && (
                <div className="animate-in fade-in slide-in-from-top-4 duration-500">
                    <PaymentComponent onPaymentComplete={onPaymentComplete} />
                </div>
            )}

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 text-center space-y-4">
                <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto">
                    <FileText className="w-8 h-8 text-blue-600" />
                </div>
                <h3 className="text-lg font-bold">Submit Your Abstract</h3>
                {!isPaid ? (
                    <p className="text-slate-500 max-w-md mx-auto italic">
                        Please complete your payment to unlock the abstract submission portal.
                    </p>
                ) : (
                    <p className="text-slate-500 max-w-md mx-auto">
                        You can now submit your abstract for Paper or Poster presentations.
                    </p>
                )}
                <button 
                    disabled={!isPaid}
                    className={cn(
                        "px-6 py-3 rounded-xl font-bold transition-all",
                        isPaid 
                        ? "bg-slate-900 text-white hover:bg-slate-800" 
                        : "bg-slate-100 text-slate-400 cursor-not-allowed"
                    )}
                >
                    {isPaid ? "Submit Abstract" : "Locked (Complete Payment)"}
                </button>
            </div>
        </div>
    );
}
