
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
    User, Mail, Phone, Building2, GraduationCap, CalendarDays,
    Upload, CheckCircle2, AlertCircle, Loader2, FileText,
    Calendar, CreditCard, Award, Lock, UserCircle2
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useProgram } from "@/contexts/ProgramContext";
import { generateMidasId, generateQRCodeUrl, sendRegistrationEmail } from "@/services/emailService";
import { getStudentDashboardStats, getLatestMidasId } from "@/services/supabaseService";

const courses = [
    "BDS", "MDS - Orthodontics", "MDS - Prosthodontics", "MDS - Conservative & Endodontics",
    "MDS - Oral Surgery", "MDS - Periodontics", "MDS - Pedodontics",
    "MDS - Oral Pathology", "MDS - Oral Medicine", "MDS - Community Dentistry",
    "MDS - Public Health Dentistry", "Other"
];

const yearOptions = ["1st Year", "2nd Year", "3rd Year", "4th Year", "Intern"];

const loadRazorpayScript = (): Promise<boolean> => {
    return new Promise((resolve) => {
        if (window.Razorpay) {
            resolve(true);
            return;
        }
        const script = document.createElement("script");
        script.src = "https://checkout.razorpay.com/v1/checkout.js";
        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);
        document.body.appendChild(script);
    });
};

