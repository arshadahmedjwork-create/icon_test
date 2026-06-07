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
import { downloadCertificate } from "@/services/certificateEngine";
import { sendSingleCertificateEmail, triggerCertificateDistribution } from "@/services/certificateEmailWorker";

export default function CoreTeamSessionView() {
    const { toast } = useToast();
    const [sessions, setSessions] = useState<Session[]>([]);
    const [students, setStudents] = useState<Student[]>([]);
    const [certificates, setCertificates] = useState<Certificate[]>([]);
    const [view, setView] = useState<"ongoing" | "completed">("ongoing");
    const [emailing, setEmailing] = useState<string | null>(null);
    const [dispatchingAll, setDispatchingAll] = useState(false);
    const [dispatchingSession, setDispatchingSession] = useState<string | null>(null);
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

    const handleSendSessionCertificates = async (sessionId: string) => {
        setDispatchingSession(sessionId);
        toast({ title: "Session Dispatch Started", description: "Sending certificates to participants, winners, and judges of this session..." });

        try {
            const results = await triggerCertificateDistribution(sessionId, currentProgram);
            const failed = results.filter(r => !r.success);
            
            // Refresh certificates
            const fetchedCerts = await getCertificates();
            setCertificates(fetchedCerts);

            if (failed.length > 0) {
                toast({
                    title: "Dispatch Partial Success",
                    description: `Sent ${results.length - failed.length} certificates. ${failed.length} failed.`,
                    variant: "destructive"
                });
            } else {
                toast({
                    title: "Dispatch Complete",
                    description: `Sent all ${results.length} certificates successfully!`
                });
            }
        } catch (error) {
            console.error(error);
            toast({ title: "Dispatch Error", description: "Failed to dispatch certificates for this session.", variant: "destructive" });
        } finally {
            setDispatchingSession(null);
        }
    };

    const handleSendAllCertificates = async () => {
        const completedSessions = sessions.filter(s => s.status?.toLowerCase() === "completed" || s.status?.toLowerCase() === "session_completed");
        if (completedSessions.length === 0) {
            toast({ title: "No Sessions", description: "There are no completed sessions to dispatch certificates for." });
            return;
        }

        setDispatchingAll(true);
        toast({ title: "Bulk Dispatch Started", description: `Sending certificates for ${completedSessions.length} completed sessions...` });
        
        let successCount = 0;
        let failCount = 0;

        try {
            for (const session of completedSessions) {
                try {
                    const results = await triggerCertificateDistribution(session.id, currentProgram);
                    const failed = results.filter(r => !r.success);
                    if (failed.length > 0) {
                        failCount += failed.length;
                    }
                    successCount += (results.length - failed.length);
                } catch (err) {
                    console.error(`Error dispatching for session ${session.id}:`, err);
                    failCount++;
                }
            }

            // Refresh certificates
            const fetchedCerts = await getCertificates();
            setCertificates(fetchedCerts);

            toast({
                title: "Bulk Dispatch Complete",
                description: `Sent ${successCount} certificates successfully. ${failCount > 0 ? `${failCount} failed.` : ""}`,
                variant: failCount > 0 ? "destructive" : "default"
            });
        } catch (error) {
            console.error(error);
            toast({ title: "Bulk Dispatch Error", description: "Failed to dispatch all certificates.", variant: "destructive" });
        } finally {
            setDispatchingAll(false);
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
                    {sessions.filter(s => s.status?.toLowerCase() === "completed" || s.status?.toLowerCase() === "session_completed").length > 0 && (
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-50 p-4 rounded-xl border mb-4">
                            <div>
                                <h3 className="font-bold text-sm">Certificate Bulk Dispatch Control</h3>
                                <p className="text-xs text-muted-foreground">Send certificates to participants, winners, and judges of all completed sessions.</p>
                            </div>
                            <Button 
                                className="w-full md:w-auto bg-primary hover:bg-primary/90 text-white font-bold rounded-xl"
                                disabled={dispatchingAll}
                                onClick={handleSendAllCertificates}
                            >
                                {dispatchingAll ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Dispatching...
                                    </>
                                ) : (
                                    <>
                                        <Mail className="w-4 h-4 mr-2" /> Send All Certificates
                                    </>
                                )}
                            </Button>
                        </div>
                    )}

                    {sessions.filter(s => s.status?.toLowerCase() === "completed" || s.status?.toLowerCase() === "session_completed").map(session => (
                        <Card key={session.id}>
                            <CardHeader>
                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                    <div>
                                        <CardTitle className="text-base sm:text-lg">{session.name} - Winners</CardTitle>
                                        <CardDescription className="text-xs sm:text-sm">{session.subject}</CardDescription>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-start sm:justify-end">
                                        <Button 
                                            variant="outline" 
                                            size="sm"
                                            className="border-primary/30 text-primary hover:bg-primary/5 rounded-xl font-medium text-xs py-1 h-8"
                                            disabled={dispatchingSession === session.id}
                                            onClick={() => handleSendSessionCertificates(session.id)}
                                        >
                                            {dispatchingSession === session.id ? (
                                                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                                            ) : (
                                                <Mail className="w-3.5 h-3.5 mr-1.5" />
                                            )}
                                            Dispatch Session Certs
                                        </Button>
                                        <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-green-200 text-xs">
                                            <CheckCircle2 className="w-3 h-3 mr-1" /> Completed
                                        </Badge>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="overflow-x-auto w-full">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[100px] min-w-[70px]">Rank</TableHead>
                                            <TableHead className="min-w-[120px]">Student</TableHead>
                                            <TableHead className="text-right min-w-[70px]">Score</TableHead>
                                            <TableHead className="text-right min-w-[180px]">Action</TableHead>
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
                                                                         onClick={async () => {
                                                                             toast({ title: "Downloading", description: "Generating certificate PDF..." });
                                                                             try {
                                                                                 await downloadCertificate(cert.id);
                                                                                 toast({ title: "Success", description: "Certificate downloaded successfully." });
                                                                             } catch (error: any) {
                                                                                 console.error("Download failed:", error);
                                                                                 toast({ title: "Error", description: `Download failed: ${error.message || error}`, variant: "destructive" });
                                                                             }
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
