
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import {
    User, Mail, Phone, Building2, GraduationCap, CalendarDays,
    Upload, CheckCircle2, AlertCircle, Loader2, FileText,
    Calendar, CreditCard, Award, Lock, UserCircle2, Clock, XCircle, ShieldAlert
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/lib/supabaseClient";
import { useProgram } from "@/contexts/ProgramContext";
import { generateMidasId, generateQRCodeUrl, sendRegistrationEmail } from "@/services/emailService";
import { getStudentDashboardStats, getLatestMidasId, updateEventStudent, uploadBonafide, getCollegesList } from "@/services/supabaseService";
import { downloadIdCard } from "@/services/idCardEngine";

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
    const { user, logout, refreshUser, completeProfileDismissed, setCompleteProfileDismissed } = useAuth(); // Assume we can refetch/reload user after payment or we force a reload
    const navigate = useNavigate();
    const [loadingPayment, setLoadingPayment] = useState(false);
    const [stats, setStats] = useState({ eventsEnrolled: 0, abstractsSubmitted: 0, paymentsMade: 0, certificates: 0 });

    useEffect(() => {
        refreshUser();
    }, [refreshUser]);

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

    const [submittingMissing, setSubmittingMissing] = useState(false);
    const [missingForm, setMissingForm] = useState({
        college: user?.college || "",
        course: user?.course || "",
        year: (user?.year === "N/A" ? "" : user?.year) || "",
        delegateType: (user as any)?.delegateType || "",
        dciNumber: (user as any)?.dciNumber || "",
        speciality: (user as any)?.speciality || "",
        state: (user as any)?.state || "",
        qualification: (user as any)?.qualification || "",
        yearsOfPractice: (user as any)?.yearsOfPractice || "",
        academicPosition: (user as any)?.academicPosition || "",
        teachingExperience: (user as any)?.teachingExperience || "",
    });

    const [bonafideFile, setBonafideFile] = useState<File | null>(null);
    const [dciCertFile, setDciCertFile] = useState<File | null>(null);
    const [colleges, setColleges] = useState<{ value: string; label: string }[]>([]);
    const [isLoadingColleges, setIsLoadingColleges] = useState(true);

    useEffect(() => {
        const loadColleges = async () => {
            try {
                const list = await getCollegesList();
                setColleges(list);
            } catch (err) {
                console.error("Failed to load colleges:", err);
            } finally {
                setIsLoadingColleges(false);
            }
        };
        loadColleges();
    }, []);

    const [manuallyClosed, setManuallyClosed] = useState(false);

    useEffect(() => {
        if (user) {
            setMissingForm({
                college: user.college || "",
                course: user.course || "",
                year: (user.year === "N/A" ? "" : user.year) || "",
                delegateType: (user as any).delegateType || "",
                dciNumber: (user as any).dciNumber || "",
                speciality: (user as any).speciality || "",
                state: (user as any).state || "",
                qualification: (user as any).qualification || "",
                yearsOfPractice: (user as any).yearsOfPractice || "",
                academicPosition: (user as any).academicPosition || "",
                teachingExperience: (user as any).teachingExperience || "",
            });
            setManuallyClosed(false);
        }
    }, [user]);

    const isMidas = currentProgram === 'MIDAS';

    const getMissingFields = () => {
        const missing = [];
        if (!user) return missing;
        
        if (!user.name || !user.name.trim()) missing.push("Name");
        if (!user.mobile || !user.mobile.trim()) missing.push("Mobile");
        if (!user.college || !user.college.trim()) missing.push("College");
        
        if (isMidas) {
            if (!user.year || user.year === 'N/A' || !user.year.trim()) missing.push("Year of Study");
            if (!user.course || !user.course.trim()) missing.push("Course");
        } else {
            const delegateType = (user as any).delegateType;
            if (!delegateType) {
                missing.push("Delegate Type");
            } else {
                if (!user.dciNumber || !user.dciNumber.trim()) missing.push("DCI Number");
                if (!(user as any).dciCertificateUrl) missing.push("DCI Certificate");

                if (delegateType === 'PG' || delegateType === 'Academician') {
                    if (!user.idProofUrl && !(user as any).bonafideUrl) {
                        missing.push("Bonafide Certificate");
                    }
                }
            }
        }
        return missing;
    };

    const missingFieldsList = getMissingFields();
    const showMissingFieldsPopup = !user?.mustChangePassword && missingFieldsList.length > 0 && !manuallyClosed && !completeProfileDismissed;

    const handleSaveMissingFields = async () => {
        if (!user) return;
        setSubmittingMissing(true);
        try {
            let idProofUrl = user.idProofUrl;
            let dciCertificateUrl = (user as any).dciCertificateUrl;

            if (bonafideFile) {
                const url = await uploadBonafide(`${user.mobile || user.id}_bonafide`, bonafideFile);
                if (url) {
                    idProofUrl = url;
                }
            }

            if (dciCertFile) {
                const url = await uploadBonafide(`${user.mobile || user.id}_dci`, dciCertFile);
                if (url) {
                    dciCertificateUrl = url;
                }
            }

            const updates: any = {
                college: missingForm.college || null,
                course: missingForm.course || null,
                year: missingForm.year || 'N/A',
                delegateType: missingForm.delegateType || null,
                dciNumber: missingForm.dciNumber || null,
                speciality: missingForm.speciality || null,
                state: missingForm.state || null,
                qualification: missingForm.qualification || null,
                yearsOfPractice: missingForm.yearsOfPractice ? parseInt(missingForm.yearsOfPractice, 10) : null,
                academicPosition: missingForm.academicPosition || null,
                teachingExperience: missingForm.teachingExperience || null,
                idProofUrl: idProofUrl || null,
                dciCertificateUrl: dciCertificateUrl || null,
            };

            await updateEventStudent(user.id, updates);
            toast.success("Profile updated successfully!");
            setManuallyClosed(true);
            setCompleteProfileDismissed(true);
            await refreshUser();
        } catch (error: any) {
            console.error(error);
            toast.error(error.message || "Failed to update profile.");
        } finally {
            setSubmittingMissing(false);
        }
    };

    const handlePayment = async (amount: number) => {
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
                        program: currentProgram,
                    });
                    if (payError) console.error("Payment record error:", payError);
                }

                // 4. Send official registration confirmation email
                try {
                    const { sendPaymentSuccessEmail } = await import("@/services/emailService");
                    await sendPaymentSuccessEmail({
                        student_name: participantName,
                        student_email: user?.email || '',
                        midas_id: midasId,
                        id_card_number: (user as any)?.idCardNumber || 'N/A',
                        payment_reference: paymentId,
                        amount_paid: `₹${amount}.00`,
                        payment_date: new Date().toLocaleDateString("en-IN"),
                        college_name: collegeName,
                        event_type: isIcon ? "Professional Delegate" : "UG Delegate",
                        qr_code_url: qrCodeUrl,
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
            name: `${isIcon ? 'Madras ICON' : 'MIDAS'} Scientific Event`,
            description: `${isIcon ? 'Professional' : 'UG'} Delegate Registration Fee`,
            handler: async function (response: any) {
                await processSuccess(response.razorpay_payment_id);
            },
            prefill: {
                name: user?.name,
                email: user?.email,
                contact: user?.phone || "9999999999",
            },
            theme: { color: isIcon ? "#b91c1c" : "#004d40" },
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
                <div className="flex-grow rounded-2xl overflow-hidden shadow-sm flex items-center justify-center h-[110px] border border-[#b00004]" style={{ backgroundColor: '#d30005' }}>
                    <img src="/silver.png" alt="Silver Sponsor" className="w-full h-full object-contain p-1" />
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
            {(!isPaid || !isApproved || isRejected) && (
                <div className={`bg-white rounded-2xl border overflow-hidden shadow-sm ${
                    isRejected ? "border-red-200" : !isApproved ? "border-amber-200" : "border-amber-200"
                }`}>
                    <div className={`p-6 flex flex-col md:flex-row items-center justify-between gap-6 ${
                        isRejected ? "bg-red-50" : !isApproved ? "bg-amber-50/80" : "bg-amber-50"
                    }`}>
                        <div className="flex items-start gap-4">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${
                                isRejected ? "bg-red-100 text-red-600" : !isApproved ? "bg-amber-100 text-amber-600" : "bg-amber-100 text-amber-600"
                            }`}>
                                {isRejected ? <XCircle className="w-6 h-6 text-red-600" /> : <Clock className="w-6 h-6 text-amber-600 animate-spin" />}
                            </div>
                            <div>
                                <h3 className={`text-lg font-bold ${isRejected ? "text-red-900" : "text-amber-900"}`}>
                                    {isRejected
                                        ? "Registration Rejected"
                                        : !isApproved
                                            ? "Staff Coordinator Approval Pending"
                                            : "Payment Required"}
                                </h3>
                                <p className={`mt-1 text-sm max-w-xl leading-relaxed ${isRejected ? "text-red-700" : "text-amber-800"}`}>
                                    {isRejected
                                        ? "Your registration has been rejected by the staff coordinator. Please contact support."
                                        : !isApproved
                                            ? isPaid
                                                ? `Your registration fee payment of ₹1.00 is confirmed! Your profile and documents are currently awaiting verification and approval by your Staff Coordinator (${user?.college || "your college"}).`
                                                : `Your staff coordinator is reviewing your registration. Please complete the registration fee payment to receive your ${isIcon ? 'ICON' : 'MIDAS'} ID.`
                                            : "Your registration is approved! Please complete the payment of ₹1.00 to unlock event dashboard features and abstract submission."}
                                </p>
                            </div>
                        </div>

                        {isApproved && !isPaid && (
                            <div className="flex flex-col gap-2 shrink-0 w-full md:w-auto">
                                <Button
                                    onClick={() => handlePayment(1)}
                                    disabled={loadingPayment}
                                    className={`${themeColor} text-white font-bold h-12 px-8 rounded-xl shadow-lg`}
                                >
                                    {loadingPayment ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CreditCard className="w-4 h-4 mr-2" />}
                                    Pay Now — ₹1.00
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
                    <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-3 flex-wrap">
                            <h3 className="text-xl font-black text-slate-900 truncate">{user?.name}</h3>
                            {isRejected ? (
                                <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 font-bold text-xs gap-1 py-1 px-3">
                                    <XCircle className="w-3.5 h-3.5 text-red-600" /> Registration Rejected
                                </Badge>
                            ) : !isApproved ? (
                                <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300 font-bold text-xs gap-1.5 py-1 px-3 shadow-xs">
                                    <Clock className="w-3.5 h-3.5 text-amber-600 animate-pulse" /> Staff Coordinator Approval Pending
                                </Badge>
                            ) : (
                                <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-300 font-bold text-xs gap-1.5 py-1 px-3 shadow-xs">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Approved by Staff Coordinator
                                </Badge>
                            )}
                        </div>
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
                                {user?.registrationId && (
                                    <p className="text-[10px] text-slate-500 mt-1 font-mono font-semibold tracking-wider">
                                        Reg ID: {user.registrationId}
                                    </p>
                                )}

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
                            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
                                {isIcon ? "ICON ID" : "MIDAS ID"}
                            </span>
                            <span className="font-mono font-bold text-slate-800 block">{user?.midasId}</span>
                            {user?.registrationId && (
                                <span className="text-[10px] text-slate-500 font-mono font-semibold block mt-0.5">
                                    Reg ID: {user.registrationId}
                                </span>
                            )}

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

            {/* Complete Profile Popup */}
            <Dialog open={!!showMissingFieldsPopup}>
                <DialogContent className="sm:max-w-lg rounded-3xl p-6" onPointerDownOutside={(e) => e.preventDefault()}>
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold flex items-center gap-2 text-amber-600">
                            <AlertCircle className="w-5 h-5" /> Please Complete Your Profile
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4 my-4 max-h-[60vh] overflow-y-auto px-1">
                        <p className="text-sm text-slate-500">
                            Before accessing your dashboard, please fill in the following missing registration details:
                        </p>

                        {(!user?.college || user.college.trim() === "" || ((user as any)?.delegateType !== "Clinician" && user.college.trim() === "N/A")) && (
                            <div className="space-y-1.5">
                                <Label htmlFor="missing-college">College *</Label>
                                <Select 
                                    value={missingForm.college} 
                                    onValueChange={(val) => setMissingForm({ ...missingForm, college: val })}
                                    disabled={isLoadingColleges}
                                >
                                    <SelectTrigger id="missing-college">
                                        <SelectValue placeholder={isLoadingColleges ? "Loading colleges..." : "Select College"} />
                                    </SelectTrigger>
                                    <SelectContent className="max-h-[200px]">
                                        {colleges.map(c => <SelectItem key={c.value} value={c.label}>{c.label}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        {isMidas ? (
                            <>
                                <div className="space-y-1.5">
                                    <Label htmlFor="missing-course">Course *</Label>
                                    <Select 
                                        value={missingForm.course} 
                                        onValueChange={(val) => setMissingForm({ ...missingForm, course: val })}
                                    >
                                        <SelectTrigger id="missing-course">
                                            <SelectValue placeholder="Select Course" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {courses.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="missing-year">Year *</Label>
                                    <Select 
                                        value={missingForm.year} 
                                        onValueChange={(val) => setMissingForm({ ...missingForm, year: val })}
                                    >
                                        <SelectTrigger id="missing-year">
                                            <SelectValue placeholder="Select Year" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {yearOptions.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="missing-bonafide">ID Proof / Bonafide upload (Optional)</Label>
                                    <Input
                                        id="missing-bonafide"
                                        type="file"
                                        onChange={(e) => setBonafideFile(e.target.files?.[0] || null)}
                                    />
                                    {user?.idProofUrl && (
                                        <p className="text-xs text-green-600">✓ Bonafide document already uploaded</p>
                                    )}
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="space-y-1.5">
                                    <Label htmlFor="missing-delegate-type">Delegate Type *</Label>
                                    <Select 
                                        value={missingForm.delegateType} 
                                        onValueChange={(val) => setMissingForm({ ...missingForm, delegateType: val })}
                                    >
                                        <SelectTrigger id="missing-delegate-type">
                                            <SelectValue placeholder="Select Delegate Type" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="PG">Postgraduate (PG)</SelectItem>
                                            <SelectItem value="Academician">Academician</SelectItem>
                                            <SelectItem value="Clinician">Clinician</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {missingForm.delegateType && (
                                    <>
                                        <div className="space-y-1.5">
                                            <Label htmlFor="missing-dci">DCI Number *</Label>
                                            <Input
                                                id="missing-dci"
                                                value={missingForm.dciNumber}
                                                onChange={(e) => setMissingForm({ ...missingForm, dciNumber: e.target.value })}
                                                placeholder="Enter DCI Number"
                                            />
                                        </div>

                                        <div className="space-y-1.5">
                                            <Label htmlFor="missing-dci-cert">DCI Certificate *</Label>
                                            <Input
                                                id="missing-dci-cert"
                                                type="file"
                                                onChange={(e) => setDciCertFile(e.target.files?.[0] || null)}
                                            />
                                            {(user as any)?.dciCertificateUrl && (
                                                <p className="text-xs text-green-600">✓ DCI certificate already uploaded</p>
                                            )}
                                        </div>
                                    </>
                                )}

                                {missingForm.delegateType === 'PG' && (
                                    <>
                                        <div className="space-y-1.5">
                                            <Label htmlFor="missing-year">MDS Year (Optional)</Label>
                                            <Select 
                                                value={missingForm.year} 
                                                onValueChange={(val) => setMissingForm({ ...missingForm, year: val })}
                                            >
                                                <SelectTrigger id="missing-year">
                                                    <SelectValue placeholder="Select Year" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="1st Year MDS">1st Year MDS</SelectItem>
                                                    <SelectItem value="2nd Year MDS">2nd Year MDS</SelectItem>
                                                    <SelectItem value="3rd Year MDS">3rd Year MDS</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label htmlFor="missing-bonafide-icon">Bonafide Certificate *</Label>
                                            <Input
                                                id="missing-bonafide-icon"
                                                type="file"
                                                onChange={(e) => setBonafideFile(e.target.files?.[0] || null)}
                                            />
                                            {((user as any)?.bonafideUrl || user?.idProofUrl) && (
                                                <p className="text-xs text-green-600">✓ Bonafide certificate already uploaded</p>
                                            )}
                                        </div>
                                    </>
                                )}

                                {(missingForm.delegateType === 'Academician' || missingForm.delegateType === 'Clinician') && (
                                    <>
                                        <div className="space-y-1.5">
                                            <Label htmlFor="missing-qualification">Qualification (Optional)</Label>
                                            <Select 
                                                value={missingForm.qualification} 
                                                onValueChange={(val) => setMissingForm({ ...missingForm, qualification: val })}
                                            >
                                                <SelectTrigger id="missing-qualification">
                                                    <SelectValue placeholder="Select Qualification" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="BDS">BDS</SelectItem>
                                                    <SelectItem value="MDS">MDS</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </>
                                )}

                                {missingForm.delegateType === 'Academician' && (
                                    <>
                                        <div className="space-y-1.5">
                                            <Label htmlFor="missing-academic-pos">Academic Position (Optional)</Label>
                                            <Input
                                                id="missing-academic-pos"
                                                value={missingForm.academicPosition}
                                                onChange={(e) => setMissingForm({ ...missingForm, academicPosition: e.target.value })}
                                                placeholder="e.g. Assistant Professor"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label htmlFor="missing-teaching-exp">Teaching Experience (Years) (Optional)</Label>
                                            <Input
                                                id="missing-teaching-exp"
                                                value={missingForm.teachingExperience}
                                                onChange={(e) => setMissingForm({ ...missingForm, teachingExperience: e.target.value })}
                                                placeholder="e.g. 5"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label htmlFor="missing-bonafide-icon">Bonafide Certificate *</Label>
                                            <Input
                                                id="missing-bonafide-icon"
                                                type="file"
                                                onChange={(e) => setBonafideFile(e.target.files?.[0] || null)}
                                            />
                                            {((user as any)?.bonafideUrl || user?.idProofUrl) && (
                                                <p className="text-xs text-green-600">✓ Bonafide certificate already uploaded</p>
                                            )}
                                        </div>
                                    </>
                                )}

                                {missingForm.delegateType === 'Clinician' && (
                                    <div className="space-y-1.5">
                                        <Label htmlFor="missing-practice-years">Years of Practice (Optional)</Label>
                                        <Input
                                            id="missing-practice-years"
                                            type="number"
                                            value={missingForm.yearsOfPractice}
                                            onChange={(e) => setMissingForm({ ...missingForm, yearsOfPractice: e.target.value })}
                                            placeholder="e.g. 10"
                                        />
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    <DialogFooter className="flex gap-2">
                        <Button onClick={logout} variant="outline" className="rounded-xl border-red-200 text-red-600 hover:bg-red-50">
                            Sign Out
                        </Button>
                        <Button onClick={handleSaveMissingFields} disabled={submittingMissing} className="rounded-xl">
                            {submittingMissing ? "Saving..." : "Save Details"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </motion.div>
    );
}