export default function StudentOverviewPage() {
    const { user, logout, refreshUser } = useAuth(); // Assume we can refetch/reload user after payment or we force a reload
    const navigate = useNavigate();
    const [loadingPayment, setLoadingPayment] = useState(false);
    const [stats, setStats] = useState({ eventsEnrolled: 0, abstractsSubmitted: 0, paymentsMade: 0, certificates: 0 });

    useEffect(() => {
        if (user?.id) {
            getStudentDashboardStats(user.id).then(setStats);
        }
    }, [user?.id]);

    const isApproved = user?.approvalStatus === 'APPROVED';
    const isPaid = user?.paymentStatus === 'PAID';
    const isRejected = user?.approvalStatus === 'REJECTED';

    const { currentProgram } = useProgram();
    const isIcon = currentProgram === 'ICON';
    const themeColor = isIcon ? "bg-[#b91c1c] hover:bg-[#991b1b]" : "bg-[#004d40] hover:bg-[#003d33]";

    const handlePayment = async (amount: number, isTest: boolean = false) => {
        setLoadingPayment(true);

        const processSuccess = async (paymentId: string) => {
            setLoadingPayment(true);
            try {
                // 1. Generate Program ID and QR Code now that payment is successful
                const latestId = await getLatestMidasId(currentProgram);
                const midasId = generateMidasId(latestId || 0, currentProgram);
                const collegeName = user?.college || "Dental College";
                const participantName = user?.name || "Delegate";
                const qrCodeUrl = generateQRCodeUrl(midasId, participantName, collegeName, 300, currentProgram);

                console.log(`Payment successful. Assigning ${isIcon ? 'ICON' : 'MIDAS'} ID:`, midasId);

                // 2. Update student payment status AND assign ID in Supabase
                const { error: updateErr } = await supabase
                    .from("event_students")
                    .update({
                        paymentStatus: "PAID",
                        paymentId: paymentId,
                        midasId: midasId,
                        qrCodeUrl: qrCodeUrl,
                    })
                    .eq("email", user?.email);

                if (updateErr) throw updateErr;

                // Record payment
                const { data: studentRecord } = await supabase.from("event_students").select("id").eq("email", user?.email).single();
                if (studentRecord) {
                    const { error: payError } = await supabase.from("payments").insert({
                        eventStudentId: studentRecord.id,
                        amount: amount,
                        currency: "INR",
                        status: "PAID",
                        paymentGatewayId: paymentId,
                        transactionId: paymentId,
                    });
                    if (payError) console.error("Payment record error:", payError);
                }

                // 4. Send official registration confirmation email
                try {
                    await sendRegistrationEmail({
                        student_name: participantName,
                        student_email: user?.email || '',
                        midas_id: midasId,
                        college_name: collegeName,
                        event_type: isIcon ? "Professional Delegate" : "UG Delegate",
                        mode: "Offline",
                        qr_code_url: qrCodeUrl,
                        registration_date: new Date().toLocaleDateString("en-IN"),
                    });
                } catch (emailErr) {
                    console.warn("Email sending error after payment:", emailErr);
                }

                toast.success(`Payment Successful! ${isIcon ? 'ICON' : 'MIDAS'} ID assigned: ` + midasId);
                setTimeout(async () => {
                    await refreshUser(); 
                }, 500);

            } catch (err: any) {
                console.error("Payment update Error:", err);
                toast.error("Payment received but status update failed. Contact Admin.");
                setLoadingPayment(false);
            }
        };

        if (isTest) {
            // Bypass Razorpay for test payment
            await processSuccess(`pay_test_${Date.now()}`);
            return;
        }

        const res = await loadRazorpayScript();
        if (!res) {
            toast.error("Razorpay SDK failed to load.");
            setLoadingPayment(false);
            return;
        }
        setLoadingPayment(false);

        const razorpayKey = import.meta.env.VITE_RAZORPAY_LIVE_KEY;
        if (!razorpayKey) {
            toast.error("Payment configuration error.");
            return;
        }

        const options = {
            key: razorpayKey,
            amount: amount * 100, 
            currency: "INR",
            name: isTest ? `${currentProgram} — Test Payment` : `${isIcon ? 'Madras ICON' : 'MIDAS'} Scientific Event`,
            description: `${isIcon ? 'Professional' : 'UG'} Delegate Registration Fee`,
            handler: async function (response: any) {
                await processSuccess(response.razorpay_payment_id);
            },
            prefill: {
                name: user?.name,
                email: user?.email,
                contact: user?.phone || "9999999999",
            },
            theme: { color: isIcon ? "#b91c1c" : (isTest ? "#d97706" : "#004d40") },
            modal: {
                ondismiss: function () {
                    toast.info("Payment cancelled.");
                }
            }
        };

        const rzp = new window.Razorpay(options);
        rzp.on("payment.failed", function (response: any) {
            toast.error("Payment failed: " + (response.error?.description || "Unknown error"));
        });
        rzp.open();
    };

    // ─── COMPLETED DASHBOARD ────────────────────
    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Welcome, {user?.name}! 👋</h1>
                    <p className="text-sm text-slate-500 mt-1">Your event participation overview</p>
                </div>

                {/* Header Ad Box */}
                <div className="flex-grow bg-white border border-slate-150 rounded-2xl overflow-hidden shadow-sm flex items-center justify-center h-[110px]">
                    <img src="/gold.png" alt="Gold Sponsor" className="w-full h-full object-contain p-1" />
                </div>
            </div>


            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: "Events Enrolled", value: stats.eventsEnrolled.toString(), icon: Calendar, color: "bg-blue-500", bg: "bg-blue-50" },
                    { label: "Abstracts Submitted", value: stats.abstractsSubmitted.toString(), icon: FileText, color: "bg-amber-500", bg: "bg-amber-50" },
                    { label: "Payments Made", value: stats.paymentsMade.toString(), icon: CreditCard, color: "bg-green-500", bg: "bg-green-50" },
                    { label: "Certificates", value: stats.certificates.toString(), icon: Award, color: "bg-purple-500", bg: "bg-purple-50" },
                ].map((stat) => (
                    <motion.div
                        key={stat.label}
                        className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm hover:shadow-md transition-shadow"
                        whileHover={{ y: -2 }}
                    >
                        <div className="flex items-center gap-3 mb-3">
                            <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center`}>
                                <stat.icon className={`w-5 h-5 text-${stat.color.replace('bg-', '')}`} />
                            </div>
                            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{stat.label}</span>
                        </div>
                        <p className="text-3xl font-black text-slate-900">{stat.value}</p>
                    </motion.div>
                ))}
            </div>

            {/* Status / Payment Banner */}
            {!isPaid && (
                <div className="bg-white rounded-2xl border border-amber-200 overflow-hidden shadow-sm">
                    <div className="bg-amber-50 p-6 flex flex-col md:flex-row items-center justify-between gap-6">
                        <div className="flex items-start gap-4">
                            <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                                <AlertCircle className="w-6 h-6 text-amber-600" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-amber-900">
                                    {isRejected ? "Registration Rejected" : !isApproved ? "Registration Pending Approval" : "Payment Required"}
                                </h3>
                                <p className="text-amber-700 mt-1 text-sm max-w-lg">
                                    {isRejected
                                        ? "Your registration has been rejected by the staff coordinator."
                                        : !isApproved
                                            ? "Your staff coordinator is reviewing your registration. Please check back later. Event access will remain locked until approved and paid."
                                            : "Your registration is approved! Please complete the payment of ₹1030 to unlock the event dashboard and abstract submissions."}
                                </p>
                            </div>
                        </div>

                        {isApproved && !isPaid && (
                            <div className="flex flex-col gap-2 shrink-0 w-full md:w-auto">
                                <Button
                                    onClick={() => handlePayment(1030, false)}
                                    disabled={loadingPayment}
                                    className={`${themeColor} text-white font-bold h-12 px-8 rounded-xl shadow-lg`}
                                >
                                    {loadingPayment ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CreditCard className="w-4 h-4 mr-2" />}
                                    Pay Now — ₹1030
                                </Button>
                                <Button
                                    onClick={() => handlePayment(1, true)}
                                    disabled={loadingPayment}
                                    variant="outline"
                                    className="h-10 rounded-xl border-amber-300 text-amber-700 hover:bg-amber-100 font-bold border-dashed"
                                >
                                    Test Payment — ₹1
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Profile Card */}
            <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-4 border-b border-slate-100 pb-4">
                    <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${isIcon ? 'from-[#7f1d1d] to-[#b91c1c]' : 'from-[#004d40] to-[#2e7d32]'} flex items-center justify-center text-white font-bold text-2xl shadow-inner`}>
                        {user?.name?.charAt(0) || "U"}
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="text-xl font-black text-slate-900 truncate">{user?.name}</h3>
                        <p className="text-sm font-medium text-slate-500 truncate flex flex-wrap gap-2 items-center">
                            <Building2 className="w-3.5 h-3.5" /> {user?.college}
                        </p>
                    </div>
                    {user?.midasId && (
                        <div className="hidden sm:flex items-center gap-4 text-right">
                            <div className="flex flex-col items-end justify-center">
                                <p className="text-xs uppercase tracking-wider text-slate-400 font-bold mb-1">
                                    {isIcon ? "ICON ID" : "MIDAS ID"}
                                </p>
                                <div className="bg-slate-100 border border-slate-200 px-4 py-2 rounded-xl">
                                    <span className="font-mono font-bold text-lg text-primary tracking-widest">{user?.midasId}</span>
                                </div>
                            </div>
                            <div className="bg-white p-2 border border-slate-200 rounded-xl shadow-sm">
                                <img
                                    src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(`${isIcon ? 'ICON' : 'MIDAS'}|${user.midasId}|${user.name}|${user.college}`)}`}
                                    alt="Delegate ID QR Code"
                                    className="w-16 h-16 rounded cursor-pointer hover:scale-150 transition-transform origin-right"
                                />
                            </div>
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 text-sm mt-6">
                    <div className="space-y-1">
                        <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> Email</span>
                        <span className="font-medium text-slate-800 break-all">{user?.email}</span>
                    </div>
                    <div className="space-y-1">
                        <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> Phone</span>
                        <span className="font-medium text-slate-800">{user?.phone || '—'}</span>
                    </div>
                    <div className="space-y-1">
                        <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5"><GraduationCap className="w-3.5 h-3.5" /> Course & Year</span>
                        <span className="font-medium text-slate-800">{user?.course || '—'} • {user?.year || '—'}</span>
                    </div>
                    {user?.midasId && (
                        <div className="sm:hidden space-y-1">
                            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">MIDAS ID</span>
                            <span className="font-mono font-bold text-slate-800">{user?.midasId}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
                <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                    Quick Actions {!isPaid && <Lock className="w-4 h-4 text-slate-400" />}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <Button
                        variant="outline"
                        disabled={!isPaid}
                        className={`h-12 rounded-xl border-slate-200 justify-start ${!isPaid ? 'opacity-50' : ''}`}
                        onClick={() => navigate('/dashboard/student/events')}
                    >
                        <Calendar className={`w-4 h-4 mr-2 ${isPaid ? 'text-blue-500' : 'text-slate-400'}`} /> Browse Events
                    </Button>
                    <Button
                        variant="outline"
                        disabled={!isPaid}
                        className={`h-12 rounded-xl border-slate-200 justify-start ${!isPaid ? 'opacity-50' : ''}`}
                        onClick={() => navigate('/dashboard/student/submissions')}
                    >
                        <FileText className={`w-4 h-4 mr-2 ${isPaid ? 'text-amber-500' : 'text-slate-400'}`} /> My Submissions
                    </Button>
                    <Button
                        variant="outline"
                        disabled={!isPaid}
                        className={`h-12 rounded-xl border-slate-200 justify-start ${!isPaid ? 'opacity-50' : ''}`}
                        onClick={() => navigate('/dashboard/student/certificates')}
                    >
                        <Award className={`w-4 h-4 mr-2 ${isPaid ? 'text-purple-500' : 'text-slate-400'}`} /> View Certificates
                    </Button>
                </div>
            </div>
        </motion.div>
    );
}
