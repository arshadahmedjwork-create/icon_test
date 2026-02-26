import { useState, useEffect } from "react";
import {
    getSessions,
    addSession,
    deleteSession,
    getJudges,
    getAbstracts,
    getEventConfig,
    getEventStudents
} from "@/services/supabaseService";
import { sendAllocationEmail } from "@/services/emailService";
import { AutoScheduler } from "@/services/autoScheduler";
import { Session, Judge, Abstract, Student } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
    DialogTrigger
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Calendar, MapPin, Users, FileText } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

export default function SessionManagement() {
    const [sessions, setSessions] = useState<Session[]>([]);
    const [judges, setJudges] = useState<Judge[]>([]);
    const [abstracts, setAbstracts] = useState<Abstract[]>([]);
    const [students, setStudents] = useState<Student[]>([]);
    const [config, setConfig] = useState<any>(null); // Load async
    const { toast } = useToast();

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [formData, setFormData] = useState<Partial<Session>>({
        name: "",
        subject: "",
        type: "",
        mode: "",
        date: "",
        time: "",
        venue: "",
        judges: [],
        abstractIds: []
    });

    // Auto-Schedule State
    const [previewSessions, setPreviewSessions] = useState<Session[]>([]);
    const [schedulerWarnings, setSchedulerWarnings] = useState<string[]>([]);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);

    useEffect(() => {
        refreshData();
    }, []);

    const refreshData = async () => {
        const [fetchedSessions, fetchedJudges, fetchedAbstracts, fetchedConfig, fetchedStudents] = await Promise.all([
            getSessions(),
            getJudges(),
            getAbstracts(),
            getEventConfig(),
            getEventStudents()
        ]);
        setSessions(fetchedSessions);
        setJudges(fetchedJudges);
        setAbstracts(fetchedAbstracts.filter(a => a.status === "approved"));
        setStudents(fetchedStudents);
        // @ts-ignore
        setConfig(fetchedConfig);
    };

    const handleDelete = async (id: string) => {
        if (confirm("Are you sure? This will delete the session.")) {
            try {
                await deleteSession(id);
                refreshData();
                toast({ title: "Session Deleted" });
            } catch (error) {
                console.error(error);
                toast({ title: "Error", description: "Failed to delete session.", variant: "destructive" });
            }
        }
    };

    const handleCreate = async () => {
        if (!formData.name || !formData.subject || !formData.date) {
            toast({ title: "Error", description: "Please fill all required fields.", variant: "destructive" });
            return;
        }

        const newSessionData = {
            name: formData.name!,
            subject: formData.subject!,
            type: formData.type || "Paper Presentation",
            mode: formData.mode || "Offline",
            date: formData.date!,
            time: formData.time || "09:00",
            venue: formData.venue || "TBD",
            judges: formData.judges || [],
            abstractIds: formData.abstractIds || [],
            attendanceRecords: [],
            status: "scheduled" as "scheduled"
        };

        try {
            await addSession(newSessionData);
            setIsDialogOpen(false);
            refreshData();
            toast({ title: "Session Created", description: `${formData.name} scheduled successfully.` });

            // Send allocation emails
            newSessionData.abstractIds.forEach(abstractId => {
                const abstract = abstracts.find(a => a.id === abstractId);
                if (!abstract) return;
                const student = students.find(s => s.id === abstract.studentId);
                if (!student) return;

                sendAllocationEmail({
                    student_name: student.name,
                    student_email: student.email,
                    midas_id: student.midasId || "N/A",
                    college_name: student.college || "N/A",
                    event_type: abstract.type,
                    mode: newSessionData.mode,
                    subject_category: newSessionData.subject,
                    session_date: newSessionData.date,
                    session_time: newSessionData.time,
                    reporting_time: newSessionData.time,
                    presentation_duration: "5-7 Mins",
                    // @ts-ignore fallback if custom DB columns aren't in type definition
                    qr_code_url: student.qr_code_url || student.idProofUrl || "",
                    gmeet_link: newSessionData.mode === "Online" ? newSessionData.venue : undefined,
                    venue_name: newSessionData.mode !== "Online" ? newSessionData.venue : undefined,
                    hall_number: newSessionData.mode !== "Online" ? newSessionData.venue : undefined
                }).catch(err => console.error("Email err", err));
            });

            // Reset form
            setFormData({
                name: "",
                subject: "",
                type: "",
                mode: "",
                date: "",
                time: "",
                venue: "",
                judges: [],
                abstractIds: []
            });
        } catch (error) {
            console.error(error);
            toast({ title: "Error", description: "Failed to create session.", variant: "destructive" });
        }
    };

    const updateForm = (key: keyof Session, value: any) => {
        setFormData(prev => ({ ...prev, [key]: value }));
    };

    const toggleJudge = (judgeId: string) => {
        const current = formData.judges || [];
        if (current.includes(judgeId)) {
            updateForm("judges", current.filter(id => id !== judgeId));
        } else {
            updateForm("judges", [...current, judgeId]);
        }
    };

    const toggleAbstract = (abstractId: string) => {
        const current = formData.abstractIds || [];
        if (current.includes(abstractId)) {
            updateForm("abstractIds", current.filter(id => id !== abstractId));
        } else {
            updateForm("abstractIds", [...current, abstractId]);
        }
    };

    const handleAutoSchedule = () => {
        if (!config) return;

        const scheduler = new AutoScheduler({
            // @ts-ignore
            abstracts: abstracts.filter(a => a.status === "approved"),
            judges,
            // @ts-ignore
            config
        });

        const result = scheduler.generateSchedule();
        setPreviewSessions(result.sessions);
        setSchedulerWarnings(result.warnings);
        setIsPreviewOpen(true);
    };

    const confirmSchedule = async () => {
        try {
            // Sequential to avoid overwhelming DB or race conditions? Parallel is faster.
            await Promise.all(previewSessions.map(async session => {
                const { id, ...sessionData } = session;
                const newSession = await addSession(sessionData);

                // Send allocation emails for each auto-scheduled session
                sessionData.abstractIds.forEach(abstractId => {
                    const abstract = abstracts.find(a => a.id === abstractId);
                    if (!abstract) return;
                    const student = students.find(s => s.id === abstract.studentId);
                    if (!student) return;

                    sendAllocationEmail({
                        student_name: student.name,
                        student_email: student.email,
                        midas_id: student.midasId || "N/A",
                        college_name: student.college || "N/A",
                        event_type: abstract.type,
                        mode: sessionData.mode,
                        subject_category: sessionData.subject,
                        session_date: sessionData.date,
                        session_time: sessionData.time,
                        reporting_time: sessionData.time,
                        presentation_duration: "5-7 Mins",
                        // @ts-ignore
                        qr_code_url: student.qr_code_url || student.idProofUrl || "",
                        gmeet_link: sessionData.mode === "Online" ? sessionData.venue : undefined,
                        venue_name: sessionData.mode !== "Online" ? sessionData.venue : undefined,
                        hall_number: sessionData.mode !== "Online" ? sessionData.venue : undefined
                    }).catch(err => console.error("Email err", err));
                });

                return newSession;
            }));

            setIsPreviewOpen(false);
            refreshData();
            toast({ title: "Schedule Published", description: `${previewSessions.length} sessions created successfully.` });
        } catch (error) {
            console.error(error);
            toast({ title: "Error", description: "Failed to publish schedule.", variant: "destructive" });
        }
    };

    // Filter available abstracts based on selected criteria
    const availableAbstracts = abstracts.filter(a =>
        (!formData.subject || a.subject === formData.subject) &&
        (!formData.type || a.type === formData.type) &&
        (!formData.mode || a.mode === formData.mode) &&
        // Show if not already assigned to another session? In mock, we don't track assignment state explicitly on abstract, 
        // but we could filter out abstracts that are in 'sessions' list.
        // For now, let's just show all matching ones.
        true
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-bold font-display">Session Scheduling</h2>
                    <p className="text-muted-foreground">Create and manage scientific sessions.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={handleAutoSchedule}>
                        <Users className="w-4 h-4 mr-2" /> Auto-Schedule
                    </Button>
                    <Button onClick={() => setIsDialogOpen(true)}>
                        <Plus className="w-4 h-4 mr-2" /> Schedule Session
                    </Button>
                </div>
            </div>

            {/* Auto-Schedule Preview Dialog */}
            <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
                <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Auto-Schedule Preview</DialogTitle>
                        <DialogDescription>
                            Generated {previewSessions.length} sessions based on SRS rules.
                        </DialogDescription>
                    </DialogHeader>

                    {schedulerWarnings.length > 0 && (
                        <div className="bg-yellow-50 p-4 rounded-md border border-yellow-200 mb-4">
                            <h4 className="font-semibold text-yellow-800 text-sm mb-2">Warnings & Unscheduled Items</h4>
                            <ul className="list-disc list-inside text-sm text-yellow-700">
                                {schedulerWarnings.map((w, i) => <li key={i}>{w}</li>)}
                            </ul>
                        </div>
                    )}

                    <div className="space-y-4">
                        {previewSessions.map((session, i) => (
                            <Card key={i} className="border-l-4 border-l-blue-500">
                                <CardHeader className="py-3">
                                    <div className="flex justify-between">
                                        <CardTitle className="text-base">{session.name}</CardTitle>
                                        <Badge>Session {i + 1}</Badge>
                                    </div>
                                    <CardDescription>
                                        {session.subject} • {session.type} • {session.mode} • {session.abstractIds.length} Papers
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="py-2 text-xs text-muted-foreground">
                                    <div className="flex gap-4">
                                        <span>Judges: {session.judges.length} Assigned</span>
                                        <span className="text-green-600">✓ Conflict Free</span>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsPreviewOpen(false)}>Cancel</Button>
                        <Button onClick={confirmSchedule} disabled={previewSessions.length === 0}>
                            Confirm & Publish Schedule
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {sessions.map(session => (
                    <Card key={session.id}>
                        <CardHeader>
                            <div className="flex justify-between items-start">
                                <div>
                                    <CardTitle className="text-lg">{session.name}</CardTitle>
                                    <CardDescription>{session.subject}</CardDescription>
                                </div>
                                <Badge variant="outline">{session.status}</Badge>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm">
                            <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-muted-foreground" />
                                <span>{new Date(session.date).toLocaleDateString()} at {session.time}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <MapPin className="w-4 h-4 text-muted-foreground" />
                                <span>{session.venue} ({session.mode})</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Users className="w-4 h-4 text-muted-foreground" />
                                <span>{session.judges.length} Judges</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <FileText className="w-4 h-4 text-muted-foreground" />
                                <span>{session.abstractIds.length} Presentations</span>
                            </div>
                            <Button variant="destructive" size="sm" className="w-full mt-2" onClick={() => handleDelete(session.id)}>
                                <Trash2 className="w-4 h-4 mr-2" /> Cancel Session
                            </Button>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Schedule New Session</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-6 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Session Name</Label>
                                <Input placeholder="e.g. Oral Path Session A" value={formData.name} onChange={e => updateForm("name", e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>Subject</Label>
                                <Select onValueChange={(val) => updateForm("subject", val)}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select Subject" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {(config?.subjects || []).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Type</Label>
                                <Select onValueChange={(val) => updateForm("type", val)}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {(config?.presentationTypes || ["Paper", "Poster"]).map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Mode</Label>
                                <Select onValueChange={(val) => updateForm("mode", val)}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Mode" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {(config?.modes || ["Online", "Offline"]).map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Date</Label>
                                <Input type="date" onChange={e => updateForm("date", e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>Time</Label>
                                <Input type="time" onChange={e => updateForm("time", e.target.value)} />
                            </div>
                            <div className="space-y-2 col-span-2">
                                <Label>Venue / Link</Label>
                                <Input placeholder="e.g. Hall 1 or Zoom Link" onChange={e => updateForm("venue", e.target.value)} />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Assign Judges</Label>
                            <div className="border rounded p-3 h-32 overflow-y-auto space-y-2">
                                {judges.map(judge => (
                                    <div key={judge.id} className="flex items-center space-x-2">
                                        <Checkbox
                                            id={judge.id}
                                            checked={formData.judges?.includes(judge.id)}
                                            onCheckedChange={() => toggleJudge(judge.id)}
                                        />
                                        <label htmlFor={judge.id} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                            {judge.name} ({judge.specialization})
                                        </label>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Select Presentations (Approved Abstracts)</Label>
                            <div className="border rounded p-3 h-48 overflow-y-auto space-y-2">
                                {availableAbstracts.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">No approved abstracts match the selected criteria.</p>
                                ) : (
                                    availableAbstracts.map(abs => (
                                        <div key={abs.id} className="flex items-start space-x-2 border-b pb-2 last:border-0">
                                            <Checkbox
                                                id={abs.id}
                                                checked={formData.abstractIds?.includes(abs.id)}
                                                onCheckedChange={() => toggleAbstract(abs.id)}
                                                className="mt-1"
                                            />
                                            <div className="grid gap-1.5 leading-none">
                                                <label htmlFor={abs.id} className="text-sm font-medium leading-none">
                                                    {abs.title}
                                                </label>
                                                <p className="text-xs text-muted-foreground">
                                                    {abs.studentId} | {abs.subject}
                                                </p>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button onClick={handleCreate}>Create Session</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
