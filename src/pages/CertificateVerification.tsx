import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { createClient } from "@supabase/supabase-js";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle2, XCircle, Award, Calendar, User, BookOpen, ShieldCheck } from "lucide-react";
import { cleanCertificateName } from "../lib/utils";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://fzxtxumrmhudvzhxvawa.supabase.co";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function CertificateVerification() {
    const { certificateId } = useParams<{ certificateId: string }>();
    const [loading, setLoading] = useState(true);
    const [certificate, setCertificate] = useState<any>(null);
    const [recipient, setRecipient] = useState<any>(null);
    const [session, setSession] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const verify = async () => {
            if (!certificateId) {
                setError("No certificate ID provided.");
                setLoading(false);
                return;
            }

            try {
                // Fetch certificate metadata
                const { data: cert, error: certErr } = await supabase
                    .from("certificates")
                    .select("*")
                    .eq("id", certificateId)
                    .single();

                if (certErr || !cert) {
                    setError("This certificate ID could not be found or verified in our records.");
                    setLoading(false);
                    return;
                }

                setCertificate(cert);

                const role = cert.role || cert.certificateType?.toLowerCase() || "student";
                const userId = cert.user_id || cert.eventStudentId;

                // Fetch recipient info
                if (role === "judge") {
                    const { data: judge } = await supabase
                        .from("judges")
                        .select("fullName, college")
                        .eq("id", userId)
                        .single();
                    if (judge) {
                        setRecipient({ name: cleanCertificateName(judge.fullName), college: judge.college || "N/A", role: "Judge" });
                    }
                } else {
                    const { data: student } = await supabase
                        .from("event_students")
                        .select("participantName, college")
                        .eq("id", userId)
                        .single();
                    if (student) {
                        setRecipient({ name: cleanCertificateName(student.participantName), college: student.college, role: "Student" });
                    }
                }

                // Fetch session info
                const sId = cert.session_id || cert.eventId;
                if (sId) {
                    const { data: sess } = await supabase
                        .from("sessions")
                        .select("name, subject")
                        .eq("id", sId)
                        .single();
                    if (sess) {
                        setSession(sess);
                    }
                }
            } catch (err: any) {
                console.error("Verification error:", err);
                setError("An error occurred while verifying the certificate.");
            } finally {
                setLoading(false);
            }
        };

        verify();
    }, [certificateId]);

    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
            <div className="w-full max-w-lg space-y-6">
                {/* Header branding */}
                <div className="text-center space-y-2">
                    <div className="inline-flex p-3 bg-blue-500/10 rounded-full border border-blue-500/20 text-blue-400 mb-2">
                        <ShieldCheck className="w-8 h-8" />
                    </div>
                    <h1 className="text-2xl font-bold font-display text-white">MIDAS Verification Portal</h1>
                    <p className="text-slate-400 text-sm">Official Credentials Verification Service</p>
                </div>

                {loading ? (
                    <Card className="bg-slate-800 border-slate-700 text-white">
                        <CardContent className="flex flex-col items-center justify-center p-12 text-center space-y-4">
                            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                            <p className="text-slate-400 text-sm">Verifying credential validity...</p>
                        </CardContent>
                    </Card>
                ) : error ? (
                    <Card className="bg-slate-800 border-red-500/30 text-white shadow-2xl">
                        <CardHeader className="pb-2 text-center">
                            <div className="mx-auto w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mb-4 text-red-500">
                                <XCircle className="w-8 h-8" />
                            </div>
                            <CardTitle className="text-red-400 text-xl font-bold">Verification Failed</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 text-center pb-6">
                            <p className="text-slate-300 text-sm">{error}</p>
                            <div className="pt-2">
                                <Link to="/" className="inline-flex items-center text-sm font-semibold text-blue-400 hover:text-blue-300 transition-colors">
                                    Return to Login
                                </Link>
                            </div>
                        </CardContent>
                    </Card>
                ) : (
                    <Card className="bg-slate-800 border-emerald-500/30 text-white shadow-2xl overflow-hidden relative">
                        {/* Decorative background pulse */}
                        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl"></div>

                        <CardHeader className="border-b border-slate-700/50 pb-4 text-center">
                            <div className="mx-auto w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mb-2 text-emerald-400 animate-pulse">
                                <CheckCircle2 className="w-8 h-8" />
                            </div>
                            <CardTitle className="text-white text-xl font-bold font-display">Credential Verified</CardTitle>
                            <Badge className="bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/20 font-bold px-3 py-0.5 mt-2">
                                STATUS: VALID
                            </Badge>
                        </CardHeader>
                        
                        <CardContent className="p-6 space-y-5">
                            <div className="space-y-4">
                                <div className="flex gap-3 items-start">
                                    <div className="p-2 bg-slate-700/50 rounded-lg text-slate-400 shrink-0">
                                        <User className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Recipient Name</p>
                                        <p className="text-base font-bold text-white mt-0.5">{recipient?.name}</p>
                                        <p className="text-xs text-slate-400">{recipient?.college}</p>
                                    </div>
                                </div>

                                <div className="flex gap-3 items-start">
                                    <div className="p-2 bg-slate-700/50 rounded-lg text-slate-400 shrink-0">
                                        <Award className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Credential Type</p>
                                        <p className="text-base font-bold text-white mt-0.5">
                                            {certificate?.certificateType === "WINNER" 
                                                ? `Merit Certificate (Rank ${certificate?.rank})`
                                                : recipient?.role === "Judge"
                                                ? "Judge Participation Certificate"
                                                : "Participation Certificate"
                                            }
                                        </p>
                                    </div>
                                </div>

                                <div className="flex gap-3 items-start">
                                    <div className="p-2 bg-slate-700/50 rounded-lg text-slate-400 shrink-0">
                                        <BookOpen className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Event Session</p>
                                        <p className="text-base font-bold text-white mt-0.5">{session?.name || "Oral Presentation"}</p>
                                        <p className="text-xs text-slate-400">Subject: {session?.subject}</p>
                                    </div>
                                </div>

                                <div className="flex gap-3 items-start">
                                    <div className="p-2 bg-slate-700/50 rounded-lg text-slate-400 shrink-0">
                                        <Calendar className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Date Issued</p>
                                        <p className="text-base font-bold text-white mt-0.5">
                                            {new Date(certificate?.generatedAt || certificate?.generated_at).toLocaleDateString(undefined, {
                                                year: 'numeric',
                                                month: 'long',
                                                day: 'numeric'
                                            })}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="border-t border-slate-700/50 pt-4 flex flex-col gap-2">
                                <p className="text-[10px] text-slate-500 font-mono text-center break-all">
                                    ID: {certificate?.id}
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}
