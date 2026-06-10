import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
    getSessions,
    addSession,
    deleteSession,
    updateSession,
    getJudges,
    getAbstracts,
    getEvents,
    getEventStudents,
    getUsers,
    getVolunteerAssignments,
    assignVolunteerToSession,
    removeVolunteerFromSession
} from "@/services/supabaseService";
import { sendAllocationEmail } from "@/services/emailService";
import { AutoScheduler } from "@/services/autoScheduler";
import { Session, Judge, Abstract, Student, Event } from "@/types";
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
import { Plus, Trash2, Calendar, MapPin, Users, FileText, Trophy, Edit, Loader2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useProgram } from "@/contexts/ProgramContext";

export default function SessionManagement() {
    const navigate = useNavigate();
    const { currentProgram } = useProgram();
    const [sessions, setSessions] = useState<Session[]>([]);
    const [judges, setJudges] = useState<Judge[]>([]);
    const [abstracts, setAbstracts] = useState<Abstract[]>([]);
    const [students, setStudents] = useState<Student[]>([]);
    const [events, setEvents] = useState<Event[]>([]);
    const { toast } = useToast();

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingSession, setEditingSession] = useState<Session | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
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
    const [isAutoScheduleDialogOpen, setIsAutoScheduleDialogOpen] = useState(false);
    const [autoScheduleMode, setAutoScheduleMode] = useState<"Online" | "Offline">("Offline");
    const [customCapacity, setCustomCapacity] = useState<number>(4);
    const [previewSessions, setPreviewSessions] = useState<Session[]>([]);
    const [schedulerWarnings, setSchedulerWarnings] = useState<string[]>([]);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    
    // Criteria Editing State
    const [editingCriteriaSession, setEditingCriteriaSession] = useState<Session | null>(null);
    const [tempCriterias, setTempCriterias] = useState<any[]>([]);
    const [viewingStatusSession, setViewingStatusSession] = useState<Session | null>(null);

    // Volunteer Assignment State
    const [editingVolunteersSession, setEditingVolunteersSession] = useState<Session | null>(null);
    const [allVolunteers, setAllVolunteers] = useState<any[]>([]);
    const [assignedVolunteers, setAssignedVolunteers] = useState<string[]>([]);

    const handleOpenVolunteersEditor = async (session: Session) => {
        setEditingVolunteersSession(session);
        try {
            const [users, assignments] = await Promise.all([
                getUsers(currentProgram),
                getVolunteerAssignments(session.id)
            ]);
            const vols = users.filter((u: any) => u.role === 'volunteer');
            setAllVolunteers(vols);
            setAssignedVolunteers(assignments.map((a: any) => a.memberId));
        } catch (error) {
            console.error("Failed to load volunteers", error);
            toast({ title: "Error", description: "Failed to load volunteers.", variant: "destructive" });
        }
    };

    const handleToggleVolunteer = (volunteerId: string) => {
        if (assignedVolunteers.includes(volunteerId)) {
            setAssignedVolunteers(assignedVolunteers.filter(id => id !== volunteerId));
        } else {
            setAssignedVolunteers([...assignedVolunteers, volunteerId]);
        }
    };

    const handleSaveVolunteers = async () => {
        if (!editingVolunteersSession) return;
        try {
            const initialAssignments = await getVolunteerAssignments(editingVolunteersSession.id);
            const initialIds = initialAssignments.map((a: any) => a.memberId);

            const toAssign = assignedVolunteers.filter(id => !initialIds.includes(id));
            const toRemove = initialIds.filter(id => !assignedVolunteers.includes(id));

            await Promise.all([
                ...toAssign.map(id => assignVolunteerToSession(id, editingVolunteersSession.id)),
                ...toRemove.map(id => removeVolunteerFromSession(id, editingVolunteersSession.id))
            ]);

            toast({ title: "Volunteers Updated", description: "Volunteers successfully assigned." });
            setEditingVolunteersSession(null);
        } catch (error) {
            console.error("Failed to save volunteers", error);
            toast({ title: "Error", description: "Failed to update assignments.", variant: "destructive" });
        }
    };

    useEffect(() => {
        refreshData();
    }, [currentProgram]);

    const refreshData = async () => {
        const [fetchedSessions, fetchedJudges, fetchedAbstracts, fetchedEvents, fetchedStudents] = await Promise.all([
            getSessions(currentProgram),
            getJudges(currentProgram),
            getAbstracts(currentProgram),
            getEvents(currentProgram),
            getEventStudents(currentProgram)
        ]);
        
        setSessions(fetchedSessions);
        setJudges(fetchedJudges);
        setAbstracts(fetchedAbstracts.filter(a => a.status === "approved"));
        setStudents(fetchedStudents);
        setEvents(fetchedEvents);
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

    const handleSaveSession = async () => {
        if (!formData.name || !formData.subject || !formData.date) {
            toast({ title: "Error", description: "Please fill all required fields.", variant: "destructive" });
            return;
        }

        setIsSubmitting(true);
        const sessionPayload = {
            name: formData.name!,
            subject: formData.subject!,
            type: formData.type || "Paper Presentation",
            mode: formData.mode || "Offline",
            date: formData.date!,
            time: formData.time || "09:00",
            venue: formData.venue || "TBD",
            judges: formData.judges || [],
            abstractIds: formData.abstractIds || [],
            eventId: formData.eventId,
            program: currentProgram
        };

        try {
            if (editingSession) {
                await updateSession(editingSession.id, sessionPayload);
                toast({ title: "Session Updated", description: `${formData.name} updated successfully.` });
            } else {
                await addSession({
                    ...sessionPayload,
                    status: "scheduled" as "scheduled"
                });
                toast({ title: "Session Created", description: `${formData.name} scheduled successfully.` });
            }
            setIsDialogOpen(false);
            setEditingSession(null);
            refreshData();
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
            toast({ title: "Error", description: "Failed to save session.", variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEdit = (session: Session) => {
        setEditingSession(session);
        setFormData({
            name: session.name,
            subject: session.subject,
            type: session.type,
            mode: session.mode,
            date: session.date,
            time: session.time,
            venue: session.venue,
            judges: session.judges,
            abstractIds: session.abstractIds,
            eventId: session.eventId
        });
        setIsDialogOpen(true);
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

    const handleAutoScheduleClick = () => {
        if (events.length === 0) {
            toast({ title: "No Events", description: "Please create event configurations first.", variant: "destructive" });
            return;
        }
        setIsAutoScheduleDialogOpen(true);
    };

    const runAutoScheduler = () => {
        setIsAutoScheduleDialogOpen(false);
        const scheduler = new AutoScheduler({
            abstracts: abstracts.filter(a => a.status === "approved" || a.status === "completed").map(a => {
                const student = students.find(s => s.id === a.studentId);
                return {
                    ...a,
                    _studentName: student?.participantName || student?.name || 'Unknown',
                    college: student?.college || 'Unknown',
                    delegateType: student?.delegateType || 'UG'
                };
            }),
            judges,
            events,
            program: currentProgram,
            customCapacity,
            // @ts-ignore
            config: {
                subjects: Array.from(new Set(events.map(e => e.name))),
                presentationTypes: Array.from(new Set(events.map(e => e.type))),
                modes: Array.from(new Set(events.map(e => e.mode))),
                capacities: events.reduce((acc, e) => ({ ...acc, [`${e.type.toLowerCase().replace(" ", "")}${e.mode}`]: e.capacity }), {} as any),
                program: currentProgram
            }
        });

        const result = scheduler.generateSchedule(autoScheduleMode);
        setPreviewSessions(result.sessions);
        setSchedulerWarnings(result.warnings);
        setIsPreviewOpen(true);
    };

    const confirmSchedule = async () => {
        try {
            // Sequential to avoid overwhelming DB or race conditions? Parallel is faster.
            await Promise.all(previewSessions.map(async session => {
                const { id, _previewJudges, _previewStudentColleges, _previewStudentNames, ...sessionData } = session as any;
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

    const handleOpenCriteriaEditor = (session: Session) => {
        setEditingCriteriaSession(session);
        // Inherit from session, or if empty, try to inherit from event, or if empty, show standard
        let initialCriterias = session.criterias || [];
        if (initialCriterias.length === 0) {
            const event = events.find(e => e.id === session.eventId);
            initialCriterias = event?.criterias || [
                { id: crypto.randomUUID(), name: 'Scientific Content', maxScore: 10, weightage: 40 },
                { id: crypto.randomUUID(), name: 'Presentation / Delivery', maxScore: 10, weightage: 30 },
                { id: crypto.randomUUID(), name: 'Innovation & Impact', maxScore: 10, weightage: 30 }
            ];
        }
        setTempCriterias([...initialCriterias]);
    };

    const handleAddCriteria = () => {
        setTempCriterias([...tempCriterias, { id: crypto.randomUUID(), name: "", maxScore: 10, weightage: 0 }]);
    };

    const handleRemoveCriteria = (id: string) => {
        setTempCriterias(tempCriterias.filter(c => c.id !== id));
    };

    const updateCriteriaField = (id: string, field: string, value: any) => {
        setTempCriterias(tempCriterias.map(c => c.id === id ? { ...c, [field]: value } : c));
    };

    const handleSaveCriteria = async () => {
        if (!editingCriteriaSession) return;

        const totalWeightage = tempCriterias.reduce((sum, c) => sum + Number(c.weightage), 0);
        if (totalWeightage !== 100) {
            toast({ 
                title: "Invalid Weightage", 
                description: `Total weightage must be 100%. Current total: ${totalWeightage}%`, 
                variant: "destructive" 
            });
            return;
        }

        try {
            await updateSession(editingCriteriaSession.id, { 
                criterias: tempCriterias 
            });
            
            toast({ title: "Criteria Updated", description: "Judging rubric saved for this session." });
            setEditingCriteriaSession(null);
            refreshData();
        } catch (error) {
            console.error(error);
            toast({ title: "Error", description: "Failed to save criteria.", variant: "destructive" });
        }
    };

    // Filter available abstracts based on selected criteria and check for duplicate scheduling
    const availableAbstracts = abstracts.filter(a =>
        (!formData.subject || a.subject === formData.subject) &&
        (!formData.type || a.type === formData.type) &&
        (!formData.mode || a.mode === formData.mode) &&
        // Exclude if scheduled in a different session
        !sessions.some(s => s.id !== editingSession?.id && s.abstractIds?.includes(a.id))
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-xl font-bold font-display">Session Scheduling</h2>
                    <p className="text-muted-foreground text-sm">Create and manage scientific sessions.</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                    <Button variant="outline" onClick={handleAutoScheduleClick} className="w-full sm:w-auto">
                        <Users className="w-4 h-4 mr-2" /> Auto-Schedule
                    </Button>
                    <Button onClick={() => { setEditingSession(null); setFormData({ name: "", subject: "", type: "", mode: "", date: "", time: "", venue: "", judges: [], abstractIds: [] }); setIsDialogOpen(true); }} className="w-full sm:w-auto">
                        <Plus className="w-4 h-4 mr-2" /> Schedule Session
                    </Button>
                </div>
            </div>

            {/* Auto-Schedule Mode Selection Dialog */}
            <Dialog open={isAutoScheduleDialogOpen} onOpenChange={setIsAutoScheduleDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Auto-Schedule Sessions</DialogTitle>
                        <DialogDescription>
                            Select the mode (Online/Offline) to schedule approved abstracts.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="space-y-2">
                            <Label>Presentation Mode</Label>
                            <Select value={autoScheduleMode} onValueChange={(val: "Online" | "Offline") => setAutoScheduleMode(val)}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select Mode" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Online" disabled={localStorage.getItem("enable_online_scheduling") !== "true"}>
                                        Online {localStorage.getItem("enable_online_scheduling") !== "true" && "(Disabled by Admin)"}
                                    </SelectItem>
                                    <SelectItem value="Offline">Offline</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="customCapacity">Delegates / Students Per Session</Label>
                            <Input
                                id="customCapacity"
                                type="number"
                                min={1}
                                max={50}
                                value={customCapacity}
                                onChange={(e) => setCustomCapacity(Math.max(1, parseInt(e.target.value) || 1))}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAutoScheduleDialogOpen(false)}>Cancel</Button>
                        <Button onClick={runAutoScheduler}>Generate Schedule</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

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
                                        {session.subject} • {session.type} • {session.mode}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="py-2 text-sm text-foreground space-y-3">
                                    <div>
                                        <p className="font-semibold text-xs text-muted-foreground uppercase tracking-wider mb-1">Students ({session.abstractIds.length})</p>
                                        <div className="flex flex-wrap gap-1">
                                            {/* @ts-ignore preview field */}
                                            {session._previewStudentNames?.map((student: any, idx: number) => (
                                                <Badge key={idx} variant="secondary" className="text-[10px]">
                                                    {student.name} ({student.college})
                                                </Badge>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <p className="font-semibold text-xs text-muted-foreground uppercase tracking-wider mb-1">Assigned Judges</p>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                            {/* @ts-ignore preview field */}
                                            {session._previewJudges?.map((judge: Judge, idx: number) => (
                                                <div key={idx} className="bg-slate-50 border rounded-md p-2 text-xs">
                                                    <p className="font-medium text-slate-900">{judge.name}</p>
                                                    <p className="text-slate-500">{judge.type}</p>
                                                    {judge.college && <p className="text-slate-400 text-[10px] truncate">{judge.college}</p>}
                                                </div>
                                            ))}
                                        </div>
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
                            <div className="flex flex-col gap-2 mt-3">
                                <div className="flex gap-2">
                                    {session.status === "completed" ? (
                                        <Button 
                                            variant="default" 
                                            size="sm" 
                                            className="w-full bg-green-600 hover:bg-green-700" 
                                            onClick={() => navigate("/dashboard/core-team/results")}
                                        >
                                            <Trophy className="w-4 h-4 mr-2" /> View Result
                                        </Button>
                                    ) : (
                                        <>
                                            <Button variant="outline" size="sm" className="flex-1 text-[10px] px-1" onClick={() => handleEdit(session)}>
                                                <Edit className="w-3 h-3 mr-1 shrink-0" /> Edit
                                            </Button>
                                            <Button variant="outline" size="sm" className="flex-1 text-[10px] px-1" onClick={() => handleOpenCriteriaEditor(session)}>
                                                <FileText className="w-3 h-3 mr-1 shrink-0" /> Criteria
                                            </Button>
                                            <Button variant="outline" size="sm" className="flex-1 text-[10px] px-1" onClick={() => setViewingStatusSession(session)}>
                                                <Users className="w-3 h-3 mr-1 shrink-0" /> Status
                                            </Button>
                                            <Button variant="outline" size="sm" className="flex-1 text-[10px] px-1" onClick={() => handleOpenVolunteersEditor(session)}>
                                                <Users className="w-3 h-3 mr-1 shrink-0" /> Assign
                                            </Button>
                                        </>
                                    )}
                                </div>
                                <Button variant="destructive" size="sm" className="w-full" onClick={() => handleDelete(session.id)}>
                                    <Trash2 className="w-4 h-4 mr-2" /> {session.status === "completed" ? "Delete Record" : "Cancel"}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editingSession ? "Edit Session" : "Schedule New Session"}</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-6 py-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Session Name</Label>
                                <Input placeholder="e.g. Oral Path Session A" value={formData.name || ""} onChange={e => updateForm("name", e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>Subject</Label>
                                <Select value={formData.subject || ""} onValueChange={(val) => {
                                    updateForm("subject", val);
                                    // Also try to find the event configuration to auto-link
                                    const event = events.find(e => e.name === val && e.type === formData.type && e.mode === formData.mode);
                                    if (event) updateForm("eventId", event.id);
                                }}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select Subject" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {Array.from(new Set(events.map(e => e.name))).map((s: string) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Type</Label>
                                <Select value={formData.type || ""} onValueChange={(val) => {
                                    updateForm("type", val);
                                    const event = events.find(e => e.name === formData.subject && e.type === val && e.mode === formData.mode);
                                    if (event) updateForm("eventId", event.id);
                                }}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {Array.from(new Set(events.map(e => e.type))).map((t: string) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Mode</Label>
                                <Select value={formData.mode || ""} onValueChange={(val) => {
                                    updateForm("mode", val);
                                    const event = events.find(e => e.name === formData.subject && e.type === formData.type && e.mode === val);
                                    if (event) updateForm("eventId", event.id);
                                }}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Mode" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {Array.from(new Set(events.map(e => e.mode))).map((m: string) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Date</Label>
                                <Input type="date" value={formData.date || ""} onChange={e => updateForm("date", e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>Time</Label>
                                <Input type="time" value={formData.time || ""} onChange={e => updateForm("time", e.target.value)} />
                            </div>
                            <div className="space-y-2 col-span-1 sm:col-span-2">
                                <Label>Venue / Link</Label>
                                <Input placeholder="e.g. Hall 1 or Zoom Link" value={formData.venue || ""} onChange={e => updateForm("venue", e.target.value)} />
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
                        <Button onClick={handleSaveSession} disabled={isSubmitting}>
                            {isSubmitting ? (editingSession ? "Saving..." : "Creating...") : (editingSession ? "Save Changes" : "Create Session")}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Criteria Editor Dialog */}
            <Dialog open={!!editingCriteriaSession} onOpenChange={(val) => !val && setEditingCriteriaSession(null)}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Edit Judging Criteria</DialogTitle>
                        <DialogDescription>
                            Define the scoring rubric for "{editingCriteriaSession?.name}".
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="space-y-4 py-4">
                        <div className="grid grid-cols-12 gap-4 font-semibold text-sm text-muted-foreground px-2">
                            <div className="col-span-6">Criteria Name</div>
                            <div className="col-span-3">Max Score</div>
                            <div className="col-span-2">Weight %</div>
                            <div className="col-span-1"></div>
                        </div>
                        
                        <div className="space-y-3 max-h-[40vh] overflow-y-auto px-1">
                            {tempCriterias.map((c) => (
                                <div key={c.id} className="grid grid-cols-12 gap-4 items-center">
                                    <div className="col-span-6">
                                        <Input 
                                            placeholder="Criteria Name" 
                                            value={c.name} 
                                            onChange={(e) => updateCriteriaField(c.id, "name", e.target.value)} 
                                        />
                                    </div>
                                    <div className="col-span-3">
                                        <Input 
                                            type="number" 
                                            value={c.maxScore} 
                                            onChange={(e) => updateCriteriaField(c.id, "maxScore", Number(e.target.value))} 
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <Input 
                                            type="number" 
                                            value={c.weightage} 
                                            onChange={(e) => updateCriteriaField(c.id, "weightage", Number(e.target.value))} 
                                        />
                                    </div>
                                    <div className="col-span-1">
                                        <Button variant="ghost" size="icon" onClick={() => handleRemoveCriteria(c.id)}>
                                            <Trash2 className="w-4 h-4 text-destructive" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <Button variant="outline" className="w-full border-dashed" onClick={handleAddCriteria}>
                            <Plus className="w-4 h-4 mr-2" /> Add Criteria Item
                        </Button>

                        <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border">
                            <span className="font-bold">Total Weightage</span>
                            <Badge variant={tempCriterias.reduce((s, c) => s + Number(c.weightage), 0) === 100 ? "default" : "destructive"}>
                                {tempCriterias.reduce((s, c) => s + Number(c.weightage), 0)}%
                            </Badge>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditingCriteriaSession(null)}>Cancel</Button>
                        <Button onClick={handleSaveCriteria}>Save Criteria</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Session Status Detail Dialog */}
            <Dialog open={!!viewingStatusSession} onOpenChange={(val) => !val && setViewingStatusSession(null)}>
                <DialogContent className="max-w-md rounded-2xl">
                    <DialogHeader>
                        <DialogTitle>Session Real-time Status</DialogTitle>
                        <DialogDescription>
                            {viewingStatusSession?.name} • {viewingStatusSession?.subject}
                        </DialogDescription>
                    </DialogHeader>
                    {viewingStatusSession && (() => {
                        // Find session participants and map them
                        const sessionAbstracts = abstracts.filter(a => viewingStatusSession.abstractIds && viewingStatusSession.abstractIds.includes(a.id));
                        const attendedSubIds = (viewingStatusSession as any)._attendedSubmissionIds || [];
                        const presentAbstracts = sessionAbstracts.filter(a => attendedSubIds.includes(a.id));
                        const absentAbstracts = sessionAbstracts.filter(a => !attendedSubIds.includes(a.id));

                        return (
                            <div className="space-y-4 py-4">
                                <div className="grid grid-cols-3 gap-2 text-center">
                                    <div className="bg-slate-50 border rounded-xl p-3">
                                        <p className="text-2xl font-black text-slate-900">{sessionAbstracts.length}</p>
                                        <p className="text-xs font-semibold text-slate-500">Total</p>
                                    </div>
                                    <div className="bg-green-50 border border-green-100 rounded-xl p-3">
                                        <p className="text-2xl font-black text-green-700">{presentAbstracts.length}</p>
                                        <p className="text-xs font-semibold text-green-600">Present</p>
                                    </div>
                                    <div className="bg-red-50 border border-red-100 rounded-xl p-3">
                                        <p className="text-2xl font-black text-red-700">{absentAbstracts.length}</p>
                                        <p className="text-xs font-semibold text-red-600">Absent</p>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-1 bg-primary/5 p-3 rounded-xl border border-primary/10">
                                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Currently Presenting</span>
                                    <span className="font-bold text-primary flex items-center gap-2">
                                        {viewingStatusSession.currentPresenterId ? (
                                            <>
                                                <span className="w-2.5 h-2.5 bg-red-600 rounded-full animate-ping" />
                                                {students.find(s => s.id === viewingStatusSession.currentPresenterId)?.participantName || "Active Presenter"}
                                            </>
                                        ) : (
                                            "No active presenter"
                                        )}
                                    </span>
                                </div>

                                <div className="space-y-2 border rounded-xl p-3 bg-slate-50 max-h-[250px] overflow-y-auto">
                                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Participant List</p>
                                    {sessionAbstracts.map(a => {
                                        const isPresent = attendedSubIds.includes(a.id);
                                        const isPres = viewingStatusSession.currentPresenterId === a.studentId;
                                        const studentObj = students.find(s => s.id === a.studentId);
                                        return (
                                            <div key={a.id} className="flex justify-between items-center text-sm p-2 rounded-lg bg-white border">
                                                <div className="flex flex-col">
                                                    <span className="font-semibold text-slate-800">{studentObj?.participantName || studentObj?.name || "Unknown"}</span>
                                                    <span className="text-[10px] text-slate-400 truncate max-w-[200px]">{studentObj?.college}</span>
                                                </div>
                                                <div className="flex gap-1">
                                                    {isPres && <Badge className="bg-accent text-accent-foreground text-[10px]">Live</Badge>}
                                                    <Badge className={isPresent ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                                                        {isPresent ? "Present" : "Absent"}
                                                    </Badge>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })()}
                    <DialogFooter>
                        <Button onClick={() => setViewingStatusSession(null)}>Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Volunteer Assignment Dialog */}
            <Dialog open={!!editingVolunteersSession} onOpenChange={(val) => !val && setEditingVolunteersSession(null)}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Assign Volunteers</DialogTitle>
                        <DialogDescription>
                            Select volunteers to assign to "{editingVolunteersSession?.name}".
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="space-y-4 py-4">
                        <div className="border rounded p-3 h-64 overflow-y-auto space-y-2">
                            {allVolunteers.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-8">No volunteers found.</p>
                            ) : (
                                allVolunteers.map(volunteer => (
                                    <div key={volunteer.id} className="flex items-center space-x-2 border-b pb-2 last:border-0">
                                        <Checkbox
                                            id={`vol-${volunteer.id}`}
                                            checked={assignedVolunteers.includes(volunteer.id)}
                                            onCheckedChange={() => handleToggleVolunteer(volunteer.id)}
                                        />
                                        <label htmlFor={`vol-${volunteer.id}`} className="text-sm font-medium leading-none cursor-pointer">
                                            {volunteer.name} ({volunteer.email})
                                        </label>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditingVolunteersSession(null)}>Cancel</Button>
                        <Button onClick={handleSaveVolunteers}>Save Assignments</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
