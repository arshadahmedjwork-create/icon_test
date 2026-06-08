import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Stethoscope, GraduationCap, Loader2, CheckCircle2, ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { supabase } from "@/lib/supabaseClient";
import { uploadBonafide, getCollegesList } from "@/services/supabaseService";
import { useProgram } from "@/contexts/ProgramContext";
import bcrypt from 'bcryptjs';
import { sendAccountCreationEmail } from "@/services/emailService";
import { verifyDciCertificate } from "@/services/dciService";

const colleges = [
    "KLE VK Institute of Dental Sciences, Belagavi",
    "SDM College of Dental Sciences, Dharwad",
    "Government Dental College, Bangalore",
    "Bapuji Dental College, Davangere",
    "Manipal College of Dental Sciences",
    "Other"
];

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
    "Andhra Pradesh",
    "Arunachal Pradesh",
    "Assam",
    "Bihar",
    "Chhattisgarh",
    "Goa",
    "Gujarat",
    "Haryana",
    "Himachal Pradesh",
    "Jharkhand",
    "Karnataka",
    "Kerala",
    "Madhya Pradesh",
    "Maharashtra",
    "Manipur",
    "Meghalaya",
    "Mizoram",
    "Nagaland",
    "Odisha",
    "Punjab",
    "Rajasthan",
    "Sikkim",
    "Tamil Nadu",
    "Telangana",
    "Tripura",
    "Uttar Pradesh",
    "Uttarakhand",
    "West Bengal",
    "Andaman and Nicobar Islands",
    "Chandigarh",
    "Dadra and Nagar Haveli and Daman and Diu",
    "Delhi",
    "Jammu and Kashmir",
    "Ladakh",
    "Lakshadweep",
    "Puducherry"
];

