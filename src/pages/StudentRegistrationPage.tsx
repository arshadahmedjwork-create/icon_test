import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Stethoscope, GraduationCap, Loader2, CheckCircle2, ArrowLeft, Image as ImageIcon, ShieldCheck, CreditCard, AlertTriangle, Download, RefreshCw, XCircle } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { supabase } from "@/lib/supabaseClient";
import { uploadBonafide, uploadPassportPhoto, getCollegesList, checkDuplicateIdCardNumber, recordUndertakingAcceptance, getLatestMidasId } from "@/services/supabaseService";
import { useProgram } from "@/contexts/ProgramContext";
import bcrypt from 'bcryptjs';
import { sendAccountCreationEmail, sendPaymentSuccessEmail, generateMidasId, generateQRCodeUrl } from "@/services/emailService";
import { verifyDciCertificate } from "@/services/dciService";
import DeclarationUndertakingStep from "@/components/legal/DeclarationUndertakingStep";

declare global {
    interface Window {
        Razorpay: any;
    }
}

const midasYears = [
    "1st Year",
    "2nd Year",
    "3rd Year",
    "4th Year",
    "Intern"
];

const iconSpecialities = [
    "Oral & Maxillofacial Surgery",
    "Orthodontics",
    "Periodontics",
    "Conservative Dentistry & Endodontics",
    "Prosthodontics",
    "Oral Medicine & Radiology",
    "Oral Pathology",
    "Pedodontics",
    "Public Health Dentistry"
];

const indianStates = [
    "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat",
    "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh",
    "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab",
    "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh",
    "Uttarakhand", "West Bengal", "Andaman and Nicobar Islands", "Chandigarh",
    "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Jammu and Kashmir",
    "Ladakh", "Lakshadweep", "Puducherry"
];

