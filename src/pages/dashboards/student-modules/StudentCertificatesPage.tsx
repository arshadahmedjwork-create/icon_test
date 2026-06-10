
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
    Award, Download, Trophy, Medal, Star, Loader2, Sparkles, CheckCircle2
} from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { useProgram } from "@/contexts/ProgramContext";
import { getCertificates, getSessions } from "@/services/supabaseService";
import { downloadCertificate } from "@/services/certificateEngine";

interface CertificateItem {
    id: string;
    eventName: string;
    eventType: string;
    eventDate: string;
    participated: boolean;
    prizePosition: string | null;
    certificateType: "PARTICIPATION" | "WINNER" | "RUNNER_UP" | "SECOND_RUNNER_UP";
    fileUrl: string | null;
}

const certConfig = {
    WINNER: {
        label: "Winner Certificate",
        subtitle: "1st Prize",
        icon: Trophy,
        color: "from-amber-400 to-yellow-600",
        badge: "bg-amber-50 text-amber-700 border-amber-200",
        ring: "ring-amber-400/30",
    },
    RUNNER_UP: {
        label: "Runner-up Certificate",
        subtitle: "2nd Prize",
        icon: Medal,
        color: "from-indigo-400 to-violet-600",
        badge: "bg-indigo-50 text-indigo-700 border-indigo-200",
        ring: "ring-indigo-400/30",
    },
    SECOND_RUNNER_UP: {
        label: "2nd Runner-up Certificate",
        subtitle: "3rd Prize",
        icon: Star,
        color: "from-orange-400 to-orange-600",
        badge: "bg-orange-50 text-orange-700 border-orange-200",
        ring: "ring-orange-400/30",
    },
    PARTICIPATION: {
        label: "Participation Certificate",
        subtitle: "Participated",
        icon: Award,
        color: "from-blue-500 to-blue-600",
        badge: "bg-blue-50 text-blue-700 border-blue-200",
        ring: "ring-blue-400/30",
    },
};