export default function StudentRegistrationPage() {
    const navigate = useNavigate();
    const { currentProgram } = useProgram();
    const [loading, setLoading] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [collegesList, setCollegesList] = useState<{ value: string, label: string }[]>([]);

    useEffect(() => {
        const fetchColleges = async () => {
            const list = await getCollegesList();
            setCollegesList(list);
        };
        fetchColleges();
    }, []);

    const [delegateType, setDelegateType] = useState<'PG' | 'Clinician' | 'Academician' | 'UG'>(currentProgram === 'ICON' ? 'PG' : 'UG');

    const [formData, setFormData] = useState({
        firstName: "",
        lastName: "",
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

    const [bonafideFile, setBonafideFile] = useState<File | null>(null);
    const [dciCertFile, setDciCertFile] = useState<File | null>(null);

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

    const isIcon = currentProgram === 'ICON';
    const themeColor = isIcon ? "#b91c1c" : "#004d40"; // Red-700 vs Green-900
    const themeGradient = isIcon
        ? "from-[#7f1d1d] to-[#b91c1c]"
        : "from-[#004d40] to-[#2e7d32]";

    const handleSubmitRegistration = async () => {
        if (!formData.firstName.trim()) { toast.error("Please enter your first name"); return; }
        if (!formData.lastName.trim()) { toast.error("Please enter your last name"); return; }
        if (!formData.email.trim()) { toast.error("Please enter your email"); return; }
        if (!formData.mobile.trim() || formData.mobile.length !== 10) { toast.error("Please enter valid 10-digit mobile number"); return; }

        const fullName = `${formData.firstName.trim()} ${formData.lastName.trim()}`;

        if (isIcon) {
            if ((delegateType === 'Clinician' || delegateType === 'Academician' || delegateType === 'PG') && !formData.dciNumber) {
                toast.error("DCI Number is required"); return;
            }
            if ((delegateType === 'Clinician' || delegateType === 'Academician') && !formData.qualification) {
                toast.error("Qualification is required"); return;
            }
            if ((delegateType === 'PG' || formData.qualification === 'MDS') && !formData.speciality) {
                toast.error("Speciality is required"); return;
            }
            if (delegateType === 'PG' && !formData.year) { toast.error("Year of study is required"); return; }

            // Clinicians do not need a Bonafide upload
            if (delegateType !== 'Clinician' && !bonafideFile) { toast.error("Please upload bonafide certificate"); return; }
            if (!dciCertFile) { toast.error("Please upload DCI certificate"); return; }
        } else {
            if (!formData.college) { toast.error("Please select your college"); return; }
            if (!formData.year) { toast.error("Please select your year"); return; }
            if (!bonafideFile) { toast.error("Please upload ID proof"); return; }
        }

        setLoading(true);

        try {
            const collegeName = formData.college === "Other" ? formData.otherCollege : formData.college;

            // 1. Upload Files
            let idProofUrl = undefined;
            let dciCertUrl = undefined;

            if (bonafideFile) {
                idProofUrl = await uploadBonafide(`${formData.mobile}_bonafide`, bonafideFile);
            }
            if (dciCertFile) {
                dciCertUrl = await uploadBonafide(`${formData.mobile}_dci`, dciCertFile);
            }

            // 2. Prepare Payload
            const tempPassword = formData.mobile;
            const hashedPassword = await bcrypt.hash(tempPassword, 10);

            const payload: any = {
                participantName: fullName,
                email: formData.email,
                mobile: formData.mobile,
                college: collegeName || (delegateType === 'Clinician' ? 'Private Practice' : ''),
                year: formData.year || 'N/A',
                program: currentProgram,
                paymentStatus: "PENDING",
                approvalStatus: isIcon ? "APPROVED" : "PENDING", // ICON doesn't require approval
                idProofUrl: idProofUrl,
                password: hashedPassword,
                mustChangePassword: true,

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
                    throw new Error("An account with this email or mobile number already exists.");
                }
                throw error;
            }

            // Trigger DCI OCR verification in background if DCI certificate uploaded
            if (isIcon && dciCertUrl && insertedStudent?.id) {
                verifyDciCertificate(insertedStudent.id).catch(err => {
                    console.error("Failed to run DCI OCR verification:", err);
                });
            }

            // 3. Send Credentials Email
            try {
                await sendAccountCreationEmail({
                    user_name: fullName,
                    user_email: formData.email,
                    temp_password: tempPassword,
                    login_url: window.location.origin + "/member-login"
                });
            } catch (emailErr) {
                console.error("Failed to send welcome email:", emailErr);
                // Don't fail the whole registration if email fails
            }

            setLoading(false);
            setShowSuccess(true);

        } catch (err: any) {
            console.error("Registration Error:", err);
            const errorMsg = err.message || (typeof err === 'object' ? JSON.stringify(err) : "Unknown error");
            toast.error("Registration failed: " + errorMsg);
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col lg:flex-row font-sans">
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
                                : "Register for the inter-college dental scientific symposium. Complete the form and pay the registration fee to secure your spot."}
                        </p>
                    </div>

                    <div className="space-y-3 pt-4">
                        <div className="flex items-center gap-3 text-white/70">
                            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                                <span className="text-sm font-bold text-white">1</span>
                            </div>
                            <span className="text-sm">Fill in your professional details</span>
                        </div>
                        {!isIcon && (
                            <div className="flex items-center gap-3 text-white/70">
                                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                                    <span className="text-sm font-bold text-white">2</span>
                                </div>
                                <span className="text-sm">Wait for Staff Coordinator approval</span>
                            </div>
                        )}
                        <div className="flex items-center gap-3 text-white/70">
                            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                                <span className="text-sm font-bold text-white">{isIcon ? "2" : "3"}</span>
                            </div>
                            <span className="text-sm">Complete payment to generate {isIcon ? "ICON ID" : "MIDAS ID"}</span>
                        </div>
                    </div>

                    <div className="pt-8 border-t border-white/10 flex items-center gap-3 text-white/60">
                        <GraduationCap className="w-5 h-5" />
                        <span className="text-sm font-medium uppercase tracking-wider">{isIcon ? "Professional Networking" : "Student Symposium"}</span>
                    </div>
                </motion.div>
            </div>

            {/* RIGHT PANEL */}
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
                        <h3 className="text-2xl font-bold text-slate-900 uppercase">
                            {isIcon ? "ICON REGISTRATION" : "UG DELEGATE REGISTRATION"}
                        </h3>
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

                    <form
                        onSubmit={(e) => { e.preventDefault(); handleSubmitRegistration(); }}
                        className="space-y-5"
                    >
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="firstName">First Name *</Label>
                                <Input id="firstName" value={formData.firstName} onChange={handleInputChange} required className="h-12 rounded-xl" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="lastName">Last Name *</Label>
                                <Input id="lastName" value={formData.lastName} onChange={handleInputChange} required className="h-12 rounded-xl" />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="email">Email *</Label>
                                <Input id="email" type="email" value={formData.email} onChange={handleInputChange} required className="h-12 rounded-xl" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="mobile">Mobile *</Label>
                                <Input id="mobile" maxLength={10} value={formData.mobile} onChange={handleInputChange} required className="h-12 rounded-xl" />
                            </div>
                        </div>

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
                                        <SelectContent>
                                            {indianStates.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Year *</Label>
                                    <Select value={formData.year} onValueChange={(v) => handleSelectChange("year", v)}>
                                        <SelectTrigger className="h-12 rounded-xl"><SelectValue placeholder="Year" /></SelectTrigger>
                                        <SelectContent>
                                            {midasYears.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>College *</Label>
                                    <Select value={formData.college} onValueChange={(v) => handleSelectChange("college", v)}>
                                        <SelectTrigger className="h-12 rounded-xl"><SelectValue placeholder="Select College" /></SelectTrigger>
                                        <SelectContent>
                                            {colleges.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        )}

                        {isIcon && (
                            <>
                                {delegateType === 'PG' ? (
                                    <>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label>Speciality *</Label>
                                                <Select value={formData.speciality} onValueChange={(v) => handleSelectChange("speciality", v)}>
                                                    <SelectTrigger className="h-12 rounded-xl"><SelectValue placeholder="Select Speciality" /></SelectTrigger>
                                                    <SelectContent>
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
                                        <div className="space-y-2">
                                            <Label>College *</Label>
                                            <Select value={formData.college} onValueChange={(v) => handleSelectChange("college", v)}>
                                                <SelectTrigger className="h-12 rounded-xl">
                                                    <SelectValue placeholder="Select College" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {collegesList.map(opt => (
                                                        <SelectItem key={opt.value} value={opt.label}>
                                                            {opt.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label>Qualification *</Label>
                                                <Select value={formData.qualification} onValueChange={(v) => handleSelectChange("qualification", v)}>
                                                    <SelectTrigger className="h-12 rounded-xl"><SelectValue placeholder="Select Qualification" /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="BDS">BDS</SelectItem>
                                                        <SelectItem value="MDS">MDS</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            {formData.qualification === 'MDS' && (
                                                <div className="space-y-2">
                                                    <Label>Speciality *</Label>
                                                    <Select value={formData.speciality} onValueChange={(v) => handleSelectChange("speciality", v)}>
                                                        <SelectTrigger className="h-12 rounded-xl"><SelectValue placeholder="Select Speciality" /></SelectTrigger>
                                                        <SelectContent>
                                                            {iconSpecialities.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            )}
                                        </div>

                                        {delegateType !== 'Clinician' && (
                                            <div className="space-y-2">
                                                <Label>College *</Label>
                                                <Select value={formData.college} onValueChange={(v) => handleSelectChange("college", v)}>
                                                    <SelectTrigger className="h-12 rounded-xl">
                                                        <SelectValue placeholder="Select College" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {collegesList.map(opt => (
                                                            <SelectItem key={opt.value} value={opt.label}>
                                                                {opt.label}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        )}

                                        {delegateType === 'Clinician' ? (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <Label htmlFor="yearsOfPractice">Years of Practice</Label>
                                                    <Input id="yearsOfPractice" type="number" value={formData.yearsOfPractice} onChange={handleInputChange} className="h-12 rounded-xl" />
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <Label htmlFor="academicPosition">Academic Position *</Label>
                                                    <Input id="academicPosition" value={formData.academicPosition} onChange={handleInputChange} required className="h-12 rounded-xl" />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor="teachingExperience">Teaching Experience (Years) *</Label>
                                                    <Input id="teachingExperience" value={formData.teachingExperience} onChange={handleInputChange} required className="h-12 rounded-xl" />
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                            </>
                        )}

                        {/* File Uploads */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {(!isIcon || delegateType !== 'Clinician') && (
                                <div className="space-y-2">
                                    <Label>{isIcon ? "Bonafide Upload *" : "ID Proof / Bonafide *"}</Label>
                                    <Input type="file" onChange={(e) => setBonafideFile(e.target.files?.[0] || null)} required className="h-12 rounded-xl" />
                                </div>
                            )}
                            {isIcon && (
                                <div className="space-y-2">
                                    <Label>DCI Certificate *</Label>
                                    <Input type="file" onChange={(e) => setDciCertFile(e.target.files?.[0] || null)} required className="h-12 rounded-xl" />
                                </div>
                            )}
                        </div>

                        <Button
                            type="submit"
                            className="w-full h-14 text-white rounded-xl shadow-lg transition-all active:scale-[0.98] text-base font-bold"
                            style={{ backgroundColor: themeColor }}
                            disabled={loading}
                        >
                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Register Now"}
                        </Button>
                    </form>
                </motion.div>
            </div>

            <Dialog open={showSuccess} onOpenChange={setShowSuccess}>
                <DialogContent className="rounded-3xl">
                    <div className="flex flex-col items-center p-6 text-center">
                        <CheckCircle2 className="w-16 h-16 text-green-500 mb-4" />
                        <h2 className="text-2xl font-bold">Registration Successful!</h2>
                        <p className="text-slate-500 mt-2 text-lg font-medium">
                            {isIcon
                                ? "Your registration is confirmed. Please login to complete payment and generate your ICON ID."
                                : "Your registration is pending staff approval. You will receive an email once approved."}
                        </p>
                        <Button onClick={() => navigate("/member-login")} className="mt-8 w-full h-12 rounded-xl font-bold text-white" style={{ backgroundColor: themeColor }}>
                            Go to Login
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
