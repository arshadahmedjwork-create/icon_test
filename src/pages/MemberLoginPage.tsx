import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Stethoscope, Eye, EyeOff, Mail, Lock, Layout, Phone, LogIn } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import ForgotPasswordModal from "@/components/ForgotPasswordModal";

const roleDashboardPaths: Record<string, string> = {
    admin: "/dashboard/admin",
    core_team: "/dashboard/core-team",
    staff: "/dashboard/staff",
    judge: "/dashboard/judge",
    volunteer: "/dashboard/volunteer",
    student: "/dashboard/student"
};

type LoginType = "student" | "staff";

export default function MemberLoginPage() {
    const navigate = useNavigate();
    const { login, studentLogin } = useAuth();

    const [loginType, setLoginType] = useState<LoginType>("student");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);

    // Form states
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [mobile, setMobile] = useState("");

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!email) {
            toast.error("Please enter your email");
            return;
        }

        if (!password) {
            toast.error("Please enter your password");
            return;
        }

        setLoading(true);

        try {
            if (loginType === "student") {
                await studentLogin(email, password);
                toast.success("Login successful! Welcome back.");
                navigate("/dashboard/student");
            } else {
                // Determine user's true role from database implicitly by passing 'staff' as placeholder
                // The actual mapping happens inside AuthContext based on database lookup
                const actualRole = await login(email, password, "staff");
                toast.success("Login successful! Welcome back.");
                navigate(roleDashboardPaths[actualRole] || "/");
            }
        } catch (error: any) {
            console.error(error);
            toast.error(error.message || "Invalid login credentials. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col lg:flex-row font-sans">
            <ForgotPasswordModal
                isOpen={isForgotModalOpen}
                onClose={() => setIsForgotModalOpen(false)}
            />
            {/* LEFT PANEL */}
            <div className="w-full lg:w-1/2 bg-gradient-to-br from-[#004d40] to-[#2e7d32] flex items-center justify-center p-8 lg:p-12 text-white">
                <motion.div
                    className="max-w-md space-y-6"
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
                            Scientific Event Management & Evaluation System
                        </h2>
                        <p className="text-white/80 text-lg leading-relaxed font-light">
                            Manage inter-college dental symposiums end-to-end — registrations, evaluations, certificates, and everything in between.
                        </p>
                    </div>

                    <div className="pt-8 border-t border-white/10 flex items-center gap-3 text-white/60">
                        <Layout className="w-5 h-5" />
                        <span className="text-sm font-medium uppercase tracking-wider">Unified Platform Access</span>
                    </div>
                </motion.div>
            </div>

            {/* RIGHT PANEL */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-6 bg-slate-50">
                <motion.div
                    className="w-full max-w-md bg-white p-8 rounded-3xl shadow-xl border border-slate-100"
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                >
                    <div className="mb-8 text-center sm:text-left">
                        <div className="flex items-center gap-3 justify-center sm:justify-start mb-2">
                            <div className="bg-[#004d40]/10 p-2 rounded-xl text-[#004d40]">
                                <LogIn className="w-6 h-6" />
                            </div>
                            <h3 className="text-2xl font-bold text-slate-900">SIGN IN</h3>
                        </div>
                        <p className="text-slate-500 italic text-sm">Select your account type to continue.</p>
                    </div>

                    {/* Toggle Switch */}
                    <div className="flex bg-slate-100 p-1 rounded-xl mb-8">
                        <button
                            type="button"
                            onClick={() => { setLoginType("student"); setEmail(""); setPassword(""); setMobile(""); }}
                            className={cn(
                                "flex-1 py-3 text-sm font-semibold rounded-lg transition-all",
                                loginType === "student"
                                    ? "bg-white text-slate-900 shadow-sm"
                                    : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
                            )}
                        >
                            STUDENT DELEGATE
                        </button>
                        <button
                            type="button"
                            onClick={() => { setLoginType("staff"); setEmail(""); setPassword(""); setMobile(""); }}
                            className={cn(
                                "flex-1 py-3 text-sm font-semibold rounded-lg transition-all",
                                loginType === "staff"
                                    ? "bg-[#004d40] text-white shadow-sm"
                                    : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
                            )}
                        >
                            STAFF / ADMIN
                        </button>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-5">
                        <div className="space-y-2">
                            <Label htmlFor="email" className="text-slate-700 font-medium">Email Address</Label>
                            <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="your@email.com"
                                    className="pl-12 h-12 rounded-xl focus:ring-2 focus:ring-[#004d40]/20 bg-slate-50/50"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <Label htmlFor="password" className="text-slate-700 font-medium">Password</Label>
                                {loginType === "staff" && (
                                    <button
                                        type="button"
                                        onClick={() => setIsForgotModalOpen(true)}
                                        className="text-sm text-[#004d40] font-semibold hover:underline"
                                    >
                                        Forgot Password?
                                    </button>
                                )}
                            </div>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                <Input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    placeholder="••••••••"
                                    className="pl-12 pr-12 h-12 rounded-xl focus:ring-2 focus:ring-[#004d40]/20 bg-slate-50/50"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />
                                <button
                                    type="button"
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                                    onClick={() => setShowPassword(!showPassword)}
                                >
                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>

                        <div className="pt-2">
                            <Button
                                type="submit"
                                className="w-full h-12 bg-[#004d40] hover:bg-[#003d33] text-white rounded-xl shadow-lg transition-all active:scale-[0.98]"
                                disabled={loading}
                            >
                                {loading ? (
                                    <div className="flex items-center gap-2">
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        <span>Signing in...</span>
                                    </div>
                                ) : (
                                    "Secure Sign In"
                                )}
                            </Button>
                        </div>
                    </form>

                    {loginType === "student" && (
                        <p className="mt-8 text-center text-slate-500 text-sm">
                            New delegate?{" "}
                            <button
                                onClick={() => navigate("/student-registration")}
                                className="text-[#004d40] font-bold hover:underline"
                            >
                                Register Here
                            </button>
                        </p>
                    )}
                </motion.div>
            </div>
        </div>
    );
}
