import { useState, useEffect } from "react";
import { 
    getSessions, 
    getEventStudents, 
    getAbstracts, 
    updateSessionAttendance, 
    updateSessionStatus, 
    updateCurrentPresenter,
    getVolunteerAssignments,
    isNonCompetitiveSession,
    getEvaluations,
    updateSession,
    calculateSessionResults
} from "@/services/supabaseService";
import { Session, Student, Abstract, Evaluation } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Search, QrCode, Save, Users, CheckCircle2, Play, Square, Mic2, Radio, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useProgram } from "@/contexts/ProgramContext";
import { useAuth } from "@/contexts/AuthContext";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";

export default function AttendanceSheet() {
    const { toast } = useToast();
    const { currentProgram } = useProgram();
    const { user } = useAuth();
    const [sessions, setSessions] = useState<Session[]>([]);
    const [selectedSessionId, setSelectedSessionId] = useState<string>("");
    const [students, setStudents] = useState<Student[]>([]);
    const [attendance, setAttendance] = useState<Set<string>>(new Set());
    const [searchQuery, setSearchQuery] = useState("");
    const [isScanning, setIsScanning] = useState(false);
    const [currentPresenterId, setCurrentPresenterId] = useState<string | null>(null);
    const [status, setStatus] = useState<string>("scheduled");
    const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
    const [completedParticipants, setCompletedParticipants] = useState<string[]>([]);
    const [selectedSession, setSelectedSession] = useState<Session | null>(null);

    const loadSessions = async () => {
        let data = await getSessions(currentProgram);
        if (user?.role === 'volunteer') {
            const assignments = await getVolunteerAssignments();
            const assignedSessionIds = assignments
                .filter((a: any) => a.memberId === user.id)
                .map((a: any) => a.sessionId);
            data = data.filter(s => assignedSessionIds.includes(s.id));
        }
        setSessions(data);
    };

    useEffect(() => {
        loadSessions();
    }, [currentProgram, user]);

    useEffect(() => {
        const loadSessionData = async () => {
            if (selectedSessionId) {
                const [allSessions, allStudents, allAbstracts, allEvaluations] = await Promise.all([
                    getSessions(currentProgram),
                    getEventStudents(currentProgram),
                    getAbstracts(currentProgram),
                    getEvaluations(currentProgram)
                ]);

                const session = allSessions.find(s => s.id === selectedSessionId);
                setSelectedSession(session || null);
                if (session) {
                    const sessionAbstracts = allAbstracts.filter(a => session.abstractIds && session.abstractIds.includes(a.id));
                    const studentIds = sessionAbstracts.map(a => a.studentId);

                    const sessionStudents = allStudents
                        .filter((u: any) => studentIds.includes(u.id))
                        .map((u: any) => {
                            const studentAbstract = sessionAbstracts.find(a => a.studentId === u.id);
                            return {
                                ...u,
                                name: u.participantName || u.name || "Unknown Student",
                                presentationUrl: studentAbstract?.presentationUrl || null
                            };
                        }) as Student[];

                    setStudents(sessionStudents);

                    // Load existing attendance
                    if ((session as any)._attendedSubmissionIds) {
                        const attendedSubIds = (session as any)._attendedSubmissionIds as string[];
                        const attendedStudents = sessionAbstracts
                            .filter(a => attendedSubIds.includes(a.id))
                            .map(a => a.studentId);
                        setAttendance(new Set(attendedStudents));
                    } else if (session.attendanceRecords) {
                        setAttendance(new Set(session.attendanceRecords));
                    } else {
                        setAttendance(new Set());
                    }
                    setCurrentPresenterId(session.currentPresenterId || null);
                    setStatus(session.status);
                    setEvaluations(allEvaluations.filter(e => e.sessionId === selectedSessionId));
                    setCompletedParticipants((session as any).completed_participants || []);
                }
            } else {
                setSelectedSession(null);
                setStudents([]);
                setAttendance(new Set());
                setCurrentPresenterId(null);
                setStatus("scheduled");
                setEvaluations([]);
                setCompletedParticipants([]);
            }
        };
        loadSessionData();
    }, [selectedSessionId, currentProgram]);

    const isNonComp = selectedSession ? isNonCompetitiveSession(selectedSession) : false;

    const normalizedStatus = status ? status.toLowerCase() : "";
    const isNotStarted = normalizedStatus === "scheduled" || normalizedStatus === "session_not_started";
    const isStarted = normalizedStatus === "in_progress" || normalizedStatus === "session_started";
    const isLive = normalizedStatus === "session_live";
    const isCompleted = normalizedStatus === "completed" || normalizedStatus === "session_completed";

    // Helper to check if a student has completed their presentation
    const isStudentCompleted = (studentId: string) => {
        if (isNonComp) {
            return completedParticipants.includes(studentId);
        } else {
            // Competitive: must have at least one evaluation record (that is not marked absent)
            return evaluations.some(e => e.studentId === studentId && !e.isAbsent);
        }
    };

    // Strict finalization checks: Every student must be Completed or Absent (i.e. no present student is pending completion)
    const pendingStudents = students.filter(s => attendance.has(s.id) && !isStudentCompleted(s.id));
    const canFinalize = selectedSessionId && pendingStudents.length === 0 && (isLive || isStarted);

    const handleStartSession = async () => {
        if (!selectedSessionId) return;
        try {
            await updateSessionStatus(selectedSessionId, "SESSION_STARTED");
            setStatus("SESSION_STARTED");
            toast({ title: "Session Started", description: "Attendance can now be finalized before going live." });
            await loadSessions();
        } catch (error) {
            toast({ title: "Error", description: "Failed to start session.", variant: "destructive" });
        }
    };

    const handleGoLive = async () => {
        if (!selectedSessionId) return;
        try {
            await updateSessionStatus(selectedSessionId, "SESSION_LIVE");
            setStatus("SESSION_LIVE");
            toast({ title: "Session is LIVE", description: isNonComp ? "Mark participants completed when finished presenting." : "Judges can now evaluate active presenters." });
            await loadSessions();
        } catch (error) {
            toast({ title: "Error", description: "Failed to go live.", variant: "destructive" });
        }
    };

    const handleEndSession = async () => {
        if (!selectedSessionId) return;
        try {
            // Trigger results calculation & certificate generation
            await calculateSessionResults(selectedSessionId);
            setStatus("SESSION_COMPLETED");
            setCurrentPresenterId(null);
            toast({ title: "Session Finalized & Closed", description: "Lock complete. Certificates generated!" });
            await loadSessions();
        } catch (error: any) {
            toast({ title: "Error", description: error.message || "Failed to finalize session.", variant: "destructive" });
        }
    };

    const handleSetPresenter = async (studentId: string) => {
        if (!selectedSessionId) return;
        const newPresenterId = currentPresenterId === studentId ? null : studentId;
        try {
            await updateCurrentPresenter(selectedSessionId, newPresenterId);
            setCurrentPresenterId(newPresenterId);
            toast({ 
                title: newPresenterId ? "Presenter Updated" : "Presenter Cleared", 
                description: newPresenterId ? "Current speaker has been set." : "No one is presenting now." 
            });
        } catch (error) {
            toast({ title: "Error", description: "Failed to update presenter.", variant: "destructive" });
        }
    };

    const handleToggleAttendance = async (studentId: string) => {
        if (isCompleted) return;
        const newAttendance = new Set(attendance);
        if (newAttendance.has(studentId)) {
            newAttendance.delete(studentId);
            // If they are marked absent, remove from completed participants list
            if (completedParticipants.includes(studentId)) {
                setCompletedParticipants(completedParticipants.filter(id => id !== studentId));
            }
        } else {
            newAttendance.add(studentId);
        }
        setAttendance(newAttendance);

        if (selectedSessionId) {
            try {
                await updateSessionAttendance(selectedSessionId, Array.from(newAttendance));
            } catch (error) {
                console.error("Failed to auto-save attendance:", error);
            }
        }
    };

    const handleToggleCompletionNonComp = async (studentId: string) => {
        if (isCompleted || !isNonComp) return;
        let newCompleted = [...completedParticipants];
        if (newCompleted.includes(studentId)) {
            newCompleted = newCompleted.filter(id => id !== studentId);
        } else {
            newCompleted.push(studentId);
        }
        setCompletedParticipants(newCompleted);

        try {
            await updateSession(selectedSessionId, { completed_participants: newCompleted } as any);
            toast({ title: "Updated Status", description: "Participant presentation completion toggled." });
        } catch (err) {
            toast({ title: "Error", description: "Failed to update completion status.", variant: "destructive" });
        }
    };

    const handleSave = async () => {
        if (!selectedSessionId) return;

        try {
            await updateSessionAttendance(selectedSessionId, Array.from(attendance));
            toast({ title: "Saved", description: "Attendance records updated successfully." });
        } catch (error) {
            console.error(error);
            toast({ title: "Error", description: "Failed to update attendance.", variant: "destructive" });
        }
    };

    const handleBulkMark = async () => {
        if (isCompleted) return;
        const newAttendance = new Set(attendance);
        filteredStudents.forEach(s => newAttendance.add(s.id));
        setAttendance(newAttendance);

        if (selectedSessionId) {
            try {
                await updateSessionAttendance(selectedSessionId, Array.from(newAttendance));
                toast({ title: "Bulk Action", description: "Marked visible students as present." });
            } catch (error) {
                console.error("Failed to auto-save attendance:", error);
            }
        }
    };

    const toggleScanner = () => {
        setIsScanning(!isScanning);
        if (!isScanning) {
            toast({ title: "Camera Active", description: "Scanning for QR codes..." });
        }
    };

    const filteredStudents = students.filter(s =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.email.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-bold font-display">Attendance & Presentation Controls</h2>
                    <p className="text-muted-foreground">Mark student attendance and control live presenter flow.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant={isScanning ? "destructive" : "secondary"} onClick={toggleScanner} disabled={isCompleted}>
                        <QrCode className="w-4 h-4 mr-2" />
                        {isScanning ? "Stop Scan" : "Scan QR"}
                    </Button>
                </div>
            </div>

            {isScanning && (
                <Card className="bg-black/90 border-0">
                    <CardContent className="h-64 flex flex-col items-center justify-center text-white">
                        <QrCode className="w-16 h-16 mb-4 animate-pulse text-primary" />
                        <p>Point camera at student QR code</p>
                        <Button variant="link" className="text-white underline mt-2" onClick={() => setIsScanning(false)}>Cancel</Button>
                    </CardContent>
                </Card>
            )}

            <div className="flex gap-4 items-end flex-wrap">
                <div className="flex-1 min-w-[200px] space-y-2">
                    <label className="text-sm font-medium">Select Session</label>
                    <select
                        className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={selectedSessionId}
                        onChange={(e) => setSelectedSessionId(e.target.value)}
                    >
                        <option value="">-- Select a Session --</option>
                        {sessions.map(s => (
                            <option key={s.id} value={s.id}>{s.name} ({s.status})</option>
                        ))}
                    </select>
                </div>
                <div className="flex gap-2 items-center mb-[2px]">
                    {selectedSessionId && isNotStarted && (
                        <Button onClick={handleStartSession} className="bg-green-600 hover:bg-green-700 h-10 rounded-lg">
                            <Play className="w-4 h-4 mr-2" /> Start Session
                        </Button>
                    )}
                    {selectedSessionId && isStarted && (
                        <Button onClick={handleGoLive} className="bg-amber-600 hover:bg-amber-700 h-10 rounded-lg text-white">
                            <Radio className="w-4 h-4 mr-2 animate-pulse" /> Go Live
                        </Button>
                    )}
                    
                    {isCompleted && (
                        <Badge variant="secondary" className="h-10 px-4 text-sm font-bold bg-slate-100 text-slate-700 border-none rounded-lg">
                            Event Ended & Finalized
                        </Badge>
                    )}

                    {selectedSessionId && (
                        <Dialog>
                            <DialogTrigger asChild>
                                <Button variant="outline" className="h-10 rounded-lg bg-slate-50 border-slate-200 hover:bg-slate-100">
                                    <Users className="w-4 h-4 mr-2" /> Summary
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[425px] rounded-2xl">
                                <DialogHeader>
                                    <DialogTitle>Current Session Summary</DialogTitle>
                                </DialogHeader>
                                <div className="grid gap-4 py-4">
                                    <div className="flex justify-between items-center border-b pb-2">
                                        <span className="font-semibold text-slate-600">Total Delegates:</span>
                                        <span className="font-bold text-slate-900">{students.length}</span>
                                    </div>
                                    <div className="flex justify-between items-center border-b pb-2">
                                        <span className="font-semibold text-green-600">Present:</span>
                                        <span className="font-bold text-green-700">{attendance.size}</span>
                                    </div>
                                    <div className="flex justify-between items-center border-b pb-2">
                                        <span className="font-semibold text-red-600">Absent:</span>
                                        <span className="font-bold text-red-700">{students.length - attendance.size}</span>
                                    </div>
                                    {!isNonComp && (
                                        <div className="flex flex-col gap-1">
                                            <span className="font-semibold text-slate-600">Currently Presenting:</span>
                                            <span className="font-bold text-primary bg-primary/5 p-3 rounded-xl border border-primary/10">
                                                {currentPresenterId ? (
                                                    students.find(s => s.id === currentPresenterId)?.name || "Unknown Presenter"
                                                ) : (
                                                    "No active presenter"
                                                )}
                                            </span>
                                        </div>
                                    )}
                                    <div className="mt-4 max-h-[200px] overflow-y-auto space-y-2 border rounded-xl p-2 bg-slate-50">
                                        <p className="text-xs font-bold text-slate-500 tracking-wider uppercase px-1">Delegate List</p>
                                        {students.map(s => {
                                            const isPresent = attendance.has(s.id);
                                            const isPres = currentPresenterId === s.id;
                                            const completed = isStudentCompleted(s.id);
                                            return (
                                                <div key={s.id} className="flex justify-between items-center text-sm p-1.5 rounded-lg bg-white border">
                                                    <span className="font-medium truncate max-w-[200px]">{s.name}</span>
                                                    <div className="flex gap-1 items-center">
                                                        {isPres && <Badge className="bg-accent text-accent-foreground text-[10px]">Live</Badge>}
                                                        {completed && <Badge className="bg-blue-100 text-blue-800 text-[10px]">Completed</Badge>}
                                                        <Badge className={isPresent ? "bg-green-100 text-green-800 text-[10px]" : "bg-red-100 text-red-800 text-[10px]"}>
                                                            {isPresent ? "Present" : "Absent"}
                                                        </Badge>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </DialogContent>
                        </Dialog>
                    )}
                </div>
            </div>

            {selectedSessionId && (
                <div className="border rounded-lg p-4 space-y-4">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2 max-w-sm">
                            <Search className="w-4 h-4 text-muted-foreground" />
                            <Input
                                placeholder="Search students..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <div className="flex items-center gap-4">
                            <Badge variant="outline" className="h-9 px-3">
                                Present: {attendance.size} / {students.length}
                            </Badge>
                            <Button variant="outline" size="sm" onClick={handleBulkMark} disabled={isCompleted}>
                                Mark All Visible
                            </Button>
                        </div>
                    </div>

                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[50px]"></TableHead>
                                    <TableHead>Student Name</TableHead>
                                    <TableHead>Email</TableHead>
                                    <TableHead>Attendance</TableHead>
                                    {isNonComp ? (
                                        <TableHead>Presentation Completion</TableHead>
                                    ) : (
                                        <>
                                            <TableHead>Presenting</TableHead>
                                            <TableHead>Judging Status</TableHead>
                                        </>
                                    )}
                                    <TableHead>Slides Display</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredStudents.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={isNonComp ? 5 : 6} className="text-center h-24 text-muted-foreground">
                                            No students found.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredStudents.map(student => {
                                        const isPresent = attendance.has(student.id);
                                        const completed = isStudentCompleted(student.id);
                                        return (
                                            <TableRow key={student.id} className={isPresent ? "bg-green-50/50" : ""}>
                                                <TableCell>
                                                    <Checkbox
                                                        checked={isPresent}
                                                        disabled={isCompleted}
                                                        onCheckedChange={() => handleToggleAttendance(student.id)}
                                                    />
                                                </TableCell>
                                                <TableCell className="font-medium">{student.name}</TableCell>
                                                <TableCell className="text-sm">{student.email}</TableCell>
                                                <TableCell>
                                                    {isPresent ? (
                                                        <Badge className="bg-green-600">Present</Badge>
                                                    ) : (
                                                        <Badge variant="outline" className="text-red-500 border-red-200 bg-red-50/30">Absent</Badge>
                                                    )}
                                                </TableCell>
                                                
                                                {isNonComp ? (
                                                    <TableCell>
                                                        <Button
                                                            size="sm"
                                                            variant={completed ? "default" : "outline"}
                                                            className={completed ? "bg-blue-600 text-white" : "border-blue-600/30 text-blue-700 hover:bg-blue-50"}
                                                            disabled={isCompleted || !isPresent}
                                                            onClick={() => handleToggleCompletionNonComp(student.id)}
                                                        >
                                                            {completed ? "Completed ✅" : "Mark Completed"}
                                                        </Button>
                                                    </TableCell>
                                                ) : (
                                                    <>
                                                        <TableCell>
                                                            <Button 
                                                                size="sm" 
                                                                variant={currentPresenterId === student.id ? "default" : "outline"}
                                                                onClick={() => handleSetPresenter(student.id)}
                                                                disabled={isCompleted || (!isStarted && !isLive)}
                                                                className={currentPresenterId === student.id ? "bg-accent text-accent-foreground" : ""}
                                                            >
                                                                <Mic2 className={`w-4 h-4 ${currentPresenterId === student.id ? "mr-2" : ""}`} />
                                                                {currentPresenterId === student.id ? "Live" : "Set Presenter"}
                                                            </Button>
                                                        </TableCell>
                                                        <TableCell>
                                                            {completed ? (
                                                                <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-green-200">Evaluated</Badge>
                                                            ) : isPresent ? (
                                                                <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100 border-yellow-200">Pending Eval</Badge>
                                                            ) : (
                                                                <span className="text-xs text-slate-400 italic">N/A (Absent)</span>
                                                            )}
                                                        </TableCell>
                                                    </>
                                                )}

                                                <TableCell>
                                                    {(student as any).presentationUrl ? (
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="border-primary/20 text-primary hover:bg-primary/5 rounded-lg flex items-center gap-1.5 h-8 font-semibold"
                                                            onClick={() => window.open((student as any).presentationUrl, "_blank")}
                                                        >
                                                            <ExternalLink className="w-3.5 h-3.5" /> Project Slides
                                                        </Button>
                                                    ) : (
                                                        <span className="text-xs text-slate-400 italic font-medium">Not submitted</span>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            )}
        </div>
    );
}
