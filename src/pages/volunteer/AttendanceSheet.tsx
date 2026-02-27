import { useState, useEffect } from "react";
import { getSessions, getEventStudents, updateSessionAttendance, getAbstracts } from "@/services/supabaseService";
import { Session, Student, Abstract } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Search, QrCode, Save, Users, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function AttendanceSheet() {
    const { toast } = useToast();
    const [sessions, setSessions] = useState<Session[]>([]);
    const [selectedSessionId, setSelectedSessionId] = useState<string>("");
    const [students, setStudents] = useState<Student[]>([]);
    const [attendance, setAttendance] = useState<Set<string>>(new Set());
    const [searchQuery, setSearchQuery] = useState("");
    const [isScanning, setIsScanning] = useState(false);

    useEffect(() => {
        const loadSessions = async () => {
            const data = await getSessions();
            setSessions(data);
        };
        loadSessions();
    }, []);

    useEffect(() => {
        const loadSessionData = async () => {
            if (selectedSessionId) {
                const [allSessions, allStudents, allAbstracts] = await Promise.all([
                    getSessions(),
                    getEventStudents(),
                    getAbstracts()
                ]);

                const session = allSessions.find(s => s.id === selectedSessionId);
                if (session) {
                    // Filter students in this session
                    const sessionAbstracts = allAbstracts.filter(a => session.abstractIds && session.abstractIds.includes(a.id));
                    const studentIds = sessionAbstracts.map(a => a.studentId);

                    // Extract matching students and normalize their names
                    const sessionStudents = allStudents
                        .filter((u: any) => studentIds.includes(u.id))
                        .map((u: any) => ({
                            ...u,
                            name: u.participantName || u.name || "Unknown Student"
                        })) as Student[];

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
                }
            }
        };
        loadSessionData();
    }, [selectedSessionId]);

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

            <div className="flex gap-4 items-end">
                <div className="flex-1 space-y-2">
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
                <Button onClick={handleSave} disabled={!selectedSessionId} className="mb-[2px]">
                    <Save className="w-4 h-4 mr-2" /> Save Attendance
                </Button>
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
                                    <TableHead>Status</TableHead>
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
                                                <TableCell>{student.email}</TableCell>
                                                <TableCell>
                                                    {isPresent ? (
                                                        <Badge className="bg-green-600 hover:bg-green-600">Present</Badge>
                                                    ) : (
                                                        <Badge variant="outline">Absent</Badge>
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