export default function StudentRegistrationPage() {
    const navigate = useNavigate();
    const { currentProgram } = useProgram();
    const isIcon = currentProgram === 'ICON';

    // Steps: 'form' | 'declaration' | 'payment' | 'success' | 'cancelled' | 'failed'
    const [currentStep, setCurrentStep] = useState<'form' | 'declaration' | 'payment' | 'success' | 'cancelled' | 'failed'>('form');
    const [loading, setLoading] = useState(false);
    const [collegesList, setCollegesList] = useState<{ value: string, label: string }[]>([]);

    useEffect(() => {
        const fetchColleges = async () => {
            const list = await getCollegesList();
            setCollegesList(list);
        };
        fetchColleges();

        // Load Razorpay script
        if (typeof window !== "undefined" && !(window as any).Razorpay) {
            const script = document.createElement("script");
            script.src = "https://checkout.razorpay.com/v1/checkout.js";
            script.async = true;
            document.body.appendChild(script);
        }
    }, []);

    const [delegateType, setDelegateType] = useState<'PG' | 'Clinician' | 'Academician' | 'UG'>(isIcon ? 'PG' : 'UG');

    const [formData, setFormData] = useState({
        firstName: "",
        lastName: "",
        idCardNumber: "",
        gender: "",
        email: "",
        mobile: "",
        college: "",
        otherCollege: "",
        year: "",
        // ICON Specific
        dciNumber: "",
        state: "",
        speciality: "",
        qualification: "",
        yearsOfPractice: "",
        academicPosition: "",
        teachingExperience: "",
        hodName: "",
    });

    const [passportPhotoFile, setPassportPhotoFile] = useState<File | null>(null);
    const [passportPhotoPreviewUrl, setPassportPhotoPreviewUrl] = useState<string | null>(null);
    const [bonafideFile, setBonafideFile] = useState<File | null>(null);
    const [dciCertFile, setDciCertFile] = useState<File | null>(null);

    // Registration & Payment Results
    const [createdStudentId, setCreatedStudentId] = useState<string | null>(null);
    const [assignedMidasId, setAssignedMidasId] = useState<string | null>(null);
    const [assignedQrCodeUrl, setAssignedQrCodeUrl] = useState<string | null>(null);
    const [paymentReference, setPaymentReference] = useState<string | null>(null);
    const [paymentErrorMsg, setPaymentErrorMsg] = useState<string | null>(null);
    const [undertakingData, setUndertakingData] = useState<any>(null);

    const themeColor = isIcon ? "#b91c1c" : "#004d40"; // Red-700 vs Green-900
    const themeGradient = isIcon
        ? "from-[#7f1d1d] to-[#b91c1c]"
        : "from-[#004d40] to-[#2e7d32]";

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.id]: e.target.value });
    };

    const handleSelectChange = (field: string, value: string) => {
        const updatedData = { ...formData, [field]: value };
        if (field === 'qualification' && value === 'BDS') {
            updatedData.speciality = "";
        }
        setFormData(updatedData);
    };

    const handlePassportPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) {
            setPassportPhotoFile(null);
            setPassportPhotoPreviewUrl(null);
            return;
        }

        // Validate File Type
        const validTypes = ['image/jpeg', 'image/jpg', 'image/png'];
        if (!validTypes.includes(file.type)) {
            toast.error("Invalid image format. Please upload a JPG, JPEG, or PNG passport photo.");
            e.target.value = "";
            return;
        }

        // Validate File Size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            toast.error("Passport photo file size must be less than 5MB.");
            e.target.value = "";
            return;
        }

        setPassportPhotoFile(file);
        const objectUrl = URL.createObjectURL(file);
        setPassportPhotoPreviewUrl(objectUrl);
    };

    // Form Validation (Step 1 -> Step 2)
    const handleProceedToDeclaration = async () => {
        // Required Field Validations
        if (!formData.firstName.trim()) { toast.error("Please enter your first name."); return; }
        if (!formData.lastName.trim()) { toast.error("Please enter your last name."); return; }
        if (!formData.idCardNumber.trim()) { toast.error("Please enter your ID Card Number."); return; }
        if (!formData.gender) { toast.error("Please select your gender."); return; }
        if (!passportPhotoFile) { toast.error("Please upload your passport-size photo."); return; }

        if (!formData.email.trim() || !formData.email.includes("@")) { toast.error("Please enter a valid email address."); return; }
        if (!formData.mobile.trim() || formData.mobile.length !== 10 || !/^\d+$/.test(formData.mobile.trim())) {
            toast.error("Please enter a valid 10-digit mobile number.");
            return;
        }

        if (isIcon) {
            if ((delegateType === 'Clinician' || delegateType === 'Academician' || delegateType === 'PG') && !formData.dciNumber.trim()) {
                toast.error("DCI Number is required."); return;
            }
            if ((delegateType === 'Clinician' || delegateType === 'Academician') && !formData.qualification) {
                toast.error("Qualification is required."); return;
            }
            if ((delegateType === 'PG' || formData.qualification === 'MDS') && !formData.speciality) {
                toast.error("Speciality is required."); return;
            }
            if (delegateType === 'PG' && !formData.year) { toast.error("Year of study is required."); return; }

            if (delegateType !== 'Clinician' && !bonafideFile) { toast.error("Please upload bonafide certificate."); return; }
            if (!dciCertFile) { toast.error("Please upload DCI certificate."); return; }
        } else {
            if (!formData.college) { toast.error("Please select your college."); return; }
            if (!formData.year) { toast.error("Please select your year of study."); return; }
            if (!bonafideFile) { toast.error("Please upload ID proof / Bonafide certificate."); return; }
        }

        // Duplicate Check for ID Card Number
        setLoading(true);
        try {
            const isDuplicateIdCard = await checkDuplicateIdCardNumber(formData.idCardNumber.trim());
            if (isDuplicateIdCard) {
                toast.error("An account with this ID Card Number already exists. Please check your details.");
                setLoading(false);
                return;
            }
            setLoading(false);
            setCurrentStep('declaration');
        } catch (err) {
            setLoading(false);
            setCurrentStep('declaration');
        }
    };

    // Step 2 -> Step 3: Initiate Registration & Payment
    const handleInitiatePayment = async (acceptanceData: {
        declarationAccepted: boolean;
        termsAccepted: boolean;
        refundPolicyAccepted: boolean;
        termsVersion: string;
        refundPolicyVersion: string;
    }) => {
        setUndertakingData(acceptanceData);
        setLoading(true);

        const fullName = `${formData.firstName.trim()} ${formData.lastName.trim()}`;
        const trimmedIdCard = formData.idCardNumber.trim();
        const collegeName = formData.college === "Other" ? formData.otherCollege : formData.college;

        try {
            // 1. Upload Passport Photo & Bonafide / DCI files
            let photoUrl = null;
            let idProofUrl = null;
            let dciCertUrl = null;

            if (passportPhotoFile) {
                photoUrl = await uploadPassportPhoto(formData.mobile, passportPhotoFile);
            }
            if (bonafideFile) {
                idProofUrl = await uploadBonafide(`${formData.mobile}_bonafide`, bonafideFile);
            }
            if (dciCertFile) {
                dciCertUrl = await uploadBonafide(`${formData.mobile}_dci`, dciCertFile);
            }

            const tempPassword = formData.mobile;
            const hashedPassword = await bcrypt.hash(tempPassword, 10);

            // Check if user record already exists or insert pending student
            let studentId = createdStudentId;
            if (!studentId) {
                const payload: any = {
                    participantName: fullName,
                    email: formData.email.trim(),
                    mobile: formData.mobile.trim(),
                    idCardNumber: trimmedIdCard,
                    gender: formData.gender,
                    passportPhotoUrl: photoUrl,
                    college: collegeName || (delegateType === 'Clinician' ? 'Private Practice' : ''),
                    year: formData.year || 'N/A',
                    program: currentProgram,
                    paymentStatus: "PENDING",
                    approvalStatus: "PENDING", // Requires Staff Coordinator approval
                    idProofUrl: idProofUrl,
                    password: hashedPassword,
                    mustChangePassword: true,

                    // Declaration & Undertaking fields
                    declarationAccepted: acceptanceData.declarationAccepted,
                    termsAccepted: acceptanceData.termsAccepted,
                    refundPolicyAccepted: acceptanceData.refundPolicyAccepted,
                    termsVersion: acceptanceData.termsVersion,
                    refundPolicyVersion: acceptanceData.refundPolicyVersion,
                    acceptedAt: new Date().toISOString(),

                    // ICON Fields
                    delegateType: delegateType,
                    dciNumber: formData.dciNumber || null,
                    state: formData.state || null,
                    speciality: formData.speciality || null,
                    qualification: formData.qualification || null,
                    yearsOfPractice: formData.yearsOfPractice ? parseInt(formData.yearsOfPractice, 10) : null,
                    academicPosition: formData.academicPosition || null,
                    teachingExperience: formData.teachingExperience || null,
                    dciCertificateUrl: dciCertUrl || null,
                };

                const { data: insertedStudent, error } = await supabase
                    .from("event_students")
                    .insert(payload)
                    .select("id")
                    .single();

                if (error) {
                    if (error.code === '23505') {
                        throw new Error("An account with this email, mobile number, or ID Card Number already exists.");
                    }
                    throw error;
                }
                studentId = insertedStudent.id;
                setCreatedStudentId(studentId);

                // Record Audit Log for Undertaking
                if (studentId) {
                    await recordUndertakingAcceptance({
                        eventStudentId: studentId,
                        idCardNumber: trimmedIdCard,
                        declarationAccepted: acceptanceData.declarationAccepted,
                        termsAccepted: acceptanceData.termsAccepted,
                        refundPolicyAccepted: acceptanceData.refundPolicyAccepted,
                        termsVersion: acceptanceData.termsVersion,
                        refundPolicyVersion: acceptanceData.refundPolicyVersion,
                    });
                }
            }

            // Trigger DCI OCR verification in background if DCI certificate uploaded
            if (isIcon && dciCertUrl && studentId) {
                verifyDciCertificate(studentId).catch(err => console.error("Failed DCI OCR verification:", err));
            }

            // 2. Open Razorpay Gateway
            const razorpayKey = import.meta.env.VITE_RAZORPAY_LIVE_KEY;
            if (!razorpayKey) {
                toast.error("Payment configuration error. Please contact MIDAS administrator.");
                setLoading(false);
                return;
            }

            const options = {
                key: razorpayKey,
                amount: 100, // ₹1 in paise
                currency: "INR",
                name: isIcon ? "Madras ICON" : "MIDAS Scientific Event",
                description: `${isIcon ? 'Professional' : 'UG'} Registration Fee — Conference Kit, Lunch, Certificate`,
                handler: async function (response: any) {
                    const paymentId = response.razorpay_payment_id;
                    setPaymentReference(paymentId);
                    await handlePaymentSuccess(studentId!, paymentId, fullName, collegeName || 'Dental College');
                },
                prefill: {
                    name: fullName,
                    email: formData.email,
                    contact: formData.mobile,
                },
                theme: { color: themeColor },
                modal: {
                    ondismiss: function () {
                        setLoading(false);
                        setCurrentStep('cancelled');
                        toast.info("Payment cancelled.");
                    },
                },
            };

            setCurrentStep('payment');
            const rzp = new window.Razorpay(options);
            rzp.on("payment.failed", function (response: any) {
                setLoading(false);
                const desc = response.error?.description || "Payment process could not be completed.";
                setPaymentErrorMsg(desc);
                setCurrentStep('failed');
                toast.error("Payment failed: " + desc);
            });
            rzp.open();

        } catch (err: any) {
            console.error("Registration/Payment Error:", err);
            const errorMsg = err.message || "An unexpected error occurred.";
            toast.error("Registration failed: " + errorMsg);
            setLoading(false);
        }
    };

    // Process Verified Payment Success
    const handlePaymentSuccess = async (
        studentId: string,
        paymentId: string,
        participantName: string,
        collegeName: string
    ) => {
        setLoading(true);
        try {
            // 1. Generate MIDAS/ICON ID and QR Code immediately
            const latestId = await getLatestMidasId(currentProgram);
            const midasId = generateMidasId(latestId || 0, currentProgram);
            const qrCodeUrl = generateQRCodeUrl(midasId, participantName, collegeName, 300, currentProgram);

            setAssignedMidasId(midasId);
            setAssignedQrCodeUrl(qrCodeUrl);

            // 2. Update Student Record in Supabase
            const { error: studentUpdateErr } = await supabase
                .from("event_students")
                .update({
                    paymentStatus: "PAID",
                    approvalStatus: "PENDING", // Awaiting staff coordinator verification
                    paymentId: paymentId,
                    midasId: midasId,
                    qrCodeData: qrCodeUrl,
                    qrCodeUrl: qrCodeUrl,
                })
                .eq("id", studentId);

            if (studentUpdateErr) throw studentUpdateErr;

            // 3. Insert into payments table
            await supabase.from("payments").insert({
                eventStudentId: studentId,
                amount: 1,
                currency: "INR",
                status: "PAID",
                paymentGatewayId: paymentId,
                transactionId: paymentId,
                program: currentProgram,
            });

            // 4. Record Audit Log for Undertaking
            await recordUndertakingAcceptance({
                eventStudentId: studentId,
                idCardNumber: formData.idCardNumber.trim(),
                declarationAccepted: true,
                termsAccepted: true,
                refundPolicyAccepted: true,
                termsVersion: "1.0",
                refundPolicyVersion: "1.0",
                paymentReference: paymentId,
            });

            // 5. Send Payment Confirmation Email immediately
            tr                await sendPaymentSuccessEmail({
                    student_name: participantName,
                    student_email: formData.email,
                    midas_id: midasId,
                    id_card_number: formData.idCardNumber.trim(),
                    payment_reference: paymentId,
                    amount_paid: "₹1.00",
                    payment_date: new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }),
                    college_name: collegeName,
                    event_type: isIcon ? "Professional Delegate" : "UG Delegate",
                    qr_code_url: qrCodeUrl,
                });
            } catch (emailErr) {
                console.error("Failed to send payment success email:", emailErr);
                // Payment remains valid
            }

            // Also send Account Login Credentials email
            try {
                await sendAccountCreationEmail({
                    user_name: participantName,
                    user_email: formData.email,
                    temp_password: formData.mobile,
                    login_url: window.location.origin + "/member-login"
                });
            } catch (emailErr) {
                console.error("Failed sending login credentials email:", emailErr);
            }

            setLoading(false);
            setCurrentStep('success');
            toast.success(`Payment Successful! Your ${isIcon ? 'ICON' : 'MIDAS'} ID is ${midasId}`);

        } catch (err: any) {
            console.error("Post-payment update failed:", err);
            toast.error("Payment was received but database record update failed. Please contact support with Txn ID: " + paymentId);
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col lg:flex-row font-sans bg-slate-50">
            {/* LEFT PANEL */}
            <div className={`w-full lg:w-1/2 bg-gradient-to-br ${themeGradient} flex items-center justify-center p-8 lg:p-12 text-white relative overflow-hidden`}>
                <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-white/5" />
                <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-white/5" />

                <motion.div
                    className="max-w-md space-y-6 relative z-10"
                    initial={{ opacity: 0, x: -50 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.8 }}
                >
                    <div className="flex items-center gap-4">
                        {isIcon ? (
                            <div className="bg-white/10 p-1.5 rounded-2xl backdrop-blur-sm border border-white/20 w-16 h-16 flex items-center justify-center">
                                <img src="/icon_logo.png" alt="Madras ICON Logo" className="w-full h-full object-contain" />
                            </div>
                        ) : (
                            <div className="bg-white/10 p-3 rounded-2xl backdrop-blur-sm border border-white/20">
                                <Stethoscope className="w-10 h-10 text-white" />
                            </div>
                        )}
                        <h1 className="text-5xl font-bold tracking-tight">{isIcon ? "Madras ICON" : "MIDAS"}</h1>
                    </div>

                    <div className="space-y-4">
                        <h2 className="text-3xl font-semibold leading-tight">
                            Registration For {isIcon ? (delegateType === 'PG' ? 'Postgraduate' : 'Clinician/Academician') : 'UG'} Delegate
                        </h2>
                        <p className="text-white/80 text-lg leading-relaxed font-light">
                            {isIcon
                                ? "Register now to attend the offline scientific sessions."
                                : "Register for the inter-college dental scientific symposium. Complete form, sign undertaking, and pay fee to secure your spot."}
                        </p>
                    </div>

                    {/* Progress Indicator */}
                    <div className="space-y-3 pt-4 border-t border-white/10">
                        <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 font-bold text-sm ${currentStep === 'form' ? 'bg-white text-slate-900 shadow-md' : 'bg-white/20 text-white'}`}>
                                1
                            </div>
                            <span className={`text-sm ${currentStep === 'form' ? 'font-bold text-white' : 'text-white/70'}`}>
                                Fill Registration Details & Upload Photo
                            </span>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 font-bold text-sm ${currentStep === 'declaration' ? 'bg-white text-slate-900 shadow-md' : 'bg-white/20 text-white'}`}>
                                2
                            </div>
                            <span className={`text-sm ${currentStep === 'declaration' ? 'font-bold text-white' : 'text-white/70'}`}>
                                Review Summary & Sign Declaration
                            </span>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 font-bold text-sm ${currentStep === 'payment' ? 'bg-white text-slate-900 shadow-md' : 'bg-white/20 text-white'}`}>
                                3
                            </div>
                            <span className={`text-sm ${currentStep === 'payment' ? 'font-bold text-white' : 'text-white/70'}`}>
                                Complete Razorpay Payment
                            </span>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 font-bold text-sm ${currentStep === 'success' ? 'bg-emerald-400 text-slate-900 shadow-md' : 'bg-white/20 text-white'}`}>
                                4
                            </div>
                            <span className={`text-sm ${currentStep === 'success' ? 'font-bold text-emerald-300' : 'text-white/70'}`}>
                                Instant ID Generation & Confirmation
                            </span>
                        </div>
                    </div>

                    <div className="pt-6 flex items-center gap-3 text-white/60">
                        <GraduationCap className="w-5 h-5" />
                        <span className="text-sm font-medium uppercase tracking-wider">{isIcon ? "Professional Networking" : "Student Symposium"}</span>
                    </div>
                </motion.div>
            </div>

            {/* RIGHT PANEL */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-4 lg:p-8 overflow-y-auto">
                <div className="w-full max-w-2xl">
                    <button
                        onClick={() => navigate("/")}
                        className="flex items-center gap-2 text-slate-400 hover:text-slate-700 transition-colors text-sm mb-4"
                    >
                        <ArrowLeft className="w-4 h-4" /> Back to home
                    </button>

                    {/* STEP 1: FORM */}
                    {currentStep === 'form' && (
                        <motion.div
                            className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100 space-y-6"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                        >
                            <div className="mb-2">
                                <h3 className="text-2xl font-bold text-slate-900 uppercase">
                                    {isIcon ? "ICON REGISTRATION" : "UG DELEGATE REGISTRATION"}
                                </h3>
                                <p className="text-xs text-slate-500 mt-1">
                                    Step 1 of 4 — Enter all required personal and academic information.
                                </p>

                                {isIcon && (
                                    <RadioGroup
                                        value={delegateType}
                                        onValueChange={(v) => setDelegateType(v as any)}
                                        className="flex gap-4 mt-4"
                                    >
                                        <div className="flex items-center space-x-2">
                                            <RadioGroupItem value="PG" id="pg" />
                                            <Label htmlFor="pg">Postgraduate</Label>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <RadioGroupItem value="Clinician" id="clinician" />
                                            <Label htmlFor="clinician">Clinician</Label>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <RadioGroupItem value="Academician" id="academician" />
                                            <Label htmlFor="academician">Academician</Label>
                                        </div>
                                    </RadioGroup>
                                )}
                            </div>

                            <form onSubmit={(e) => { e.preventDefault(); handleProceedToDeclaration(); }} className="space-y-5">
                                {/* Name fields */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="firstName">First Name *</Label>
                                        <Input id="firstName" value={formData.firstName} onChange={handleInputChange} required className="h-12 rounded-xl" placeholder="John" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="lastName">Last Name *</Label>
                                        <Input id="lastName" value={formData.lastName} onChange={handleInputChange} required className="h-12 rounded-xl" placeholder="Doe" />
                                    </div>
                                </div>

                                {/* ID Card Number & Gender */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="idCardNumber">ID Card Number *</Label>
                                        <Input
                                            id="idCardNumber"
                                            value={formData.idCardNumber}
                                            onChange={handleInputChange}
                                            required
                                            className="h-12 rounded-xl font-mono uppercase"
                                            placeholder="e.g. DENT-2026-8891"
                                        />
                                        <p className="text-[11px] text-slate-400">Unique Government / College ID Card Number</p>
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Gender *</Label>
                                        <Select value={formData.gender} onValueChange={(v) => handleSelectChange("gender", v)}>
                                            <SelectTrigger className="h-12 rounded-xl">
                                                <SelectValue placeholder="Select Gender" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Male">Male</SelectItem>
                                                <SelectItem value="Female">Female</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                {/* Email & Mobile */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="email">Email *</Label>
                                        <Input id="email" type="email" value={formData.email} onChange={handleInputChange} required className="h-12 rounded-xl" placeholder="student@example.com" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="mobile">Mobile (10 Digits) *</Label>
                                        <Input id="mobile" maxLength={10} value={formData.mobile} onChange={handleInputChange} required className="h-12 rounded-xl" placeholder="9876543210" />
                                    </div>
                                </div>

                                {/* College & Year */}
                                {isIcon ? (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="dciNumber">DCI Number *</Label>
                                            <Input id="dciNumber" value={formData.dciNumber} onChange={handleInputChange} required className="h-12 rounded-xl" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>State *</Label>
                                            <Select value={formData.state} onValueChange={(v) => handleSelectChange("state", v)}>
                                                <SelectTrigger className="h-12 rounded-xl"><SelectValue placeholder="Select State" /></SelectTrigger>
                                                <SelectContent className="max-h-60">
                                                    {indianStates.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>Year of Study *</Label>
                                            <Select value={formData.year} onValueChange={(v) => handleSelectChange("year", v)}>
                                                <SelectTrigger className="h-12 rounded-xl"><SelectValue placeholder="Select Year" /></SelectTrigger>
                                                <SelectContent>
                                                    {midasYears.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>College *</Label>
                                            <Select value={formData.college} onValueChange={(v) => handleSelectChange("college", v)}>
                                                <SelectTrigger className="h-12 rounded-xl"><SelectValue placeholder="Select College" /></SelectTrigger>
                                                <SelectContent className="max-h-60 overflow-y-auto">
                                                    {collegesList.map(opt => (
                                                        <SelectItem key={opt.value} value={opt.label}>
                                                            {opt.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                )}

                                {/* ICON Additional Details */}
                                {isIcon && delegateType === 'PG' && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>Speciality *</Label>
                                            <Select value={formData.speciality} onValueChange={(v) => handleSelectChange("speciality", v)}>
                                                <SelectTrigger className="h-12 rounded-xl"><SelectValue placeholder="Select Speciality" /></SelectTrigger>
                                                <SelectContent className="max-h-60">
                                                    {iconSpecialities.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Year of Study *</Label>
                                            <Select value={formData.year} onValueChange={(v) => handleSelectChange("year", v)}>
                                                <SelectTrigger className="h-12 rounded-xl"><SelectValue placeholder="MDS Year" /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="1st Year MDS">1st Year MDS</SelectItem>
                                                    <SelectItem value="2nd Year MDS">2nd Year MDS</SelectItem>
                                                    <SelectItem value="3rd Year MDS">3rd Year MDS</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                )}

                                {/* Passport Size Photo Upload & Preview */}
                                <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                                    <Label className="font-bold text-slate-800 flex items-center gap-2">
                                        <ImageIcon className="w-4 h-4 text-emerald-700" /> Passport Size Photo *
                                    </Label>
                                    <p className="text-xs text-slate-500">
                                        Upload a recent, clear, front-facing passport-size photo (JPG, JPEG, or PNG, Max 5MB).
                                    </p>

                                    {passportPhotoPreviewUrl ? (
                                        <div className="flex items-center gap-4 pt-1">
                                            <div className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-emerald-500 bg-white shadow-md shrink-0">
                                                <img src={passportPhotoPreviewUrl} alt="Passport Preview" className="w-full h-full object-cover" />
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-xs font-bold text-emerald-700">✓ Photo Selected</p>
                                                <p className="text-xs text-slate-500">{passportPhotoFile?.name}</p>
                                                <Label htmlFor="passportPhoto" className="cursor-pointer text-xs font-semibold text-blue-600 hover:underline inline-block">
                                                    Replace Photo
                                                </Label>
                                            </div>
                                        </div>
                                    ) : null}

                                    <Input
                                        id="passportPhoto"
                                        type="file"
                                        accept="image/jpeg,image/jpg,image/png"
                                        onChange={handlePassportPhotoChange}
                                        required={!passportPhotoFile}
                                        className={`h-12 rounded-xl bg-white ${passportPhotoPreviewUrl ? "hidden" : "block"}`}
                                    />
                                </div>

                                {/* Bonafide / ID Proof Upload */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {(!isIcon || delegateType !== 'Clinician') && (
                                        <div className="space-y-2">
                                            <Label>{isIcon ? "Bonafide Upload *" : "ID Proof / Bonafide *"}</Label>
                                            <Input
                                                type="file"
                                                onChange={(e) => setBonafideFile(e.target.files?.[0] || null)}
                                                required
                                                className="h-12 rounded-xl"
                                            />
                                        </div>
                                    )}
                                    {isIcon && (
                                        <div className="space-y-2">
                                            <Label>DCI Certificate *</Label>
                                            <Input
                                                type="file"
                                                onChange={(e) => setDciCertFile(e.target.files?.[0] || null)}
                                                required
                                                className="h-12 rounded-xl"
                                            />
                                        </div>
                                    )}
                                </div>

                                <Button
                                    type="submit"
                                    className="w-full h-14 text-white rounded-xl shadow-lg transition-all active:scale-[0.98] text-base font-bold"
                                    style={{ backgroundColor: themeColor }}
                                    disabled={loading}
                                >
                                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Continue to Declaration →"}
                                </Button>
                            </form>
                        </motion.div>
                    )}

                    {/* STEP 2: DECLARATION & UNDERTAKING */}
                    {currentStep === 'declaration' && (
                        <DeclarationUndertakingStep
                            formData={formData}
                            passportPhotoPreviewUrl={passportPhotoPreviewUrl}
                            bonafideFileName={bonafideFile?.name}
                            dciCertFileName={dciCertFile?.name}
                            isIcon={isIcon}
                            themeColor={themeColor}
                            onEditRegistration={() => setCurrentStep('form')}
                            onProceedToPayment={handleInitiatePayment}
                            isProcessing={loading}
                        />
                    )}

                    {/* STEP 3: PAYMENT PROCESSING */}
                    {currentStep === 'payment' && (
                        <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100 text-center space-y-6">
                            <Loader2 className="w-16 h-16 animate-spin text-[#004d40] mx-auto" />
                            <h3 className="text-2xl font-bold text-slate-900">Opening Payment Gateway...</h3>
                            <p className="text-slate-500 text-sm max-w-md mx-auto">
                                Please complete your registration fee payment of ₹1.00 in the Razorpay popup. Do not refresh or close this window.
                            </p>
                        </div>
                    )}            )}

                    {/* CANCELLED STATE */}
                    {currentStep === 'cancelled' && (
                        <Card className="rounded-3xl border-amber-200 bg-amber-50/40 p-6 text-center space-y-5">
                            <AlertTriangle className="w-16 h-16 text-amber-600 mx-auto" />
                            <h3 className="text-2xl font-bold text-amber-900">Payment Cancelled</h3>
                            <p className="text-slate-600 text-sm max-w-md mx-auto">
                                Your payment was cancelled. Your registration has not been marked as successfully paid.
                            </p>
                            <div className="flex flex-col sm:flex-row justify-center gap-3 pt-2">
                                <Button
                                    onClick={() => handleInitiatePayment(undertakingData || {
                                        declarationAccepted: true,
                                        termsAccepted: true,
                                        refundPolicyAccepted: true,
                                        termsVersion: "1.0",
                                        refundPolicyVersion: "1.0",
                                    })}
                                    className="h-12 rounded-xl font-bold text-white px-8"
                                    style={{ backgroundColor: themeColor }}
                                >
                                    <CreditCard className="w-4 h-4 mr-2" /> Return to Payment
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={() => setCurrentStep('form')}
                                    className="h-12 rounded-xl font-bold border-slate-300"
                                >
                                    Edit Registration Form
                                </Button>
                            </div>
                        </Card>
                    )}

                    {/* FAILED STATE */}
                    {currentStep === 'failed' && (
                        <Card className="rounded-3xl border-red-200 bg-red-50/40 p-6 text-center space-y-5">
                            <XCircle className="w-16 h-16 text-red-600 mx-auto" />
                            <h3 className="text-2xl font-bold text-red-900">Payment Failed</h3>
                            <p className="text-slate-600 text-sm max-w-md mx-auto">
                                {paymentErrorMsg || "Your payment could not be completed. No successful registration payment has been recorded. Please try again."}
                            </p>
                            <div className="flex flex-col sm:flex-row justify-center gap-3 pt-2">
                                <Button
                                    onClick={() => handleInitiatePayment(undertakingData || {
                                        declarationAccepted: true,
                                        termsAccepted: true,
                                        refundPolicyAccepted: true,
                                        termsVersion: "1.0",
                                        refundPolicyVersion: "1.0",
                                    })}
                                    className="h-12 rounded-xl font-bold text-white px-8 bg-red-700 hover:bg-red-800"
                                >
                                    <RefreshCw className="w-4 h-4 mr-2" /> Retry Payment
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={() => setCurrentStep('form')}
                                    className="h-12 rounded-xl font-bold border-slate-300"
                                >
                                    Edit Registration Details
                                </Button>
                            </div>
                        </Card>
                    )}

                    {/* STEP 4: SUCCESS CONFIRMATION PAGE */}
                    {currentStep === 'success' && (
                        <motion.div
                            className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100 text-center space-y-6"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                        >
                            <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto text-emerald-600 shadow-inner">
                                <CheckCircle2 className="w-12 h-12" />
                            </div>

                            <div>
                                <h2 className="text-3xl font-black text-slate-900">Registration Successful!</h2>
                                <p className="text-slate-500 mt-1 font-medium text-sm">
                                    Your {isIcon ? "Madras ICON" : "MIDAS"} registration and fee payment have been successfully completed.
                                </p>
                            </div>

                            {/* MIDAS ID Banner */}
                            {assignedMidasId && (
                                <div className="bg-slate-900 text-white p-6 rounded-2xl space-y-3 shadow-md">
                                    <p className="text-xs uppercase tracking-widest text-slate-400 font-bold">
                                        Your Assigned {isIcon ? "ICON ID" : "MIDAS ID"}
                                    </p>
                                    <p className="text-3xl font-mono font-black text-emerald-400 tracking-wider">
                                        {assignedMidasId}
                                    </p>
                                    {assignedQrCodeUrl && (
                                        <div className="pt-2 flex justify-center">
                                            <div className="bg-white p-2 rounded-xl shadow-md">
                                                <img src={assignedQrCodeUrl} alt="MIDAS QR Code" className="w-32 h-32 rounded-lg" />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Details Table */}
                            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs text-left space-y-2">
                                <div className="flex justify-between border-b border-slate-200 pb-2">
                                    <span className="text-slate-400 font-semibold">Student Name:</span>
                                    <span className="font-bold text-slate-900">{formData.firstName} {formData.lastName}</span>
                                </div>
                                <div className="flex justify-between border-b border-slate-200 pb-2">
                                    <span className="text-slate-400 font-semibold">ID Card Number:</span>
                                    <span className="font-mono font-bold text-slate-900">{formData.idCardNumber}</span>
                                </div>
                                <div className="flex justify-between border-b border-slate-200 pb-2">
                                    <span className="text-slate-400 font-semibold">Gender:</span>
                                    <span className="font-semibold text-slate-900">{formData.gender}</span>
                                </div>
                                <div className="flex justify-between border-b border-slate-200 pb-2">
                                    <span className="text-slate-400 font-semibold">Payment Status:</span>
                                    <span className="font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">Successful (PAID)</span>
                                </div>
                                <div className="flex justify-between border-b border-slate-200 pb-2">
                                    <span className="text-slate-400 font-semibold">Payment Reference:</span>
                                    <span className="font-mono text-slate-700">{paymentReference || "N/A"}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-400 font-semibold">Registration Date:</span>
                                    <span className="font-medium text-slate-800">{new Date().toLocaleDateString("en-IN")}</span>
                                </div>
                            </div>

                            <div className="bg-blue-50 border border-blue-200 p-4 rounded-2xl text-left space-y-1 text-xs text-blue-900">
                                <p className="font-bold">Confirmation email sent to: <span className="underline">{formData.email}</span></p>
                                <p className="text-slate-600">
                                    Your registration fee payment is non-refundable in accordance with the MIDAS Refund Policy. Your profile is now awaiting Staff Coordinator verification.
                                </p>
                            </div>

                            <Button
                                onClick={() => navigate("/member-login")}
                                className="w-full h-14 rounded-xl font-bold text-white shadow-lg text-base"
                                style={{ backgroundColor: themeColor }}
                            >
                                Go to Login Portal
                            </Button>
                        </motion.div>
                    )}
                </div>
            </div>
        </div>
    );
}
