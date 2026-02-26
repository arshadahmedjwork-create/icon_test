
import { useState } from "react";
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
    Calendar, CreditCard, Award
} from "lucide-react";

const courses = [
    "BDS", "MDS - Orthodontics", "MDS - Prosthodontics", "MDS - Conservative & Endodontics",
    "MDS - Oral Surgery", "MDS - Periodontics", "MDS - Pedodontics",
    "MDS - Oral Pathology", "MDS - Oral Medicine", "MDS - Community Dentistry",
    "MDS - Public Health Dentistry", "Other"
];

const yearOptions = ["1st Year", "2nd Year", "3rd Year", "4th Year", "Intern"];

export default function StudentOverviewPage() {
    const { user } = useAuth();
    const [profileCompleted, setProfileCompleted] = useState(false);
    const [loading, setLoading] = useState(false);
    const [fileName, setFileName] = useState("");

    const [form, setForm] = useState({
        fullName: user?.name || "",
        dateOfBirth: "",
        email: user?.email || "",
        phone: user?.phone || "",
        college: user?.college || "",
        course: "",
        year: "",
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) { toast.error("File must be under 5MB"); return; }
        if (!["application/pdf", "image/jpeg", "image/png"].includes(file.type)) {
            toast.error("Only PDF, JPG, PNG allowed"); return;
        }
        setFileName(file.name);
        toast.success(`File "${file.name}" selected`);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.fullName || !form.dateOfBirth || !form.phone || !form.college || !form.course || !form.year) {
            toast.error("All fields are mandatory"); return;
        }
        if (!/^\d{10}$/.test(form.phone)) { toast.error("Enter a valid 10-digit phone number"); return; }

        setLoading(true);
        setTimeout(() => {
            setLoading(false);
            setProfileCompleted(true);
            toast.success("Registration submitted successfully!");
        }, 1500);
    };

    // ─── COMPLETED DASHBOARD ────────────────────
    if (profileCompleted) {
        return (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Welcome, {form.fullName || user?.name}! 👋</h1>
                    <p className="text-sm text-slate-500 mt-1">Your event participation overview</p>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                        { label: "Events Enrolled", value: "0", icon: Calendar, color: "bg-blue-500", bg: "bg-blue-50" },
                        { label: "Abstracts Submitted", value: "0", icon: FileText, color: "bg-amber-500", bg: "bg-amber-50" },
                        { label: "Payments Made", value: "0", icon: CreditCard, color: "bg-green-500", bg: "bg-green-50" },
                        { label: "Certificates", value: "0", icon: Award, color: "bg-purple-500", bg: "bg-purple-50" },
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

                {/* Profile Card */}
                <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#004d40] to-[#2e7d32] flex items-center justify-center text-white font-bold text-lg">
                            {form.fullName.charAt(0)}
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-900">{form.fullName}</h3>
                            <p className="text-sm text-slate-500">{form.course} — {form.year}</p>
                        </div>
                        <div className="ml-auto flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-700 rounded-full text-xs font-bold border border-green-200">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Profile Completed
                        </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div><span className="text-slate-400 block text-xs mb-1">Email</span><span className="font-medium">{form.email}</span></div>
                        <div><span className="text-slate-400 block text-xs mb-1">Phone</span><span className="font-medium">{form.phone}</span></div>
                        <div><span className="text-slate-400 block text-xs mb-1">College</span><span className="font-medium">{form.college}</span></div>
                        <div><span className="text-slate-400 block text-xs mb-1">DOB</span><span className="font-medium">{form.dateOfBirth}</span></div>
                    </div>
                </div>

                {/* Quick Actions */}
                <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
                    <h3 className="font-bold text-slate-900 mb-4">Quick Actions</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <Button variant="outline" className="h-12 rounded-xl border-slate-200 justify-start" onClick={() => window.location.href = '/dashboard/student/events'}>
                            <Calendar className="w-4 h-4 mr-2 text-blue-500" /> Browse Events
                        </Button>
                        <Button variant="outline" className="h-12 rounded-xl border-slate-200 justify-start" onClick={() => window.location.href = '/dashboard/student/submissions'}>
                            <FileText className="w-4 h-4 mr-2 text-amber-500" /> My Submissions
                        </Button>
                        <Button variant="outline" className="h-12 rounded-xl border-slate-200 justify-start" onClick={() => window.location.href = '/dashboard/student/certificates'}>
                            <Award className="w-4 h-4 mr-2 text-purple-500" /> View Certificates
                        </Button>
                    </div>
                </div>
            </motion.div>
        );
    }

    // ─── REGISTRATION FORM ──────────────────────
    return (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl mx-auto">
            <div className="mb-8">
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                        <AlertCircle className="w-5 h-5 text-amber-500" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Complete Your Profile</h1>
                        <p className="text-sm text-slate-500">Fill in all details to unlock event enrollment.</p>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 p-6 md:p-8 shadow-sm">
                <form onSubmit={handleSubmit} className="space-y-5">
                    {/* Full Name */}
                    <div className="space-y-2">
                        <Label className="text-slate-700 font-medium flex items-center gap-2">
                            <User className="w-4 h-4 text-slate-400" /> Full Name <span className="text-red-500">*</span>
                        </Label>
                        <Input name="fullName" value={form.fullName} onChange={handleChange} required
                            placeholder="Dr. John Doe" className="h-12 rounded-xl bg-slate-50 border-slate-200" />
                    </div>

                    {/* DOB + Phone */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="text-slate-700 font-medium flex items-center gap-2">
                                <CalendarDays className="w-4 h-4 text-slate-400" /> Date of Birth <span className="text-red-500">*</span>
                            </Label>
                            <Input name="dateOfBirth" type="date" value={form.dateOfBirth} onChange={handleChange} required
                                className="h-12 rounded-xl bg-slate-50 border-slate-200" />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-slate-700 font-medium flex items-center gap-2">
                                <Phone className="w-4 h-4 text-slate-400" /> Phone Number <span className="text-red-500">*</span>
                            </Label>
                            <Input name="phone" type="tel" value={form.phone} onChange={handleChange} required maxLength={10}
                                placeholder="10-digit number" className="h-12 rounded-xl bg-slate-50 border-slate-200" />
                        </div>
                    </div>

                    {/* Email (read only) */}
                    <div className="space-y-2">
                        <Label className="text-slate-700 font-medium flex items-center gap-2">
                            <Mail className="w-4 h-4 text-slate-400" /> Email <span className="text-slate-300 text-xs">(auto-filled)</span>
                        </Label>
                        <Input value={form.email} readOnly
                            className="h-12 rounded-xl bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed" />
                    </div>

                    {/* College */}
                    <div className="space-y-2">
                        <Label className="text-slate-700 font-medium flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-slate-400" /> College / Institution <span className="text-red-500">*</span>
                        </Label>
                        <Input name="college" value={form.college} onChange={handleChange} required
                            placeholder="KLE VK Institute of Dental Sciences" className="h-12 rounded-xl bg-slate-50 border-slate-200" />
                    </div>

                    {/* Course + Year */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="text-slate-700 font-medium flex items-center gap-2">
                                <GraduationCap className="w-4 h-4 text-slate-400" /> Course <span className="text-red-500">*</span>
                            </Label>
                            <Select value={form.course} onValueChange={(v) => setForm({ ...form, course: v })}>
                                <SelectTrigger className="h-12 rounded-xl bg-slate-50 border-slate-200">
                                    <SelectValue placeholder="Select Course" />
                                </SelectTrigger>
                                <SelectContent>
                                    {courses.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-slate-700 font-medium flex items-center gap-2">
                                <GraduationCap className="w-4 h-4 text-slate-400" /> Year <span className="text-red-500">*</span>
                            </Label>
                            <Select value={form.year} onValueChange={(v) => setForm({ ...form, year: v })}>
                                <SelectTrigger className="h-12 rounded-xl bg-slate-50 border-slate-200">
                                    <SelectValue placeholder="Select Year" />
                                </SelectTrigger>
                                <SelectContent>
                                    {yearOptions.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* ID Proof Upload */}
                    <div className="space-y-2">
                        <Label className="text-slate-700 font-medium flex items-center gap-2">
                            <Upload className="w-4 h-4 text-slate-400" /> ID Proof <span className="text-slate-300 text-xs">(PDF/JPG/PNG — Max 5MB)</span>
                        </Label>
                        <label className="flex items-center justify-center gap-3 h-14 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50 cursor-pointer hover:border-[#004d40]/40 hover:bg-[#004d40]/5 transition-colors">
                            <Upload className="w-4 h-4 text-slate-400" />
                            <span className="text-sm text-slate-500">{fileName || "Click to upload ID proof"}</span>
                            <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFileChange} className="hidden" />
                        </label>
                    </div>

                    {/* Submit */}
                    <div className="pt-4">
                        <Button type="submit" disabled={loading}
                            className="w-full h-14 bg-[#004d40] hover:bg-[#003d33] text-white rounded-xl text-base font-bold shadow-lg shadow-[#004d40]/20">
                            {loading ? (
                                <span className="flex items-center gap-2"><Loader2 className="w-5 h-5 animate-spin" /> Submitting...</span>
                            ) : (
                                <span className="flex items-center gap-2"><CheckCircle2 className="w-5 h-5" /> Submit Registration</span>
                            )}
                        </Button>
                    </div>
                </form>
            </div>
        </motion.div>
    );
}
