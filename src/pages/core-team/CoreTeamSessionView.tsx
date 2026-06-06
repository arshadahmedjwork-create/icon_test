import { useState, useEffect } from "react";
import { 
    getSessions, 
    calculateSessionResults, 
    getUsers, 
    getEventStudents, 
    getCertificates 
} from "@/services/supabaseService";
import { Session, User, Student, Certificate } from "@/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Trophy, CheckCircle2, Download, Award, Mail, Loader2 } from "lucide-react";
import { useProgram } from "@/contexts/ProgramContext";
import { generateSignedUrl } from "@/services/signedUrlHelper";
import { sendSingleCertificateEmail } from "@/services/certificateEmailWorker";

export default function CoreTeamSessionView() {
    const { toast } = useToast();
    const [sessions, setSessions] = useState<Session[]>([]);
    const [students, setStudents] = useState<Student[]>([]);
    const [certificates, setCertificates] = useState<Certificate[]>([]);
    const [view, setView] = useState<"ongoing" | "completed">("ongoing");
    const [emailing, setEmailing] = useState<string | null>(null);
    const { currentProgram } = useProgram();

    useEffect(() => {
        const loadData = async () => {
            const [fetchedSessions, fetchedStudents, fetchedCerts] = await Promise.all([
                getSessions(currentProgram),
                getEventStudents(currentProgram),
                getCertificates()
            ]);
            setSessions(fetchedSessions);
            setStudents(fetchedStudents);
            setCertificates(fetchedCerts);
        };
        loadData();
    }, [currentProgram]);

    const handleCalculateResults = async (sessionId: string) => {
        try {
            const results = await calculateSessionResults(sessionId);
            if (results) {
                toast({ title: "Results Calculated", description: "Winners identified and certificates generated." });
                const [updatedSessions, updatedCerts] = await Promise.all([
                    getSessions(currentProgram),
                    getCertificates()
                ]);
                setSessions(updatedSessions);
                setCertificates(updatedCerts);
            } else {
                toast({ title: "Error", description: "Could not calculate results. Check if evaluations exist.", variant: "destructive" });
            }
        } catch (error) {
            console.error(error);
            toast({ title: "Error", description: "Failed to calculate results.", variant: "destructive" });
        }
    };

    const getStudentName = (id: string) => {
        const student = students.find(s => s.id === id);
        return student?.participantName || student?.name || "Unknown";
    };

    const getCertificate = (studentId: string, sessionId: string) => {
        return certificates.find(c => c.userId === studentId && c.sessionId === sessionId && c.type === "winner");
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="font-display text-2xl font-bold mb-1">Session Management</h1>
                <p className="text-sm text-muted-foreground">
                    Monitor sessions, finalize results, and track certifications.
                </p>
            </div>

            <Tabs defaultValue="ongoing" onValueChange={(v) => setView(v as any)}>
                <TabsList>
                    <TabsTrigger value="ongoing">Ongoing / Pending</TabsTrigger>
                    <TabsTrigger value="completed">Completed & Winners</TabsTrigger>
                </TabsList>

                <TabsContent value="ongoing" className="space-y-4">
                    {sessions.filter(s => s.status?.toLowerCase() !== "completed" && s.status?.toLowerCase() !== "session_completed").map(session => {
                        const judgesDetails = (session as any)._sessionJudgesDetails || [];
                        const judge1 = judgesDetails[0];
                        const judge2 = judgesDetails[1];
                        
                        return (
                            <Card key={session.id}>
                                <CardHeader>
                                    <div className="flex justify-between">
                                        <div>
                                            <CardTitle>{session.name}</CardTitle>
                                            <CardDescription>{session.subject} - {session.type}</CardDescription>
                                        </div>
                                        <Badge variant="outline" className="capitalize">{session.status.replace("_", " ")}</Badge>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="bg-slate-50 p-4 rounded-xl space-y-2 border">
                                        <h4 className="font-bold text-xs uppercase tracking-wider text-slate-400">Judge Score Status</h4>
                                        <div className="grid grid-cols-2 gap-4 text-sm mt-1">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-3 h-3 rounded-full ${judge1?.judge_finalized ? 'bg-green-500' : 'bg-yellow-500'}`} />
                                                <span>Judge 1: {judge1?.judge_finalized ? '✅ Finalized' : '⏳ Pending'}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className={`w-3 h-3 rounded-full ${judge2?.judge_finalized ? 'bg-green-500' : 'bg-yellow-500'}`} />
                                                <span>Judge 2: {judge2?.judge_finalized ? '✅ Finalized' : '⏳ Pending'}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                                        <span>Session Status: {session.status === 'in_progress' ? 'Awaiting Final Judge ⏳' : 'Active'}</span>
                                        <span className="italic font-medium">Read-Only Oversight Portal</span>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                    {sessions.filter(s => s.status?.toLowerCase() !== "completed" && s.status?.toLowerCase() !== "session_completed").length === 0 && (
                        <div className="text-center py-8 text-muted-foreground">No ongoing sessions.</div>
                    )}
                </TabsContent>

                <TabsContent value="completed" className="space-y-4">
                    {sessions.filter(s => s.status?.toLowerCase() === "completed" || s.status?.toLowerCase() === "session_completed").map(session => (
                        <Card key={session.id}>
                            <CardHeader>
                                <div className="flex justify-between items-center">
                                    <div>
                                        <CardTitle>{session.name} - Winners</CardTitle>
                                        <CardDescription>{session.subject}</CardDescription>
                                    </div>
                                    <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-green-200">
                                        <CheckCircle2 className="w-3 h-3 mr-1" /> Completed
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[100px]">Rank</TableHead>
                                            <TableHead>Student</TableHead>
                                            <TableHead className="text-right">Score</TableHead>
                                            <TableHead className="text-right">Action</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {session.winners?.map((winner) => (
                                            <TableRow key={winner.studentId}>
                                                <TableCell className="font-medium">
                                                    {winner.rank === 1 ? "🥇 1st" : winner.rank === 2 ? "🥈 2nd" : "🥉 3rd"}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="font-medium">{getStudentName(winner.studentId)}</div>
                                                    <div className="text-[10px] text-muted-foreground">{winner.studentId}</div>
                                                </TableCell>
                                                <TableCell className="text-right font-bold text-lg">{winner.score}</TableCell>
                                                 <TableCell className="text-right">
                                                     <div className="flex justify-end gap-2">
                                                         {(() => {
                                                             const cert = getCertificate(winner.studentId, session.id);
                                                             if (!cert) {
                                                                 return <span className="text-xs text-muted-foreground italic">No Certificate</span>;
                                                             }
                                                             return (
                                                                 <>
                                                                     <Button 
                                                                         variant="outline" 
                                                                         size="sm"
                                                                         onClick={() => {
                                                                             const signedUrl = generateSignedUrl(cert.id);
                                                                             window.open(signedUrl, '_blank');
                                                                             toast({ title: "Downloading", description: "Official PDF certificate download started." });
                                                                         }}
                                                                     >
                                                                         <Download className="w-3 h-3 mr-1" /> Download
                                                                     </Button>
                                                                     <Button 
                                                                         variant="outline" 
                                                                         size="sm"
                                                                         className="border-teal-600/30 text-teal-700 hover:bg-teal-50"
                                                                         disabled={emailing === cert.id}
                                                                         onClick={async () => {
                                                                             setEmailing(cert.id);
                                                                             toast({ title: "Sending Email", description: "Attempting to email certificate..." });
                                                                             const res = await sendSingleCertificateEmail(cert.id, currentProgram);
                                                                             setEmailing(null);
                                                                             if (res.success) {
                                                                                 toast({ title: "Success", description: "Certificate emailed successfully!" });
                                                                                 // Refresh certificates
                                                                                 const [fetchedCerts] = await Promise.all([
                                                                                     getCertificates()
                                                                                 ]);
                                                                                 setCertificates(fetchedCerts);
                                                                             } else {
                                                                                 toast({ title: "Email Failed", description: res.error || "Failed to send email.", variant: "destructive" });
                                                                             }
                                                                         }}
                                                                     >
                                                                         {emailing === cert.id ? (
                                                                             <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                                                        ) : (
                                                                             <Mail className="w-3 h-3 mr-1" />
                                                                         )}
                                                                         {cert.emailSent ? "Resend" : "Send Email"}
                                                                     </Button>
                                                                 </>
                                                             );
                                                         })()}
                                                     </div>
                                                 </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                                <div className="mt-4 flex items-center text-xs text-muted-foreground">
                                    <Award className="w-3 h-3 mr-1" /> 
                                    Winner certificates are automatically generated upon finalization.
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                    {sessions.filter(s => s.status?.toLowerCase() === "completed" || s.status?.toLowerCase() === "session_completed").length === 0 && (
                        <div className="text-center py-12 bg-slate-50 border rounded-lg">
                            <Trophy className="w-12 h-12 mx-auto text-slate-200 mb-2" />
                            <p className="text-muted-foreground">No completed sessions found.</p>
                        </div>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
}
