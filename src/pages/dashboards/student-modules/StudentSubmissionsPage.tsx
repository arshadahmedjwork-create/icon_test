import { useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    FileText, Upload, Clock, CheckCircle2, XCircle,
    AlertCircle, Plus, Eye, Loader2, Trash2
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
    AlertDialog, 
    AlertDialogAction, 
    AlertDialogCancel, 
    AlertDialogContent, 
    AlertDialogDescription, 
    AlertDialogFooter, 
    AlertDialogHeader, 
    AlertDialogTitle, 
    AlertDialogTrigger 
} from "@/components/ui/alert-dialog";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getStudentSessionsAndSubmissions, uploadPresentationFile, updateAbstract, getEvents } from "@/services/supabaseService";
import { useAuth } from "@/contexts/AuthContext";
import { useProgram } from "@/contexts/ProgramContext";
import { supabase } from "@/lib/supabaseClient";
import React from "react";

interface SubmissionItem {
    id: string;
    eventName: string;
    title: string;
    fileName: string;
    status: "DRAFT" | "SUBMITTED" | "PENDING" | "APPROVED" | "REJECTED" | "REVISION_REQUESTED";
    submittedAt: string;
    remarks?: string;
    abstractFileUrl?: string;
}

const statusConfig: Record<string, any> = {
    DRAFT: { label: "Draft", icon: Clock, color: "bg-slate-50 text-slate-700 border-slate-200", dot: "bg-slate-500" },
    SUBMITTED: { label: "Submitted", icon: Clock, color: "bg-blue-50 text-blue-700 border-blue-200", dot: "bg-blue-500" },
    PENDING: { label: "Pending Review", icon: Clock, color: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500" },
    APPROVED: { label: "Approved", icon: CheckCircle2, color: "bg-green-50 text-green-700 border-green-200", dot: "bg-green-500" },
    REJECTED: { label: "Rejected", icon: XCircle, color: "bg-red-50 text-red-700 border-red-200", dot: "bg-red-500" },
};

const iconSpecialities = [
    "Oral & Maxillofacial Surgery",
    "Orthodontics",
    "Periodontics",
    "Conservative Dentistry & Endodontics",
    "Prosthodontics",
    "Oral Medicine & Radiology",
    "Oral Pathology",
    "Pedodontics",
    "Public Health Dentistry",
    "Other"
];

export default function StudentSubmissionsPage() {
    const { user } = useAuth();
    const { currentProgram } = useProgram();
    const [submissions, setSubmissions] = useState<SubmissionItem[]>([]);
    const [enrolledPaperEvents, setEnrolledPaperEvents] = useState<{ id: string, name: string, abstractDeadline?: string | null, raw?: any }[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showNew, setShowNew] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [newForm, setNewForm] = useState({ 
        eventId: "", 
        title: "", 
        remarks: "",
        keywords: "",
        hodName: "",
        speciality: ""
    });
    const [newFile, setNewFile] = useState<File | null>(null);
    const [viewingDetails, setViewingDetails] = useState<SubmissionItem | null>(null);
    const [scheduledSessions, setScheduledSessions] = useState<{ submission: any, session: any }[]>([]);
    const [uploadingSessionId, setUploadingSessionId] = useState<string | null>(null);
    const [showUploadSuccess, setShowUploadSuccess] = useState(false);

    const isIcon = currentProgram === 'ICON';
    const themeColor = isIcon ? "bg-[#b91c1c] hover:bg-[#991b1b]" : "bg-[#004d40] hover:bg-[#003d33]";

    React.useEffect(() => {
        loadData();
    }, [user?.id, currentProgram]);

    const loadData = async () => {
        if (!user?.id) return;
        setIsLoading(true);
        try {
            const dbEvents = await getEvents(currentProgram);
            
            // Get enrolled events
            const { data: student } = await supabase.from('event_students').select('*').eq('id', user.id).single();
            if (student?.selectedEvents) {
                const paperEvents = student.selectedEvents
                    .filter((e: any) => e.type.toUpperCase().includes("PAPER") || e.type.toUpperCase().includes("POSTER"))
                    .map((e: any, idx: number) => {
                        const matchingDbEvent = dbEvents.find(evt => 
                            e.type === evt.type && 
                            e.mode.toUpperCase() === evt.mode.toUpperCase() && 
                            (e.subject === evt.name || e.subject === evt.type)
                        );
                        return {
                            id: matchingDbEvent?.id || `evt-${idx}`,
                            name: `${e.type} — ${e.subject}`,
                            abstractDeadline: matchingDbEvent?.abstractDeadline || null,
                            raw: e
                        };
                    });
                setEnrolledPaperEvents(paperEvents);
            }

            // Get past submissions
            const { data: subsData } = await supabase.from('submissions')
                .select('*')
                .eq('eventStudentId', user.id)
                .eq('program', currentProgram)
                .order('submissionDate', { ascending: false });
            
            if (subsData) {
                setSubmissions(subsData.map((s: any) => ({
                    id: s.id,
                    eventName: s.eventName || s.subject || "Unknown",
                    title: s.title,
                    fileName: s.fileName || "abstract.pdf",
                    status: s.status as any,
                    submittedAt: s.submissionDate,
                    remarks: s.remarks,
                    abstractFileUrl: s.abstractFileUrl
                })));
            }

            // Get scheduled sessions and their submissions
            const sessionsAndSubmissions = await getStudentSessionsAndSubmissions(user.id, currentProgram);
            setScheduledSessions(sessionsAndSubmissions.filter((item: any) => item.session !== null));
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleFileUpload = async (abstractId: string, file: File) => {
        setUploadingSessionId(abstractId);
        try {
            const uploadedUrl = await uploadPresentationFile(abstractId, file);
            if (!uploadedUrl) throw new Error("Upload failed");

            await updateAbstract(abstractId, { presentationUrl: uploadedUrl });

            setShowUploadSuccess(true);
            await loadData();
        } catch (error) {
            console.error(error);
            toast.error("Failed to upload presentation.");
        } finally {
            setUploadingSessionId(null);
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

        const event = enrolledPaperEvents.find(e => e.id === newForm.eventId);
        const deadline = event?.abstractDeadline;

        const isDeadlinePassed = deadline 
            ? new Date() > new Date(deadline) 
            : new Date() > new Date("2026-05-31T23:59:59"); // fallback default deadline

        if (isDeadlinePassed) {
            const formattedDeadline = deadline 
                ? new Date(deadline).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                : "31 May 2026";
            toast.error(`Submission closed. The deadline of ${formattedDeadline} has passed.`);
            return;
        }

        if (isIcon && !newForm.speciality) {
            toast.error("Speciality is required for ICON submissions");
            return;
        }

        const isDuplicate = submissions.some(s => s.eventName === event?.name);
        if (isDuplicate) {
            toast.error("You already have a submission for this category.");
            return;
        }

        setSubmitting(true);
        try {
            // 1. Upload File
            const fileExt = newFile.name.split('.').pop();
            const filePath = `${user.id}/${Date.now()}_abstract.${fileExt}`;
            await supabase.storage.from('abstracts').upload(filePath, newFile);

            // Map string values to Supabase Enums safely
            const rawType = ((event as any)?.raw?.type || "").toUpperCase();
            const dbType = rawType.includes("PAPER") ? "PAPER" : rawType.includes("POSTER") ? "POSTER" : "PAPER"; 

            const rawMode = ((event as any)?.raw?.mode || "").toUpperCase();
            const dbMode = rawMode.includes("ONLINE") ? "ONLINE" : "OFFLINE"; 

            const dbData = {
                eventStudentId: user.id,
                eventName: event?.name,
                title: newForm.title,
                fileName: newFile.name,
                abstractFileUrl: filePath,
                status: "SUBMITTED",
                remarks: newForm.remarks,
                eventType: dbType,
                eventMode: dbMode,
                subject: isIcon ? newForm.speciality : (event as any)?.raw?.subject,
                program: currentProgram,
                keywords: newForm.keywords.split(",").map(k => k.trim()).filter(k => k),
                hodName: newForm.hodName
            };

            const { error: dbError } = await supabase.from('submissions').insert(dbData);
            if (dbError) throw dbError;

            await loadData(); // refresh

            setShowNew(false);
            setNewForm({ eventId: "", title: "", remarks: "", keywords: "", hodName: "", speciality: "" });
            setNewFile(null);
            toast.success("Abstract submitted successfully!");
        } catch (error: any) {
            console.error("Submission error:", error);
            toast.error(error.message || "Failed to submit abstract.");
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id: string, filePath: string) => {
        try {
            if (filePath) {
                await supabase.storage.from('abstracts').remove([filePath]);
            }
            const { error: dbError } = await supabase.from('submissions').delete().eq('id', id);
            if (dbError) throw dbError;

            toast.success("Submission deleted.");
            setSubmissions(prev => prev.filter(s => s.id !== id));
        } catch (error: any) {
            console.error("Delete error:", error);
            toast.error("Failed to delete submission.");
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                    <h1 className="text-2xl font-bold text-slate-900">{isIcon ? "ICON Abstract Submission" : "Submissions"}</h1>
                    <p className="text-sm text-slate-500 mt-1 mb-2">Upload and track your abstract submissions.</p>
                    {(() => {
                        const hasAnyOpenEvents = enrolledPaperEvents.length > 0 
                            ? enrolledPaperEvents.some(e => {
                                const deadline = e.abstractDeadline;
                                return deadline ? new Date() <= new Date(deadline) : new Date() <= new Date("2026-05-31T23:59:59");
                              })
                            : new Date() <= new Date("2026-05-31T23:59:59");

                        if (!hasAnyOpenEvents) {
                            return (
                                <Button className="rounded-xl h-10 bg-slate-200 text-slate-500 cursor-not-allowed border border-slate-300" disabled>
                                    <XCircle className="w-4 h-4 mr-2 text-slate-400" /> Submission Closed
                                </Button>
                            );
                        }
                        return (
                            <Button className={`rounded-xl h-10 text-white ${themeColor}`} onClick={() => setShowNew(true)}>
                                <Plus className="w-4 h-4 mr-2" /> New Submission
                            </Button>
                        );
                    })()}
                </div>

                {/* Header Ad Box */}
                <div className="flex-grow rounded-2xl overflow-hidden shadow-sm flex items-center justify-center h-[110px] border border-[#b00004]" style={{ backgroundColor: '#d30005' }}>
                    <img src="/silver.png" alt="Silver Sponsor" className="w-full h-full object-contain p-1" />
                </div>
            </div>

            {/* Scheduled Sessions & Presentation Uploads */}
            {scheduledSessions.length > 0 && (
                <div className="space-y-4">
                    {scheduledSessions.map(({ submission, session }) => (
                        <Card key={session.id} className="border-primary/20 bg-gradient-to-br from-primary/5 to-slate-50 overflow-hidden shadow-md rounded-2xl">
                            <CardHeader className="bg-primary/5 pb-3">
                                <div className="flex justify-between items-center flex-wrap gap-2">
                                    <Badge className="bg-primary text-white font-bold px-3 py-1 text-xs">
                                        📅 Scheduled Presentation Session
                                    </Badge>
                                    <Badge variant="outline" className="border-slate-300 font-semibold text-slate-600 bg-white">
                                        📍 {session.venue || "Main Auditorium"}
                                    </Badge>
                                </div>
                                <CardTitle className="text-xl font-bold text-slate-800 mt-2 font-display">{session.name}</CardTitle>
                                <CardDescription className="text-sm font-medium text-slate-500">
                                    {session.subject} • {session.type}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="p-6 space-y-4">
                                <div className="bg-white border rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div>
                                        <h4 className="text-xs uppercase tracking-wider text-slate-400 font-bold">Paper/Poster Title</h4>
                                        <p className="font-bold text-slate-800 text-sm mt-0.5">{submission.title}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-slate-400 font-medium">Status:</span>
                                        <Badge className="bg-green-100 text-green-800 border-none font-bold capitalize text-xs">
                                            {submission.status}
                                        </Badge>
                                    </div>
                                </div>

                                <div className="border-2 border-dashed border-slate-200 bg-white rounded-xl p-6 flex flex-col items-center justify-center text-center">
                                    {submission.presentationUrl ? (
                                        <div className="w-full space-y-3">
                                            <div className="flex items-center justify-center gap-2 text-green-700 bg-green-50/50 border border-green-200 p-3 rounded-lg max-w-md mx-auto">
                                                <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                                                <span className="font-bold text-sm">Slides uploaded successfully!</span>
                                            </div>
                                            <div className="flex flex-wrap gap-2 justify-center">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="h-10 rounded-xl"
                                                    onClick={() => window.open(submission.presentationUrl, "_blank")}
                                                >
                                                    <Eye className="w-4 h-4 mr-2 text-slate-500" /> View Current Slides
                                                </Button>
                                                <label className="h-10 rounded-xl border border-slate-200 hover:bg-slate-50 inline-flex items-center justify-center px-4 text-sm font-semibold cursor-pointer transition-colors bg-white">
                                                    <Upload className="w-4 h-4 mr-2 text-slate-500" />
                                                    {uploadingSessionId === submission.id ? "Uploading..." : "Re-upload Slides"}
                                                    <input
                                                        type="file"
                                                        accept=".ppt,.pptx,.pdf"
                                                        disabled={uploadingSessionId === submission.id}
                                                        onChange={(e) => {
                                                            const file = e.target.files?.[0];
                                                            if (file) handleFileUpload(submission.id, file);
                                                        }}
                                                        className="hidden"
                                                    />
                                                </label>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center mx-auto border border-amber-200">
                                                <AlertCircle className="w-6 h-6 text-amber-600" />
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-slate-800 text-base">Submit Your Presentation Slides</h4>
                                                <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
                                                    Please upload your final PowerPoint (.ppt/.pptx) or Poster (.pdf) slides for evaluation. Max file size: 50MB.
                                                </p>
                                            </div>
                                            <label className="h-11 rounded-xl bg-primary text-white font-bold hover:bg-primary/90 inline-flex items-center justify-center px-6 text-sm cursor-pointer transition-colors shadow-sm">
                                                {uploadingSessionId === submission.id ? (
                                                    <>
                                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Uploading Slides...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Upload className="w-4 h-4 mr-2" /> Choose Slides File
                                                    </>
                                                )}
                                                <input
                                                    type="file"
                                                    accept=".ppt,.pptx,.pdf"
                                                    disabled={uploadingSessionId === submission.id}
                                                    onChange={(e) => {
                                                        const file = e.target.files?.[0];
                                                        if (file) handleFileUpload(submission.id, file);
                                                    }}
                                                    className="hidden"
                                                />
                                            </label>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

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
                                        📎 {sub.fileName} • Submitted {new Date(sub.submittedAt).toLocaleDateString()}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border ${cfg.color}`}>
                                        <div className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                                        {cfg.label}
                                    </span>
                                    <Button variant="ghost" size="icon" onClick={() => setViewingDetails(sub)}><Eye className="w-4 h-4" /></Button>
                                    {sub.status !== "APPROVED" && (
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="ghost" size="icon" className="text-slate-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Delete Submission?</AlertDialogTitle>
                                                    <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleDelete(sub.id, sub.abstractFileUrl || "")} className="bg-red-600">Delete</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    );
                })}
            </div>

            {/* New Submission Dialog */}
            <Dialog open={showNew} onOpenChange={setShowNew}>
                <DialogContent className="sm:max-w-lg rounded-2xl">
                    <DialogHeader><DialogTitle>Submit Abstract</DialogTitle></DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Event *</Label>
                                <Select value={newForm.eventId} onValueChange={(v) => setNewForm({ ...newForm, eventId: v })}>
                                    <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Select event" /></SelectTrigger>
                                    <SelectContent>
                                        {enrolledPaperEvents.map(e => {
                                            const isClosed = e.abstractDeadline ? new Date() > new Date(e.abstractDeadline) : new Date() > new Date("2026-05-31T23:59:59");
                                            return (
                                                <SelectItem key={e.id} value={e.id} disabled={isClosed}>
                                                    {e.name} {isClosed ? "(Closed)" : ""}
                                                </SelectItem>
                                            );
                                        })}
                                    </SelectContent>
                                </Select>
                            </div>
                            {isIcon && (
                                <div className="space-y-2">
                                    <Label>Speciality *</Label>
                                    <Select value={newForm.speciality} onValueChange={(v) => setNewForm({ ...newForm, speciality: v })}>
                                        <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Select speciality" /></SelectTrigger>
                                        <SelectContent>
                                            {iconSpecialities.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label>Abstract Title *</Label>
                            <Input value={newForm.title} onChange={(e) => setNewForm({ ...newForm, title: e.target.value })} placeholder="Enter title" className="h-11 rounded-xl" />
                        </div>

                        {isIcon && (
                            <>
                                <div className="space-y-2">
                                    <Label>Keywords (Comma separated) *</Label>
                                    <Input value={newForm.keywords} onChange={(e) => setNewForm({ ...newForm, keywords: e.target.value })} placeholder="Implant, Oncology, etc." className="h-11 rounded-xl" />
                                </div>
                                {user?.role === 'student' && (
                                    <div className="space-y-2">
                                        {(user as any)?.delegateType === 'Clinician' ? (
                                            <>
                                                <Label>Guide Name (if any)</Label>
                                                <Input value={newForm.hodName} onChange={(e) => setNewForm({ ...newForm, hodName: e.target.value })} placeholder="Enter Guide Name" className="h-11 rounded-xl" />
                                            </>
                                        ) : (
                                            <>
                                                <Label>HOD / Guide Name *</Label>
                                                <Input value={newForm.hodName} onChange={(e) => setNewForm({ ...newForm, hodName: e.target.value })} placeholder="Enter HOD Name" className="h-11 rounded-xl" />
                                            </>
                                        )}
                                    </div>
                                )}
                            </>
                        )}

                        <div className="space-y-2">
                            <Label>Upload Abstract (PDF/DOC) *</Label>
                            <label className="flex items-center justify-center gap-3 h-14 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50 cursor-pointer hover:border-primary/40 transition-colors">
                                <Upload className="w-4 h-4 text-slate-400" />
                                <span className="text-sm text-slate-500">{newFile ? newFile.name : "Click to upload"}</span>
                                <input type="file" accept=".pdf,.doc,.docx" onChange={handleFileChange} className="hidden" />
                            </label>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowNew(false)} className="rounded-xl">Cancel</Button>
                        <Button onClick={handleSubmit} disabled={submitting} className={`rounded-xl text-white ${themeColor}`}>
                            {submitting ? "Submitting..." : "Submit Abstract"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Detail Modal */}
            <Dialog open={!!viewingDetails} onOpenChange={() => setViewingDetails(null)}>
                <DialogContent className="max-w-md rounded-2xl">
                    <DialogHeader><DialogTitle>Submission Details</DialogTitle></DialogHeader>
                    {viewingDetails && (
                        <div className="space-y-4">
                            <div className="p-4 bg-slate-50 rounded-xl">
                                <h4 className="font-bold">{viewingDetails.title}</h4>
                                <p className="text-sm text-slate-500 mt-1">{viewingDetails.eventName}</p>
                            </div>
                            {viewingDetails.remarks && (
                                <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-sm text-red-900">
                                    <p className="font-bold">Feedback:</p>
                                    <p className="mt-1">{viewingDetails.remarks}</p>
                                </div>
                            )}
                            <div className="flex justify-between items-center text-xs text-slate-400 pt-2">
                                <span>Submitted: {new Date(viewingDetails.submittedAt).toLocaleDateString()}</span>
                                <span className="font-bold uppercase">{viewingDetails.status}</span>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Upload Success Dialog */}
            <Dialog open={showUploadSuccess} onOpenChange={setShowUploadSuccess}>
                <DialogContent className="rounded-3xl max-w-sm">
                    <div className="flex flex-col items-center p-6 text-center">
                        <CheckCircle2 className="w-16 h-16 text-green-500 mb-4" />
                        <h2 className="text-xl font-bold">Slides Uploaded!</h2>
                        <p className="text-slate-500 mt-2 text-sm">
                            Your presentation slides have been successfully uploaded and linked to your scheduled session.
                        </p>
                        <Button onClick={() => setShowUploadSuccess(false)} className={`mt-6 w-full h-11 rounded-xl font-bold text-white ${themeColor}`}>
                            Done
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
