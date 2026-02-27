
import { useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    FileText, Upload, Clock, CheckCircle2, XCircle,
    AlertCircle, Plus, Eye, Loader2
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import React from "react";

interface SubmissionItem {
    id: string;
    eventName: string;
    title: string;
    fileName: string;
    status: "PENDING" | "APPROVED" | "REJECTED";
    submittedAt: string;
    remarks?: string;
}

const statusConfig: Record<string, any> = {
    DRAFT: { label: "Draft", icon: Clock, color: "bg-slate-50 text-slate-700 border-slate-200", dot: "bg-slate-500" },
    SUBMITTED: { label: "Submitted", icon: Clock, color: "bg-blue-50 text-blue-700 border-blue-200", dot: "bg-blue-500" },
    PENDING: { label: "Pending Review", icon: Clock, color: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500" },
    APPROVED: { label: "Approved", icon: CheckCircle2, color: "bg-green-50 text-green-700 border-green-200", dot: "bg-green-500" },
    REJECTED: { label: "Rejected", icon: XCircle, color: "bg-red-50 text-red-700 border-red-200", dot: "bg-red-500" },
};

export default function StudentSubmissionsPage() {
    const { user } = useAuth();
    const [submissions, setSubmissions] = useState<SubmissionItem[]>([]);
    const [enrolledPaperEvents, setEnrolledPaperEvents] = useState<{ id: string, name: string }[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showNew, setShowNew] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [newForm, setNewForm] = useState({ eventId: "", title: "", remarks: "" });
    const [newFile, setNewFile] = useState<File | null>(null);

    React.useEffect(() => {
        loadData();
    }, [user?.id]);

    const loadData = async () => {
        if (!user?.id) return;
        setIsLoading(true);
        try {
            // First logic: get enrolled events (from user.selectedEvents or similar if available, or fetch from event_students)
            const { data: student } = await supabase.from('event_students').select('selectedEvents').eq('id', user.id).single();
            if (student?.selectedEvents) {
                const paperEvents = student.selectedEvents
                    .filter((e: any) => e.type.toUpperCase().includes("PAPER") || e.type.toUpperCase().includes("POSTER"))
                    .map((e: any, idx: number) => ({
                        id: `evt-${idx}`,
                        name: `${e.type} — ${e.subject}`,
                        raw: e
                    }));
                setEnrolledPaperEvents(paperEvents);
            }

            // Next logic: get past submissions
            const { data: subsData } = await supabase.from('submissions').select('*').eq('eventStudentId', user.id).order('submissionDate', { ascending: false });
            if (subsData) {
                setSubmissions(subsData.map((s: any) => ({
                    id: s.id,
                    eventName: s.eventName || s.subject || "Unknown",
                    title: s.title,
                    fileName: s.fileName || "abstract.pdf",
                    status: s.status as any,
                    submittedAt: s.submissionDate,
                    remarks: s.remarks
                })));
            }
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 10 * 1024 * 1024) { toast.error("File must be under 10MB"); return; }
        setNewFile(file);
    };

    const handleSubmit = async () => {
        if (!newForm.eventId || !newForm.title || !newFile || !user?.id) {
            toast.error("Event, title, and file are required"); return;
        }
        setSubmitting(true);
        try {
            const event = enrolledPaperEvents.find(e => e.id === newForm.eventId);

            // 1. Upload File
            const fileExt = newFile.name.split('.').pop();
            const filePath = `${user.id}/${Date.now()}_abstract.${fileExt}`;
            const { error: uploadError } = await supabase.storage.from('abstracts').upload(filePath, newFile);

            if (uploadError && uploadError.message !== 'Bucket not found') {
                throw uploadError;
            } else if (uploadError && uploadError.message === 'Bucket not found') {
                console.warn("Abstracts bucket not found, skipping physical upload for demo");
                toast.warning("File upload skipped (missing bucket). Using dummy URL.");
            }

            // Map string values to Supabase Enums safely
            const rawType = ((event as any)?.raw?.type || "").toUpperCase();
            const dbType = rawType.includes("PAPER") ? "PAPER" : rawType.includes("POSTER") ? "POSTER" : "PAPER"; // Fallback to PAPER

            const rawMode = ((event as any)?.raw?.mode || "").toUpperCase();
            const dbMode = rawMode.includes("ONLINE") ? "ONLINE" : "OFFLINE"; // Fallback to OFFLINE

            const dbData = {
                eventStudentId: user.id,
                eventName: event?.name,
                title: newForm.title,
                fileName: newFile.name,
                abstractFileUrl: filePath,
                status: "DRAFT",
                remarks: newForm.remarks,
                eventType: dbType,
                eventMode: dbMode,
                subject: (event as any)?.raw?.subject
            };

            const { error: dbError } = await supabase.from('submissions').insert(dbData);
            if (dbError) throw dbError;

            await loadData(); // refresh

            setShowNew(false);
            setNewForm({ eventId: "", title: "", remarks: "" });
            setNewFile(null);
            toast.success("Abstract submitted successfully!");
        } catch (error: any) {
            console.error("Submission error:", error);
            toast.error(error.message || "Failed to submit abstract.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Submissions</h1>
                    <p className="text-sm text-slate-500 mt-1">Upload and track your abstract submissions for paper presentations.</p>
                </div>
                <Button className="rounded-xl bg-[#004d40] hover:bg-[#003d33] h-10" onClick={() => setShowNew(true)}>
                    <Plus className="w-4 h-4 mr-2" /> New Submission
                </Button>
            </div>

            {/* Info notice */}
            <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-700">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-blue-500" />
                <div>
                    <p className="font-semibold">Submission Rules</p>
                    <ul className="mt-1 space-y-0.5 text-blue-600 text-xs list-disc list-inside">
                        <li>Only enrolled paper/poster presentation participants can submit abstracts.</li>
                        <li>Abstract must be approved by admin/judges before you can present.</li>
                        <li>Accepted formats: PDF, DOC (Max 10MB).</li>
                    </ul>
                </div>
            </div>

            {/* Submissions List */}
            <div className="space-y-3">
                {submissions.map((sub, i) => {
                    const cfg = statusConfig[sub.status] || { label: sub.status, icon: AlertCircle, color: "bg-gray-50 text-gray-700 border-gray-200", dot: "bg-gray-500" };
                    return (
                        <motion.div
                            key={sub.id}
                            className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm hover:shadow-md transition-all"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.05 }}
                        >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                                        <h3 className="font-bold text-slate-900 text-sm truncate">{sub.title}</h3>
                                    </div>
                                    <p className="text-xs text-slate-500 ml-6">{sub.eventName}</p>
                                    <p className="text-xs text-slate-400 ml-6 mt-1">
                                        📎 {sub.fileName} • Submitted {new Date(sub.submittedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                                    </p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border ${cfg.color}`}>
                                        <div className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                                        {cfg.label}
                                    </span>
                                </div>
                            </div>
                        </motion.div>
                    );
                })}
            </div>

            {submissions.length === 0 && (
                <div className="text-center py-16 text-slate-400">
                    <FileText className="w-12 h-12 mx-auto mb-3 text-slate-200" />
                    <p className="font-medium">No submissions yet</p>
                    <p className="text-sm mt-1">Enroll in a paper/poster event and submit your abstract.</p>
                </div>
            )}

            {/* New Submission Dialog */}
            <Dialog open={showNew} onOpenChange={setShowNew}>
                <DialogContent className="sm:max-w-lg rounded-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-lg">Submit Abstract</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label className="font-medium">Event <span className="text-red-500">*</span></Label>
                            <Select value={newForm.eventId} onValueChange={(v) => setNewForm({ ...newForm, eventId: v })}>
                                <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Select enrolled event" /></SelectTrigger>
                                <SelectContent>
                                    {enrolledPaperEvents.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label className="font-medium">Abstract Title <span className="text-red-500">*</span></Label>
                            <Input value={newForm.title} onChange={(e) => setNewForm({ ...newForm, title: e.target.value })} placeholder="Enter title" className="h-11 rounded-xl" />
                        </div>
                        <div className="space-y-2">
                            <Label className="font-medium">Upload Abstract (PDF/DOC) <span className="text-red-500">*</span></Label>
                            <label className="flex items-center justify-center gap-3 h-14 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50 cursor-pointer hover:border-[#004d40]/40 transition-colors">
                                <Upload className="w-4 h-4 text-slate-400" />
                                <span className="text-sm text-slate-500">{newFile ? newFile.name : "Click to upload"}</span>
                                <input type="file" accept=".pdf,.doc,.docx" onChange={handleFileChange} className="hidden" />
                            </label>
                        </div>
                        <div className="space-y-2">
                            <Label className="font-medium">Remarks <span className="text-slate-300 text-xs">(optional)</span></Label>
                            <Textarea value={newForm.remarks} onChange={(e) => setNewForm({ ...newForm, remarks: e.target.value })} placeholder="Any additional notes..." className="rounded-xl resize-none" rows={3} />
                        </div>
                    </div>
                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => setShowNew(false)} className="rounded-xl">Cancel</Button>
                        <Button onClick={handleSubmit} disabled={submitting} className="rounded-xl bg-[#004d40] hover:bg-[#003d33]">
                            {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Submitting...</> : "Submit Abstract"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