export default function StudentCertificatesPage() {
    const { user } = useAuth();
    const { currentProgram } = useProgram();
    const [certificates, setCertificates] = useState<CertificateItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState<string | null>(null);

    useEffect(() => {
        const loadCertificates = async () => {
            if (user) {
                try {
                    const [allCerts, allSessions] = await Promise.all([
                        getCertificates(),
                        getSessions(currentProgram)
                    ]);
                    
                    const myCerts = allCerts.filter(c => c.userId === user.id);
                    
                    const mapped: CertificateItem[] = myCerts.map(c => {
                        const session = allSessions.find(s => s.id === c.sessionId);
                        
                        let prizePos = null;
                        if (c.rank === 1) prizePos = "1st";
                        else if (c.rank === 2) prizePos = "2nd";
                        else if (c.rank === 3) prizePos = "3rd";
                        
                        let certType: any = "PARTICIPATION";
                        if (c.type === "winner") {
                            if (c.rank === 1) certType = "WINNER";
                            else if (c.rank === 2) certType = "RUNNER_UP";
                            else if (c.rank === 3) certType = "SECOND_RUNNER_UP";
                        }
                        
                        return {
                            id: c.id,
                            eventName: session?.name || `Participation Certificate - ${c.id.slice(0, 8)}`,
                            eventType: session?.type || "EVENT",
                            eventDate: session?.date || c.generatedAt || new Date().toISOString(),
                            participated: true,
                            prizePosition: prizePos,
                            certificateType: certType,
                            fileUrl: c.downloadUrl
                        };
                    });
                    
                    setCertificates(mapped);
                } catch (e) {
                    console.error("Failed to load certificates:", e);
                } finally {
                    setLoading(false);
                }
            }
        };
        loadCertificates();
    }, [user, currentProgram]);

    const handleDownload = async (cert: CertificateItem) => {
        setGenerating(cert.id);
        toast.info("Generating official PDF certificate...");
        try {
            await downloadCertificate(cert.id);
            toast.success("Certificate downloaded successfully!");
        } catch (error: any) {
            console.error("Download failed:", error);
            toast.error(`Failed to download certificate: ${error.message || error}`);
        } finally {
            setGenerating(null);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-24 text-center space-y-4">
                <Loader2 className="w-8 h-8 animate-spin text-[#004d40]" />
                <p className="text-slate-500 text-sm">Retrieving your dynamic certificates...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Certificates</h1>
                    <p className="text-sm text-slate-500 mt-1">Download certificates for events you participated in or won.</p>
                </div>

                {/* Header Ad Box */}
                <div className="flex-grow rounded-2xl overflow-hidden shadow-sm flex items-center justify-center h-[110px] border border-[#b00004]" style={{ backgroundColor: '#d30005' }}>
                    <img src="/silver.png" alt="Silver Sponsor" className="w-full h-full object-contain p-1" />
                </div>
            </div>

            {/* Certificate Types Legend */}
            <div className="bg-gradient-to-r from-[#004d40] to-[#2e7d32] rounded-2xl p-6 text-white">
                <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                        <Award className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                        <h3 className="font-bold text-lg mb-3">4 Certificate Types</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="flex items-center gap-3 bg-white/10 rounded-xl px-4 py-2.5 border border-white/10">
                                <Trophy className="w-5 h-5 text-amber-300 shrink-0" />
                                <div>
                                    <p className="font-bold text-sm">🥇 1st Prize</p>
                                    <p className="text-white/60 text-xs">Winner Certificate</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 bg-white/10 rounded-xl px-4 py-2.5 border border-white/10">
                                <Medal className="w-5 h-5 text-indigo-300 shrink-0" />
                                <div>
                                    <p className="font-bold text-sm">🥈 2nd Prize</p>
                                    <p className="text-white/60 text-xs">Runner-up Certificate</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 bg-white/10 rounded-xl px-4 py-2.5 border border-white/10">
                                <Star className="w-5 h-5 text-orange-300 shrink-0" />
                                <div>
                                    <p className="font-bold text-sm">🥉 3rd Prize</p>
                                    <p className="text-white/60 text-xs">2nd Runner-up Certificate</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 bg-white/10 rounded-xl px-4 py-2.5 border border-white/10">
                                <Award className="w-5 h-5 text-blue-300 shrink-0" />
                                <div>
                                    <p className="font-bold text-sm">📜 Participated</p>
                                    <p className="text-white/60 text-xs">Participation Certificate</p>
                                </div>
                            </div>
                        </div>
                        <p className="text-white/50 text-xs mt-3">❌ No certificate is issued for absentees.</p>
                    </div>
                </div>
            </div>

            {/* Certificates Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-5">
                {certificates.map((cert, i) => {
                    const cfg = certConfig[cert.certificateType];
                    return (
                        <motion.div
                            key={cert.id}
                            className={`bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm hover:shadow-xl transition-all group ring-2 ${cfg.ring}`}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.08 }}
                        >
                            {/* Certificate Banner */}
                            <div className={`h-32 bg-gradient-to-br ${cfg.color} relative flex items-center justify-center overflow-hidden`}>
                                {/* Decorative pattern */}
                                <div className="absolute inset-0 opacity-10">
                                    <div className="absolute top-2 left-4 w-16 h-16 border-2 border-white rounded-full" />
                                    <div className="absolute bottom-2 right-4 w-20 h-20 border-2 border-white rounded-full" />
                                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 border border-white rounded-full" />
                                </div>

                                <div className="relative text-center text-white z-10">
                                    <cfg.icon className="w-10 h-10 mx-auto mb-2 drop-shadow-md" />
                                    <p className="text-sm font-black uppercase tracking-widest">{cfg.subtitle}</p>
                                    <p className="text-xs font-medium text-white/70 mt-0.5">{cfg.label}</p>
                                </div>

                                {/* Prize position badge */}
                                {cert.prizePosition && (
                                    <div className="absolute top-3 right-3 w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-sm font-black text-white border-2 border-white/30 shadow-lg">
                                        #{cert.prizePosition.replace(/[^0-9]/g, '')}
                                    </div>
                                )}
                            </div>

                            {/* Certificate Details */}
                            <div className="p-5">
                                <h3 className="font-bold text-slate-900 text-sm mb-3">{cert.eventName}</h3>

                                <div className="space-y-2 text-xs text-slate-500 mb-5">
                                    <div className="flex justify-between items-center">
                                        <span>Event Type</span>
                                        <span className="font-semibold text-slate-700">{cert.eventType}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span>Event Date</span>
                                        <span className="font-semibold text-slate-700">
                                            {new Date(cert.eventDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span>Attendance</span>
                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold border ${cert.participated ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"}`}>
                                            {cert.participated ? "✅ Present" : "❌ Absent"}
                                        </span>
                                    </div>
                                    {cert.prizePosition && (
                                        <div className="flex justify-between items-center">
                                            <span>Prize Position</span>
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-bold border ${cfg.badge}`}>
                                                <cfg.icon className="w-3 h-3" /> {cert.prizePosition} Place
                                            </span>
                                        </div>
                                    )}
                                    <div className="flex justify-between items-center">
                                        <span>Certificate Type</span>
                                        <span className="font-bold text-slate-800">{cfg.label}</span>
                                    </div>
                                </div>

                                <Button
                                    className="w-full h-11 rounded-xl bg-[#004d40] hover:bg-[#003d33] text-sm font-bold group-hover:shadow-lg transition-all"
                                    onClick={() => handleDownload(cert)}
                                    disabled={generating === cert.id || !cert.participated}
                                >
                                    {generating === cert.id ? (
                                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating PDF...</>
                                    ) : !cert.participated ? (
                                        <>Not Eligible</>
                                    ) : (
                                        <><Download className="w-4 h-4 mr-2" /> Download Certificate</>
                                    )}
                                </Button>
                            </div>
                        </motion.div>
                    );
                })}
            </div>

            {certificates.length === 0 && (
                <div className="text-center py-16 text-slate-400">
                    <Award className="w-12 h-12 mx-auto mb-3 text-slate-200" />
                    <p className="font-medium">No certificates available</p>
                    <p className="text-sm mt-1">Certificates will be generated after events conclude.</p>
                </div>
            )}
        </div>
    );
}
