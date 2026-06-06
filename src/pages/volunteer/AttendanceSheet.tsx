import { useState, useEffect } from "react";
import { getSessions, getEventStudents, getAbstracts, updateSessionAttendance, updateSessionStatus, updateCurrentPresenter } from "@/services/supabaseService";
import { Session, Student, Abstract } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Search, QrCode, Save, Users, CheckCircle2, Play, Square, Mic2, Radio, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useProgram } from "@/contexts/ProgramContext";
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
    const [sessions, setSessions] = useState<Session[]>([]);
    const [selectedSessionId, setSelectedSessionId] = useState<string>("");
    const [students, setStudents] = useState<Student[]>([]);
    const [attendance, setAttendance] = useState<Set<string>>(new Set());
    const [searchQuery, setSearchQuery] = useState("");
    const [isScanning, setIsScanning] = useState(false);
    const [currentPresenterId, setCurrentPresenterId] = useState<string | null>(null);
    const [status, setStatus] = useState<string>("scheduled");

    useEffect(() => {
        const loadSessions = async () => {
            const data = await getSessions(currentProgram);
            setSessions(data);
        };
        loadSessions();
    }, [currentProgram]);

    useEffect(() => {
        const loadSessionData = async () => {
            if (selectedSessionId) {
                const [allSessions, allStudents, allAbstracts] = await Promise.all([
                    getSessions(currentProgram),
                    getEventStudents(currentProgram),
                    getAbstracts(currentProgram)
                ]);

                const session = allSessions.find(s => s.id === selectedSessionId);
                if (session) {
                    // Filter students in this session
                    const sessionAbstracts = allAbstracts.filter(a => session.abstractIds && session.abstractIds.includes(a.id));
                    const studentIds = sessionAbstracts.map(a => a.studentId);

                    // Extract matching students and normalize their names
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
                        // Fallback for legacy data
                        setAttendance(new Set(session.attendanceRecords));
                    } else {
                        setAttendance(new Set());
                    }
                    setCurrentPresenterId(session.currentPresenterId || null);
                    setStatus(session.status);
                }
            }
        };
        loadSessionData();
    }, [selectedSessionId, currentProgram]);

    const normalizedStatus = status ? status.toLowerCase() : "";
    const isNotStarted = normalizedStatus === "scheduled" || normalizedStatus === "session_not_started";
    const isStarted = normalizedStatus === "in_progress" || normalizedStatus === "session_started";
    const isLive = normalizedStatus === "session_live";
    const isCompleted = normalizedStatus === "completed" || normalizedStatus === "session_completed";

    const handleStartSession = async () => {
        if (!selectedSessionId) return;
        try {
            await updateSessionStatus(selectedSessionId, "SESSION_STARTED");
            setStatus("SESSION_STARTED");
            toast({ title: "Session Started", description: "Attendance can now be finalized before going live." });
            const data = await getSessions(currentProgram);
            setSessions(data);
        } catch (error) {
            toast({ title: "Error", description: "Failed to start session.", variant: "destructive" });
        }
    };

    const handleGoLive = async () => {
        if (!selectedSessionId) return;
        try {
            await updateSessionStatus(selectedSessionId, "SESSION_LIVE");
            setStatus("SESSION_LIVE");
            toast({ title: "Session is LIVE", description: "Judges can now evaluate active presenters." });
            const data = await getSessions(currentProgram);
            setSessions(data);
        } catch (error) {
            toast({ title: "Error", description: "Failed to go live.", variant: "destructive" });
        }
    };

    const handleEndSession = async () => {
        if (!selectedSessionId) return;
        try {
            await updateSessionStatus(selectedSessionId, "SESSION_COMPLETED");
            setStatus("SESSION_COMPLETED");
            setCurrentPresenterId(null);
            await updateCurrentPresenter(selectedSessionId, null);
            toast({ title: "Session Ended", description: "Session marked as completed." });
            const data = await getSessions(currentProgram);
            setSessions(data);
        } catch (error) {
            toast({ title: "Error", description: "Failed to end session.", variant: "destructive" });
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

    const handleToggleAttendance = (studentId: string) => {
        const newAttendance = new Set(attendance);
        if (newAttendance.has(studentId)) {
            newAttendance.delete(studentId);
        } else {
            newAttendance.add(studentId);
        }
        setAttendance(newAttendance);
    };

    const handleSave = async () => {
        if (!selectedSessionId) return;

        try {
            // Update session_participants table mapping
            await updateSessionAttendance(selectedSessionId, Array.from(attendance));

            toast({ title: "Saved", description: "Attendance records updated successfully." });
        } catch (error) {
            console.error(error);
            toast({ title: "Error", description: "Failed to update attendance.", variant: "destructive" });
        }
    };

    const handleBulkMark = () => {
        const newAttendance = new Set(attendance);
        filteredStudents.forEach(s => newAttendance.add(s.id));
        setAttendance(newAttendance);
        toast({ title: "Bulk Action", description: "Marked visible students as present." });
    };

    const toggleScanner = () => {
        setIsScanning(!isScanning);
        if (!isScanning) {
            // Mock scanning process
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
                    <h2 className="text-xl font-bold font-display">Attendance Management</h2>
                    <p className="text-muted-foreground">Mark student attendance for sessions.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant={isScanning ? "destructive" : "secondary"} onClick={toggleScanner}>
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
                    {isNotStarted && (
                        <Button onClick={handleStartSession} className="bg-green-600 hover:bg-green-700 h-10 rounded-lg">
                            <Play className="w-4 h-4 mr-2" /> Start Session
                        </Button>
                    )}
                    {isStarted && (
                        <Button onClick={handleGoLive} className="bg-amber-600 hover:bg-amber-700 h-10 rounded-lg text-white">
                            <Radio className="w-4 h-4 mr-2 animate-pulse" /> Go Live
                        </Button>
                    )}
                    {isLive && (
                        <Button onClick={handleEndSession} variant="destructive" className="h-10 rounded-lg">
                            <Square className="w-4 h-4 mr-2" /> Complete Session
                        </Button>
                    )}
                    {isCompleted ? (
                        <Badge variant="secondary" className="h-10 px-4 text-sm font-bold bg-slate-100 text-slate-700 border-none rounded-lg">
                            Event Ended
                        </Badge>
                    ) : (
                        <Button onClick={handleSave} disabled={!selectedSessionId} variant="outline" className="h-10 rounded-lg">
                            <Save className="w-4 h-4 mr-2" /> Save Attendance
                        </Button>
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
                                    <div className="mt-4 max-h-[200px] overflow-y-auto space-y-2 border rounded-xl p-2 bg-slate-50">
                                        <p className="text-xs font-bold text-slate-500 tracking-wider uppercase px-1">Delegate List</p>
                                        {students.map(s => {
                                            const isPresent = attendance.has(s.id);
                                            const isPres = currentPresenterId === s.id;
                                            return (
                                                <div key={s.id} className="flex justify-between items-center text-sm p-1.5 rounded-lg bg-white border">
                                                    <span className="font-medium truncate max-w-[200px]">{s.name}</span>
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
                            <Button variant="outline" size="sm" onClick={handleBulkMark}>
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
                                    <TableHead>Present</TableHead>
                                    <TableHead>Presenting</TableHead>
                                    <TableHead>Slides Display</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredStudents.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center h-24 text-muted-foreground">
                                            No students found.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredStudents.map(student => {
                                        const isPresent = attendance.has(student.id);
                                        return (
                                            <TableRow key={student.id} className={isPresent ? "bg-green-50/50" : ""}>
                                                <TableCell>
                                                    <Checkbox
                                                        checked={isPresent}
                                                        onCheckedChange={() => handleToggleAttendance(student.id)}
                                                    />
                                                </TableCell>
                                                <TableCell className="font-medium">{student.name}</TableCell>
                                                <TableCell className="text-sm">{student.email}</TableCell>
                                                <TableCell>
                                                    {isPresent ? (
                                                        <Badge className="bg-green-600">Yes</Badge>
                                                    ) : (
                                                        <Badge variant="outline">No</Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <Button 
                                                        size="sm" 
                                                        variant={currentPresenterId === student.id ? "default" : "outline"}
                                                        onClick={() => handleSetPresenter(student.id)}
                                                        disabled={!isStarted && !isLive}
                                                        className={currentPresenterId === student.id ? "bg-accent text-accent-foreground" : ""}
                                                    >
                                                        <Mic2 className={`w-4 h-4 ${currentPresenterId === student.id ? "mr-2" : ""}`} />
                                                        {currentPresenterId === student.id ? "Live" : ""}
                                                    </Button>
                                                </TableCell>
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
