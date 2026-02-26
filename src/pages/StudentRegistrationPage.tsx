
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Stethoscope, GraduationCap, CreditCard, Loader2, CheckCircle2, ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/lib/supabaseClient";
import { generateMidasId, generateQRCodeUrl, sendRegistrationEmail } from "@/services/emailService";
import { uploadBonafide, getEventStudentCount } from "@/services/supabaseService";

const colleges = [
    "KLE VK Institute of Dental Sciences, Belagavi",
    "SDM College of Dental Sciences, Dharwad",
    "Government Dental College, Bangalore",
    "Bapuji Dental College, Davangere",
    "Manipal College of Dental Sciences",
    "Other"
];

const years = [
    "1st Year",
    "2nd Year",
    "3rd Year",
    "4th Year",
    "Intern"
];

declare global {
    interface Window {
        Razorpay: any;
    }
}

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

export default function StudentRegistrationPage() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [generatedMidasId, setGeneratedMidasId] = useState("");

    const [formData, setFormData] = useState({
        participantName: "",
        email: "",
        mobile: "",
        college: "",
        otherCollege: "",
        year: "",
    });

    const [bonafideFile, setBonafideFile] = useState<File | null>(null);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.id]: e.target.value });
    };

    const handleSelectChange = (field: string, value: string) => {
        setFormData({ ...formData, [field]: value });
    };

    const initRazorpay = async () => {
        if (!formData.participantName.trim()) { toast.error("Please enter your name"); return; }
        if (!formData.email.trim()) { toast.error("Please enter your email"); return; }
        if (!formData.mobile.trim() || formData.mobile.length !== 10) { toast.error("Please enter valid 10-digit mobile number"); return; }
        if (!formData.college) { toast.error("Please select your college"); return; }
        if (!formData.year) { toast.error("Please select your year"); return; }
        if (formData.college === "Other" && !formData.otherCollege.trim()) { toast.error("Please specify your college name"); return; }
        if (!bonafideFile) { toast.error("Please select a bonafide or ID proof to upload"); return; }

        setLoading(true);
        const res = await loadRazorpayScript();
        if (!res) {
            toast.error("Razorpay SDK failed to load. Are you offline?");
            setLoading(false);
            return;
        }
        setLoading(false);

        const razorpayKey = import.meta.env.VITE_RAZORPAY_LIVE_KEY;
        if (!razorpayKey) {
            toast.error("Payment configuration error. Please contact admin.");
            return;
        }

        const options = {
            key: razorpayKey,
            amount: 103000,
            currency: "INR",
            name: "MIDAS Scientific Event",
            description: "UG Delegate Registration Fee",
            handler: async function (response: any) {
                setLoading(true);
                try {
                    const collegeName = formData.college === "Other" ? formData.otherCollege : formData.college;
                    console.log("Razorpay payment success, registering student...", response.razorpay_payment_id);

                    // 1. Get current student count for MIDAS ID sequence
                    const currentCount = await getEventStudentCount();
                    const midasId = generateMidasId(currentCount + 1);
                    const qrCodeUrl = generateQRCodeUrl(midasId, formData.participantName, collegeName);

                    console.log("Generated MIDAS ID:", midasId, "QR:", qrCodeUrl);

                    // 1.5. Upload Bonafide using dummy user ID for now since auth user may not exist yet
                    // or we could use the midasId as a unique folder/file name identifier. Let's use midasId.
                    let idProofUrl = undefined;
                    if (bonafideFile) {
                        const url = await uploadBonafide(midasId, bonafideFile);
                        if (url) {
                            idProofUrl = url;
                        } else {
                            console.warn("Failed to upload bonafide during registration.");
                            toast.error("Warning: ID Proof could not be uploaded. You may need to provide it later.");
                        }
                    }

                    // 2. Register student in Supabase with MIDAS ID
                    const { data: student, error } = await supabase.from("event_students").insert({
                        participantName: formData.participantName,
                        email: formData.email,
                        mobile: formData.mobile,
                        college: collegeName,
                        year: formData.year,
                        paymentStatus: "PAID",
                        paymentId: response.razorpay_payment_id,
                        approvalStatus: "PENDING",
                        midasId: midasId,
                        qrCodeUrl: qrCodeUrl,
                        idProofUrl: idProofUrl, // store the uploaded bonafide URL
                    }).select().single();

                    if (error) {
                        console.error("Supabase insert error:", error);
                        throw error;
                    }

                    console.log("Student registered:", student);

                    // 3. Record payment
                    const { error: payError } = await supabase.from("payments").insert({
                        eventStudentId: student.id,
                        amount: 1030,
                        currency: "INR",
                        status: "PAID",
                        paymentGatewayId: response.razorpay_payment_id,
                        transactionId: response.razorpay_payment_id,
                    });

                    if (payError) console.error("Payment record error (non-blocking):", payError);

                    // 4. Send registration confirmation email
                    try {
                        const emailResult = await sendRegistrationEmail({
                            student_name: formData.participantName,
                            student_email: formData.email,
                            midas_id: midasId,
                            college_name: collegeName,
                            event_type: "UG Delegate",
                            mode: "Offline",
                            qr_code_url: qrCodeUrl,
                            registration_date: new Date().toLocaleDateString("en-IN"),
                        });
                        if (emailResult.success) {
                            console.log("Registration email sent successfully");
                        } else {
                            console.warn("Email send failed:", emailResult.error);
                        }
                    } catch (emailErr) {
                        console.warn("Email sending error (non-blocking):", emailErr);
                    }

                    // 5. Store MIDAS ID for success dialog
                    setGeneratedMidasId(midasId);
                    setLoading(false);
                    setShowSuccess(true);
                } catch (err: any) {
                    console.error("Registration Error:", err);
                    if (err?.code === "23505") {
                        toast.error("An account with this email or mobile number is already registered.");
                    } else {
                        const msg = err?.message || err?.details || JSON.stringify(err);
                        toast.error("Registration failed: " + msg);
                        alert("Payment received but registration failed.\n\nError: " + msg + "\n\nPayment ID: " + response.razorpay_payment_id);
                    }
                    setLoading(false);
                }
            },
            prefill: {
                name: formData.participantName,
                email: formData.email,
                contact: formData.mobile,
            },
            theme: { color: "#004d40" },
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

    return (
        <div className="min-h-screen flex flex-col lg:flex-row font-sans">
            {/* LEFT PANEL — same branding style as member login */}
            <div className="w-full lg:w-1/2 bg-gradient-to-br from-[#004d40] to-[#2e7d32] flex items-center justify-center p-8 lg:p-12 text-white relative overflow-hidden">
                {/* decorative circles */}
                <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-white/5" />
                <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-white/5" />

                <motion.div
                    className="max-w-md space-y-6 relative z-10"
                    initial={{ opacity: 0, x: -50 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.8 }}
                >
                    <div className="flex items-center gap-4">
                        <div className="bg-white/10 p-3 rounded-2xl backdrop-blur-sm border border-white/20">
                            <Stethoscope className="w-10 h-10 text-white" />
                        </div>
                        <h1 className="text-5xl font-bold tracking-tight">MIDAS</h1>
                    </div>

                    <div className="space-y-4">
                        <h2 className="text-3xl font-semibold leading-tight">
                            Registration For UG Delegate
                        </h2>
                        <p className="text-white/80 text-lg leading-relaxed font-light">
                            Register for the inter-college dental scientific symposium. Complete the form and pay the registration fee to secure your spot.
                        </p>
                    </div>

                    <div className="space-y-3 pt-4">
                        <div className="flex items-center gap-3 text-white/70">
                            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                                <span className="text-sm font-bold text-white">1</span>
                            </div>
                            <span className="text-sm">Fill in your personal details</span>
                        </div>
                        <div className="flex items-center gap-3 text-white/70">
                            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                                <span className="text-sm font-bold text-white">2</span>
                            </div>
                            <span className="text-sm">Pay ₹1030 registration fee online</span>
                        </div>
                        <div className="flex items-center gap-3 text-white/70">
                            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                                <span className="text-sm font-bold text-white">3</span>
                            </div>
                            <span className="text-sm">Wait for approval and get your MIDAS ID</span>
                        </div>
                    </div>

                    <div className="pt-8 border-t border-white/10 flex items-center gap-3 text-white/60">
                        <GraduationCap className="w-5 h-5" />
                        <span className="text-sm font-medium uppercase tracking-wider">External Student Registration</span>
                    </div>
                </motion.div>
            </div>

            {/* RIGHT PANEL — form */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-6 bg-slate-50 overflow-y-auto">
                <motion.div
                    className="w-full max-w-lg bg-white p-8 rounded-3xl shadow-xl border border-slate-100 my-4"
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                >
                    <button
                        onClick={() => navigate("/")}
                        className="flex items-center gap-2 text-slate-400 hover:text-slate-700 transition-colors text-sm mb-6"
                    >
                        <ArrowLeft className="w-4 h-4" /> Back to home
                    </button>

                    <div className="mb-6">
                        <h3 className="text-2xl font-bold text-slate-900">UG DELEGATE REGISTRATION</h3>
                        <p className="text-slate-500 mt-1 text-sm">Fill in your details and pay the registration fee.</p>
                    </div>

                    <form
                        onSubmit={(e) => { e.preventDefault(); initRazorpay(); }}
                        className="space-y-5"
                    >
                        {/* Participant Name */}
                        <div className="space-y-2">
                            <Label htmlFor="participantName" className="text-slate-700 font-medium">Participant Name <span className="text-red-500">*</span></Label>
                            <Input
                                id="participantName"
                                type="text"
                                placeholder="Full Name"
                                value={formData.participantName}
                                onChange={handleInputChange}
                                required
                                className="h-12 rounded-xl bg-slate-50/50 border-slate-200 focus:ring-2 focus:ring-[#004d40]/20"
                            />
                        </div>

                        {/* Email */}
                        <div className="space-y-2">
                            <Label htmlFor="email" className="text-slate-700 font-medium">Email Address <span className="text-red-500">*</span></Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="yourname@college.edu"
                                value={formData.email}
                                onChange={handleInputChange}
                                required
                                className="h-12 rounded-xl bg-slate-50/50 border-slate-200 focus:ring-2 focus:ring-[#004d40]/20"
                            />
                        </div>

                        {/* Mobile */}
                        <div className="space-y-2">
                            <Label htmlFor="mobile" className="text-slate-700 font-medium">Mobile Number <span className="text-red-500">*</span></Label>
                            <Input
                                id="mobile"
                                type="tel"
                                placeholder="10-digit mobile number"
                                value={formData.mobile}
                                onChange={handleInputChange}
                                required
                                maxLength={10}
                                className="h-12 rounded-xl bg-slate-50/50 border-slate-200 focus:ring-2 focus:ring-[#004d40]/20"
                            />
                        </div>

                        {/* College & Year — side-by-side on desktop */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-slate-700 font-medium">College <span className="text-red-500">*</span></Label>
                                <Select value={formData.college} onValueChange={(v) => handleSelectChange("college", v)}>
                                    <SelectTrigger className="h-12 rounded-xl bg-slate-50/50 border-slate-200">
                                        <SelectValue placeholder="Select College" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {colleges.map((c) => (
                                            <SelectItem key={c} value={c}>{c}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-slate-700 font-medium">Year <span className="text-red-500">*</span></Label>
                                <Select value={formData.year} onValueChange={(v) => handleSelectChange("year", v)}>
                                    <SelectTrigger className="h-12 rounded-xl bg-slate-50/50 border-slate-200">
                                        <SelectValue placeholder="Select Year" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {years.map((y) => (
                                            <SelectItem key={y} value={y}>{y}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Other college (conditional) */}
                        {formData.college === "Other" && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                className="space-y-2"
                            >
                                <Label htmlFor="otherCollege" className="text-slate-700 font-medium">Specify College Name <span className="text-red-500">*</span></Label>
                                <Input
                                    id="otherCollege"
                                    type="text"
                                    placeholder="Name of your institution"
                                    value={formData.otherCollege}
                                    onChange={handleInputChange}
                                    required
                                    className="h-12 rounded-xl bg-slate-50/50 border-slate-200 focus:ring-2 focus:ring-[#004d40]/20"
                                />
                            </motion.div>
                        )}

                        {/* ID Proof / Bonafide Upload */}
                        <div className="space-y-2">
                            <Label htmlFor="idProof" className="text-slate-700 font-medium">College ID Card / Bonafide <span className="text-red-500">*</span></Label>
                            <Input
                                type="file"
                                id="idProof"
                                accept="image/*,.pdf"
                                onChange={(e) => {
                                    if (e.target.files && e.target.files.length > 0) {
                                        setBonafideFile(e.target.files[0]);
                                    }
                                }}
                                required
                                className="h-12 rounded-xl bg-slate-50/50 border-slate-200 focus:ring-2 focus:ring-[#004d40]/20 pt-2.5"
                            />
                            <p className="text-xs text-slate-500">Max size 5MB. PDF or Image.</p>
                        </div>

                        {/* Fee & Payment section */}
                        <div className="mt-2 p-5 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
                            <div>
                                <Label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Registration Fee</Label>
                                <div className="mt-2 flex items-center gap-3 p-3 bg-white rounded-xl border border-[#004d40]/20">
                                    <div className="w-3 h-3 rounded-full bg-[#004d40]" />
                                    <span className="text-slate-800 font-semibold">Charges for UG:</span>
                                    <span className="ml-auto text-lg font-black text-[#004d40]">₹1030/-</span>
                                </div>
                            </div>

                            <div>
                                <Label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Payment Mode</Label>
                                <div className="mt-2 flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-200">
                                    <CreditCard className="w-4 h-4 text-[#004d40]" />
                                    <span className="text-slate-700 font-medium text-sm">Online Payment (Razorpay)</span>
                                    <div className="ml-auto w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                </div>
                            </div>
                        </div>

                        {/* Pay Now */}
                        <Button
                            type="submit"
                            className="w-full h-14 bg-[#004d40] hover:bg-[#003d33] text-white rounded-xl shadow-lg transition-all active:scale-[0.98] text-base font-bold"
                            disabled={loading}
                        >
                            {loading ? (
                                <div className="flex items-center gap-2">
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    <span>Processing...</span>
                                </div>
                            ) : (
                                "Pay Now — ₹1030"
                            )}
                        </Button>

                        {/* Test Payment Button — ₹1 */}
                        <Button
                            type="button"
                            variant="outline"
                            className="w-full h-12 rounded-xl border-dashed border-2 border-amber-400 text-amber-700 hover:bg-amber-50 font-bold"
                            disabled={loading}
                            onClick={() => {
                                // Validate form before test payment too
                                if (!formData.participantName.trim()) { toast.error("Please enter your name"); return; }
                                if (!formData.email.trim()) { toast.error("Please enter your email"); return; }
                                if (!formData.mobile.trim() || formData.mobile.length !== 10) { toast.error("Please enter valid 10-digit mobile number"); return; }
                                if (!formData.college) { toast.error("Please select your college"); return; }
                                if (!formData.year) { toast.error("Please select your year"); return; }
                                if (formData.college === "Other" && !formData.otherCollege.trim()) { toast.error("Please specify your college name"); return; }
                                if (!bonafideFile) { toast.error("Please select a bonafide or ID proof to upload"); return; }

                                setLoading(true);
                                loadRazorpayScript().then((res) => {
                                    setLoading(false);
                                    if (!res) {
                                        toast.error("Razorpay SDK failed to load");
                                        return;
                                    }

                                    const razorpayKey = import.meta.env.VITE_RAZORPAY_LIVE_KEY;
                                    if (!razorpayKey) { toast.error("Razorpay key not found"); return; }
                                    const rzp = new window.Razorpay({
                                        key: razorpayKey,
                                        amount: 100,
                                        currency: "INR",
                                        name: "MIDAS — Test Payment",
                                        description: "Test charge of ₹1",
                                        handler: async function (response: any) {
                                            setLoading(true);
                                            try {
                                                const collegeName = formData.college === "Other" ? formData.otherCollege : formData.college;
                                                console.log("Test payment success, registering student...", response.razorpay_payment_id);

                                                const currentCount = await getEventStudentCount();
                                                const midasId = generateMidasId(currentCount + 1);
                                                const qrCodeUrl = generateQRCodeUrl(midasId, formData.participantName, collegeName);

                                                let idProofUrl = undefined;
                                                if (bonafideFile) {
                                                    const url = await uploadBonafide(midasId, bonafideFile);
                                                    if (url) {
                                                        idProofUrl = url;
                                                    } else {
                                                        console.warn("Failed to upload bonafide during registration.");
                                                        toast.error("Warning: ID Proof could not be uploaded. You may need to provide it later.");
                                                    }
                                                }

                                                // Register student in Supabase
                                                const { data: student, error } = await supabase.from("event_students").insert({
                                                    participantName: formData.participantName,
                                                    email: formData.email,
                                                    mobile: formData.mobile,
                                                    college: collegeName,
                                                    year: formData.year,
                                                    paymentStatus: "PAID",
                                                    paymentId: response.razorpay_payment_id,
                                                    approvalStatus: "PENDING",
                                                    midasId: midasId,
                                                    qrCodeUrl: qrCodeUrl,
                                                    idProofUrl: idProofUrl, // store the uploaded bonafide URL
                                                }).select().single();

                                                if (error) {
                                                    console.error("Supabase insert error:", error);
                                                    throw error;
                                                }

                                                console.log("Student registered:", student);

                                                // Record payment
                                                const { error: payError } = await supabase.from("payments").insert({
                                                    eventStudentId: student.id,
                                                    amount: 1,
                                                    currency: "INR",
                                                    status: "PAID",
                                                    paymentGatewayId: response.razorpay_payment_id,
                                                    transactionId: response.razorpay_payment_id,
                                                });

                                                if (payError) console.error("Payment record error (non-blocking):", payError);

                                                // 4. Send registration confirmation email
                                                try {
                                                    const emailResult = await sendRegistrationEmail({
                                                        student_name: formData.participantName,
                                                        student_email: formData.email,
                                                        midas_id: midasId,
                                                        college_name: collegeName,
                                                        event_type: "UG Delegate",
                                                        mode: "Offline",
                                                        qr_code_url: qrCodeUrl,
                                                        registration_date: new Date().toLocaleDateString("en-IN"),
                                                    });
                                                    if (emailResult.success) {
                                                        console.log("Registration email sent successfully");
                                                    } else {
                                                        console.warn("Email send failed:", emailResult.error);
                                                    }
                                                } catch (emailErr) {
                                                    console.warn("Email sending error (non-blocking):", emailErr);
                                                }

                                                setGeneratedMidasId(midasId);
                                                setLoading(false);
                                                setShowSuccess(true);
                                                toast.success("✅ Test payment successful! ID: " + response.razorpay_payment_id);
                                            } catch (err: any) {
                                                console.error("Registration Error:", err);
                                                if (err?.code === "23505") {
                                                    toast.error("An account with this email or mobile number is already registered.");
                                                } else {
                                                    const msg = err?.message || err?.details || JSON.stringify(err);
                                                    toast.error("Registration failed: " + msg);
                                                    alert("Payment received but registration failed.\n\nError: " + msg + "\n\nPayment ID: " + response.razorpay_payment_id);
                                                }
                                                setLoading(false);
                                            }
                                        },
                                        prefill: {
                                            name: formData.participantName || "Test User",
                                            email: formData.email || "test@test.com",
                                            contact: formData.mobile || "9999999999",
                                        },
                                        theme: { color: "#d97706" },
                                        modal: {
                                            ondismiss: function () {
                                                toast.info("Payment cancelled.");
                                            }
                                        }
                                    });
                                    rzp.on("payment.failed", (r: any) => toast.error("Test payment failed: " + r.error?.description));
                                    rzp.open();
                                });
                            }}
                        >
                            Test Payment — ₹1
                        </Button>
                    </form>

                    <p className="mt-6 text-center text-slate-500 text-sm">
                        Already registered?{" "}
                        <button
                            onClick={() => navigate("/member-login")}
                            className="text-[#004d40] font-bold hover:underline"
                        >
                            Login here
                        </button>
                    </p>
                </motion.div>
            </div>

            {/* Success Modal */}
            <Dialog open={showSuccess} onOpenChange={(open) => !open && setShowSuccess(false)}>
                <DialogContent className="sm:max-w-md rounded-3xl">
                    <div className="flex flex-col items-center justify-center p-6 text-center">
                        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6">
                            <CheckCircle2 className="w-12 h-12 text-green-600" />
                        </div>
                        <DialogHeader>
                            <DialogTitle className="text-2xl font-bold text-slate-900">Registration Successful</DialogTitle>
                            <DialogDescription className="text-slate-500 text-lg mt-2 font-medium">
                                Waiting for Approval
                            </DialogDescription>
                        </DialogHeader>
                        {generatedMidasId && (
                            <div className="mt-4 bg-[#004d40] text-white p-4 rounded-xl w-full text-center">
                                <p className="text-xs uppercase tracking-wider opacity-70">Your MIDAS ID</p>
                                <p className="text-2xl font-black mt-1 tracking-wide">{generatedMidasId}</p>
                                <p className="text-xs mt-2 opacity-60">Save this — it's your identity for the event</p>
                            </div>
                        )}
                        <div className="mt-4 bg-slate-50 p-4 rounded-xl w-full text-left space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-500">Participant:</span>
                                <span className="font-bold text-slate-800">{formData.participantName}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-500">Amount Paid:</span>
                                <span className="font-bold text-slate-800">₹1030</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-500">Payment Status:</span>
                                <span className="text-green-600 font-bold">Paid ✓</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-500">Approval Status:</span>
                                <span className="text-amber-600 font-bold">Pending</span>
                            </div>
                        </div>
                        <DialogFooter className="mt-8 w-full">
                            <Button onClick={() => navigate("/")} className="w-full h-12 bg-[#004d40] hover:bg-[#003d33] rounded-xl text-white font-bold">
                                Return to Home
                            </Button>
                        </DialogFooter>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
