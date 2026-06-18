import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import {
    getSessions,
    getAbstracts,
    getEvents,
    addEvaluation,
    getEvaluations,
    getJudges,
    getEventStudents,
    finalizeJudgeScores
} from "@/services/supabaseService";
import { Session, Abstract, Evaluation, Event, Student } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/lib/supabaseClient";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useProgram } from "@/contexts/ProgramContext";
import { ArrowLeft, CheckCircle, Clock, FileText, ExternalLink, Download, AlertTriangle, Users, Eye, Trophy } from "lucide-react";

export default function SessionEvaluation() {
    const { sessionId } = useParams();
    const { user } = useAuth();
    const { currentProgram } = useProgram();
    const { toast } = useToast();

    const [session, setSession] = useState<Session | null>(null);
    const [abstracts, setAbstracts] = useState<Abstract[]>([]);
    const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
    const [events, setEvents] = useState<Event[]>([]);
    const [judgeId, setJudgeId] = useState<string | null>(null);
    const [students, setStudents] = useState<Student[]>([]);
    const [finalized, setFinalized] = useState(false);

    // Evaluation Dialog State
    const [evaluating, setEvaluating] = useState<Abstract | null>(null);
    const [scores, setScores] = useState<Record<string, number>>({});
    const [feedback, setFeedback] = useState("");
    const [viewMode, setViewMode] = useState<"presentation" | "abstract">("presentation");
    const [viewerCollapsed, setViewerCollapsed] = useState(false);
    const [isStudentAbsent, setIsStudentAbsent] = useState(false);
    const [previewMode, setPreviewMode] = useState(false);

    const [isGuidelinesOpen, setIsGuidelinesOpen] = useState(false);

    useEffect(() => {
        const loadData = async () => {
            if (sessionId && user) {
                const [allSessions, allAbstracts, fetchedStudents, fetchedEvents, allJudges, allEvaluations] = await Promise.all([
                    getSessions(currentProgram),
                    getAbstracts(currentProgram),
                    getEventStudents(currentProgram),
                    getEvents(currentProgram),
                    getJudges(currentProgram),
                    getEvaluations(currentProgram)
                ]);

                const foundSession = allSessions.find(s => s.id === sessionId);
                setSession(foundSession || null);

                if (foundSession) {
                    const sessionAbstracts = allAbstracts.filter(a => foundSession.abstractIds && foundSession.abstractIds.includes(a.id));
                    setAbstracts(sessionAbstracts);
                    setStudents(fetchedStudents);
                    setEvents(fetchedEvents);

                    // Find Judge ID
                    const me = allJudges.find(j => j.email === user.email);
                    if (me) {
                        setJudgeId(me.id);
                        const sjDetail = (foundSession as any)._sessionJudgesDetails?.find((sj: any) => sj.judgeId === me.id);
                        if (sjDetail?.judge_finalized) {
                            setFinalized(true);
                        }
                    }

                    // Fetch evaluations
                    setEvaluations(allEvaluations.filter(e => e.sessionId === sessionId && e.judgeId === me?.id));
                }
            }
        };

        loadData();

        // Register Realtime Supabase Channel
        const channel = supabase
            .channel(`judge-session-realtime-${sessionId}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'sessions',
                filter: `id=eq.${sessionId}`
            }, () => {
                console.log("Realtime: Session status/presenter updated!");
                loadData();
            })
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'session_participants',
                filter: `sessionId=eq.${sessionId}`
            }, () => {
                console.log("Realtime: Participant attendance updated!");
                loadData();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [sessionId, user, currentProgram]);

    useEffect(() => {
        if (evaluating) {
            // Collapse viewer by default on screens smaller than lg (1024px)
            if (window.innerWidth < 1024) {
                setViewerCollapsed(true);
            } else {
                setViewerCollapsed(false);
            }
        }
    }, [evaluating]);

    const getCriterias = () => {
        // 1. Session-level criteria (Override)
        if (session?.criterias && session.criterias.length > 0) return session.criterias;

        // 2. Event-level criteria (From Master)
        const sessionEvent = events.find(e => e.id === session?.eventId);
        const eventCriterias = sessionEvent?.criterias || [];
        if (eventCriterias.length > 0) return eventCriterias;

        // 3. Standard fallback criteria if none are set or updated
        return [
            { id: 'std-content', name: 'Scientific Content', maxScore: 10, weightage: 40 },
            { id: 'std-delivery', name: 'Presentation / Delivery', maxScore: 10, weightage: 30 },
            { id: 'std-impact', name: 'Innovation & Impact', maxScore: 10, weightage: 30 }
        ];
    };

    const handleStartEvaluation = (abstract: Abstract) => {
        setPreviewMode(false);
        setEvaluating(abstract);
        const existing = evaluations.find(e => e.studentId === abstract.studentId);

        if (existing) {
            setScores(existing.scores);
            setFeedback(existing.feedback || "");
            setIsStudentAbsent(!!existing.isAbsent);
        } else {
            const initialScores: Record<string, number> = {};
            const activeCriterias = getCriterias();
            activeCriterias.forEach(c => initialScores[c.id] = 0);
            setScores(initialScores);
            setFeedback("");
            setIsStudentAbsent(false);
        }
    };

    const handlePreviewPresentation = (abstract: Abstract) => {
        setPreviewMode(true);
        setEvaluating(abstract);
        setViewMode("abstract");
        const existing = evaluations.find(e => e.studentId === abstract.studentId);

        if (existing) {
            setScores(existing.scores);
            setFeedback(existing.feedback || "");
            setIsStudentAbsent(!!existing.isAbsent);
        } else {
            const initialScores: Record<string, number> = {};
            const activeCriterias = getCriterias();
            activeCriterias.forEach(c => initialScores[c.id] = 0);
            setScores(initialScores);
            setFeedback("");
            setIsStudentAbsent(false);
        }
    };

    const calculateTotal = () => {
        const activeCriterias = getCriterias();
        return activeCriterias.reduce((total, criteria) => {
            const rawScore = scores[criteria.id] || 0;
            const weighted = (rawScore / criteria.maxScore) * criteria.weightage;
            return total + weighted;
        }, 0);
    };

    const handleScoreChange = (criteriaId: string, value: number) => {
        setScores(prev => ({ ...prev, [criteriaId]: value }));
    };

    const handleSubmitEvaluation = async () => {
        const activeCriterias = getCriterias();
        if (!evaluating || !judgeId) return;

        // Validation: All criteria must be scored > 0 if present
        if (!isStudentAbsent) {
            const missingCriteria = activeCriterias.some(c => (scores[c.id] || 0) === 0);
            if (missingCriteria) {
                toast({ title: "Incomplete Evaluation", description: "Please score all criteria before submitting.", variant: "destructive" });
                return;
            }
        }

        const total = isStudentAbsent ? 0 : calculateTotal();

        try {
            const payload = {
                sessionId: sessionId!,
                judgeId: judgeId,
                studentId: evaluating.studentId,
                scores: scores,
                totalScore: total,
                feedback: isStudentAbsent ? "Student was marked ABSENT." : feedback,
                program: currentProgram,
                isAbsent: isStudentAbsent
            };
            console.log("Submitting Evaluation:", payload);

            // Save Evaluation
            await addEvaluation(payload);

            toast({ title: isStudentAbsent ? "Marked Absent" : "Evaluation Saved", description: isStudentAbsent ? "Student is marked as absent." : `Score: ${total}` });
            
            // Re-fetch evaluations from server to ensure state sync
            const allEvaluations = await getEvaluations(currentProgram);
            setEvaluations(allEvaluations.filter(e => e.sessionId === sessionId && e.judgeId === judgeId));
            setEvaluating(null);
        } catch (error: any) {
            console.error("Evaluation Error Details:", {
                message: error.message,
                details: error.details,
                hint: error.hint,
                code: error.code
            });
            toast({ title: "Error", description: `Failed to save: ${error.message || "Unknown error"}`, variant: "destructive" });
        }
    };

    const handlePresentationComplete = async () => {
        if (!evaluating || !judgeId) return;

        const activeCriterias = getCriterias();
        const maxScores: Record<string, number> = {};
        activeCriterias.forEach(c => maxScores[c.id] = c.maxScore);

        // Assume total weightage is usually 100 or calculate it
        const total = activeCriterias.reduce((acc, c) => acc + c.weightage, 0); 

        try {
            const payload = {
                sessionId: sessionId!,
                judgeId: judgeId,
                studentId: evaluating.studentId,
                scores: maxScores,
                totalScore: total,
                feedback: "Presentation Complete (Academician/Clinician)",
                program: currentProgram,
                isAbsent: false
            };
            console.log("Submitting Academician/Clinician Evaluation:", payload);

            await addEvaluation(payload);

            toast({ title: "Presentation Complete", description: "Successfully marked as complete." });
            
            const allEvaluations = await getEvaluations(currentProgram);
            setEvaluations(allEvaluations.filter(e => e.sessionId === sessionId && e.judgeId === judgeId));
            setEvaluating(null);
        } catch (error: any) {
            console.error("Evaluation Error Details:", error);
            toast({ title: "Error", description: `Failed to save: ${error.message || "Unknown error"}`, variant: "destructive" });
        }
    };

    const handleFinalizeSession = async () => {
        if (!sessionId || !judgeId) return;
        try {
            const res = await finalizeJudgeScores(sessionId, judgeId, currentProgram);
            setFinalized(true);
            toast({ 
                title: "Scores Finalized", 
                description: res.closed ? "Session closed successfully and certificates generated!" : "Your finalization has been recorded. Awaiting other judges to finalize." 
            });
            setTimeout(() => {
                window.location.reload();
            }, 1500);
        } catch (error: any) {
            toast({ title: "Error Finalizing", description: error.message || "Failed to finalize.", variant: "destructive" });
        }
    };

    const getStudentName = (id: string) => {
        const student = students.find(u => u.id === id);
        return student?.participantName || student?.name || "Unknown";
    };

    const getStudentIdCode = (id: string) => {
        const student = students.find(u => u.id === id);
        return student?.midasId || student?.iconId || "No ID";
    };

    if (!session) return <div className="p-8 text-center text-muted-foreground">Loading session...</div>;

    const presentAbstracts = abstracts.filter(a => session?._attendedSubmissionIds?.includes(a.id));
    const allEvaluated = presentAbstracts.length > 0
        ? presentAbstracts.every(a => evaluations.some(e => e.studentId === a.studentId))
        : (abstracts.length > 0);

    const isSessionCompleted = session.status === 'SESSION_COMPLETED' || session.status.toLowerCase() === 'completed';

    const isAcademicianOrClinician = session.type?.toUpperCase().includes("ACADEMICIAN") || 
                                     session.type?.toUpperCase().includes("CLINICIAN") || 
                                     session.delegateTypeFilter?.toUpperCase().includes("ACADEMICIAN") || 
                                     session.delegateTypeFilter?.toUpperCase().includes("CLINICIAN");

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center flex-wrap gap-4">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" asChild>
                        <Link to="/dashboard/judge"><ArrowLeft className="w-4 h-4" /></Link>
                    </Button>
                    <div>
                        <h2 className="text-xl font-bold font-display">{session.name}</h2>
                        <p className="text-muted-foreground">{session.subject} • {session.type}</p>
                    </div>
                </div>

                <div className="flex gap-2">
                    {(finalized || isSessionCompleted) && (
                        <Button asChild variant="outline" className="rounded-xl border-blue-600/30 text-blue-700 hover:bg-blue-50">
                            <Link to={`/dashboard/judge/session/${sessionId}/scoreboard`}>
                                <Trophy className="w-4 h-4 mr-2" /> Scoreboard
                            </Link>
                        </Button>
                    )}
                    <Dialog>
                        <DialogTrigger asChild>
                            <Button variant="outline" className="rounded-xl bg-slate-50 border-slate-200 hover:bg-slate-100">
                                <Users className="w-4 h-4 mr-2" /> Session Summary
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[425px] rounded-2xl">
                            <DialogHeader>
                                <DialogTitle>Session Overview</DialogTitle>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="flex justify-between items-center border-b pb-2">
                                    <span className="font-semibold text-slate-600">Total Delegates:</span>
                                    <span className="font-bold text-slate-900">{abstracts.length}</span>
                                </div>
                                <div className="flex justify-between items-center border-b pb-2">
                                    <span className="font-semibold text-green-600">Present:</span>
                                    <span className="font-bold text-green-700">
                                        {abstracts.filter(a => session?._attendedSubmissionIds?.includes(a.id)).length}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center border-b pb-2">
                                    <span className="font-semibold text-red-600">Absent:</span>
                                    <span className="font-bold text-red-700">
                                        {abstracts.filter(a => !session?._attendedSubmissionIds?.includes(a.id)).length}
                                    </span>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <span className="font-semibold text-slate-600">Currently Presenting:</span>
                                    <span className="font-bold text-primary bg-primary/5 p-3 rounded-xl border border-primary/10">
                                        {session?.currentPresenterId ? (
                                            getStudentName(session.currentPresenterId)
                                        ) : (
                                            "No active presenter"
                                        )}
                                    </span>
                                </div>
                                <div className="mt-4 max-h-[200px] overflow-y-auto space-y-2 border rounded-xl p-2 bg-slate-50">
                                    <p className="text-xs font-bold text-slate-500 tracking-wider uppercase px-1">Delegate List</p>
                                    {abstracts.map(a => {
                                        const isPresent = session?._attendedSubmissionIds?.includes(a.id);
                                        const isPres = session?.currentPresenterId === a.studentId;
                                        return (
                                            <div key={a.id} className="flex justify-between items-center text-sm p-1.5 rounded-lg bg-white border">
                                                <span className="font-medium truncate max-w-[200px]">{getStudentName(a.studentId)}</span>
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
                </div>
            </div>

            {finalized ? (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-5 rounded-2xl flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-3">
                        <CheckCircle className="w-6 h-6 text-emerald-600 shrink-0" />
                        <div>
                            <p className="font-bold text-base">Scores Finalized Successfully ✅</p>
                            <p className="text-sm text-emerald-600">Your evaluations are now locked and submitted. Editing scores is disabled.</p>
                        </div>
                    </div>
                    <Badge className="bg-emerald-100 text-emerald-800 border-none px-3 py-1 text-xs font-bold">LOCKED & FINALIZED</Badge>
                </div>
            ) : (
                allEvaluated && (
                    <div className="bg-amber-50 border border-amber-200 text-amber-800 p-5 rounded-2xl flex items-center justify-between shadow-sm animate-pulse">
                        <div className="flex items-center gap-3">
                            <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0" />
                            <div>
                                <p className="font-bold text-base">Awaiting Score Finalization ⏳</p>
                                <p className="text-sm text-amber-600">All presentations scored! Finalize your scores to lock the evaluations and complete the session.</p>
                            </div>
                        </div>
                        <Button onClick={handleFinalizeSession} className="bg-amber-700 hover:bg-amber-800 text-white rounded-xl font-bold h-11 px-5">
                            Finalize Scores Now
                        </Button>
                    </div>
                )
            )}

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {abstracts.map((abstract, index) => {
                    const evalRecord = evaluations.find(e => e.studentId === abstract.studentId);
                    const isEvaluated = !!evalRecord;
                    const isAbsent = !session?._attendedSubmissionIds?.includes(abstract.id);
                    const score = evalRecord?.totalScore;

                    const isSessionLive = session?.status === "SESSION_LIVE" || session?.status === "session_live";
                    const isCurrentPresenter = session?.currentPresenterId === abstract.studentId;

                    // Evaluate permission rules:
                    // 1. Session must be LIVE
                    // 2. Participant must be PRESENT (not absent)
                    // 3. Participant must be the current live presenter
                    const canEvaluate = isSessionLive && !isAbsent && isCurrentPresenter;

                    return (
                        <Card key={abstract.id} className={isEvaluated ? "bg-muted/50 border-slate-100" : isAbsent ? "bg-red-50/10 border-red-100 opacity-60" : "border-slate-200"}>
                            <CardHeader className="pb-2">
                                <div className="flex justify-between">
                                    <Badge variant="outline"># {index + 1} | {abstract.id.slice(0, 8)}</Badge>
                                    {isAbsent ? (
                                        <Badge variant="secondary" className="bg-red-100 text-red-800 flex gap-1 items-center font-bold">
                                            Absent ❌
                                        </Badge>
                                    ) : isEvaluated ? (
                                        <Badge variant="secondary" className="bg-green-100 text-green-800 flex gap-1 items-center">
                                            <CheckCircle className="w-3 h-3" /> Score: {score?.toFixed(2)}
                                        </Badge>
                                    ) : isCurrentPresenter ? (
                                        <Badge variant="secondary" className="bg-accent text-accent-foreground animate-pulse font-bold flex gap-1 items-center">
                                            Live 🎙️
                                        </Badge>
                                    ) : (
                                        <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 flex gap-1 items-center">
                                            <Clock className="w-3 h-3" /> Pending
                                        </Badge>
                                    )}
                                </div>
                                <CardTitle className="text-lg mt-2 leading-tight">{abstract.title}</CardTitle>
                                <CardDescription>
                                    by {getStudentIdCode(abstract.studentId)}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Button
                                    className="w-full mt-4 rounded-xl font-semibold"
                                    onClick={() => handleStartEvaluation(abstract)}
                                    disabled={finalized || (isEvaluated ? false : !canEvaluate)}
                                    variant={isEvaluated ? "outline" : "default"}
                                >
                                    {finalized ? "Evaluation Locked" :
                                        isAbsent ? "Participant Absent ❌" :
                                            !isSessionLive ? "Waiting for session to go LIVE ⏳" :
                                                isEvaluated ? "Edit Evaluation" :
                                                    !isCurrentPresenter ? "Awaiting Live Turn 🎙️" : "Evaluate Presentation"}
                                </Button>
                                <Button
                                    variant="outline"
                                    className="w-full mt-2 rounded-xl font-semibold border-slate-200"
                                    onClick={() => handlePreviewPresentation(abstract)}
                                >
                                    <Eye className="w-4 h-4 mr-2" /> View Abstract Preview
                                </Button>
                                <Button
                                    variant="outline"
                                    className="w-full mt-2 rounded-xl font-semibold border-slate-200 text-slate-700 hover:bg-slate-50"
                                    onClick={() => setIsGuidelinesOpen(true)}
                                >
                                    <FileText className="w-4 h-4 mr-2" /> Judge Guidelines
                                </Button>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            <Dialog open={!!evaluating} onOpenChange={(val) => !val && setEvaluating(null)}>
                <DialogContent className="max-w-[95vw] max-h-[95vh] h-[95vh] p-0 overflow-hidden flex flex-col">
                    <DialogHeader className="p-4 sm:p-6 pb-2 border-b shrink-0">
                        <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                            <div className="space-y-1 pr-6">
                                <DialogTitle className="text-xl sm:text-2xl">{previewMode ? "Preview Abstract & Slides" : "Evaluate Presentation"}</DialogTitle>
                                <CardDescription className="text-sm sm:text-base">
                                    {evaluating?.title} • {getStudentIdCode(evaluating?.studentId || "")}
                                </CardDescription>
                            </div>
                            <div className="flex flex-wrap gap-2 w-full sm:w-auto justify-start sm:justify-end">
                                 {!previewMode && evaluating?.presentationUrl && (
                                     <Button variant={viewMode === "presentation" ? "default" : "outline"} size="sm" onClick={() => setViewMode("presentation")}>
                                         Presentation
                                     </Button>
                                 )}
                                 {evaluating?.fileUrl && (
                                     <Button variant={viewMode === "abstract" ? "default" : "outline"} size="sm" onClick={() => setViewMode("abstract")}>
                                         Abstract
                                     </Button>
                                 )}
                                  <Button variant="outline" size="sm" onClick={() => setViewerCollapsed(!viewerCollapsed)}>
                                      {viewerCollapsed ? "Expand Viewer" : "Collapse Viewer"}
                                  </Button>
                                  <Button variant="outline" size="sm" onClick={() => window.open(previewMode ? evaluating?.fileUrl : (viewMode === "presentation" ? evaluating?.presentationUrl || evaluating?.fileUrl : evaluating?.fileUrl), "_blank")}>
                                     <ExternalLink className="w-4 h-4 mr-2" /> Open
                                 </Button>
                            </div>
                        </div>
                    </DialogHeader>

                    <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
                        {/* Left Side: Presentation Viewer */}
                        {!viewerCollapsed && (
                            <div className="w-full h-[40vh] lg:h-full lg:flex-1 bg-muted/30 border-b lg:border-b-0 lg:border-r overflow-auto flex items-center justify-center p-4">
                                {((viewMode === "presentation" && (evaluating?.presentationUrl || evaluating?.fileUrl)) || (viewMode === "abstract" && evaluating?.fileUrl)) ? (
                                    <div className="w-full h-full flex flex-col gap-4">
                                        {(() => {
                                            const targetUrl = viewMode === "presentation" ? (evaluating?.presentationUrl || evaluating?.fileUrl) : evaluating?.fileUrl;
                                            const lowerUrl = targetUrl?.toLowerCase() || "";
                                            const isPdf = lowerUrl.endsWith(".pdf");
                                            const isOfficeDoc = lowerUrl.endsWith(".pptx") || lowerUrl.endsWith(".ppt") || lowerUrl.endsWith(".docx") || lowerUrl.endsWith(".doc");
                                            const viewerSrc = isPdf ? targetUrl : isOfficeDoc ? `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(targetUrl || "")}` : null;

                                            if (viewerSrc) {
                                                return (
                                                    <iframe
                                                        src={viewerSrc}
                                                        className="w-full h-full rounded-md border shadow-sm bg-white"
                                                        title="Presentation Viewer"
                                                    />
                                                );
                                            }

                                            return (
                                                <div className="flex flex-col items-center justify-center h-full text-center space-y-4 bg-white rounded-md border shadow-sm p-10">
                                                    <div className="w-20 h-20 rounded-full bg-orange-50 flex items-center justify-center">
                                                        <FileText className="w-10 h-10 text-orange-500" />
                                                    </div>
                                                    <div>
                                                        <h3 className="text-xl font-bold">Document Preview</h3>
                                                        <p className="text-muted-foreground max-w-md mx-auto mt-2">
                                                            Direct browser preview for this file type is limited. Please download or open it in a new window using the button below.
                                                         </p>
                                                    </div>
                                                    <Button size="lg" onClick={() => window.open(targetUrl, "_blank")}>
                                                        <Download className="w-4 h-4 mr-2" /> View / Download Document
                                                    </Button>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                ) : (
                                    <div className="text-center p-10">
                                        <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
                                        <h3 className="text-lg font-bold">No Presentation Available</h3>
                                        <p className="text-muted-foreground">The student hasn't uploaded their presentation yet.</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Right Side: Evaluation Form */}
                        <div className={cn("overflow-y-auto p-4 sm:p-6 bg-background transition-all duration-200", 
                            viewerCollapsed ? "flex-grow w-full h-full" : "w-full lg:w-[400px] lg:shrink-0 flex-1 lg:h-full"
                        )}>
                            {previewMode ? (
                                <div className="space-y-6">
                                    <h3 className="font-bold text-lg border-b pb-2">Delegate Information</h3>
                                    <div className="bg-amber-50 border border-amber-200 text-amber-900 p-4 rounded-xl space-y-2">
                                        <p className="font-bold text-sm flex items-center gap-1.5">
                                            <AlertTriangle className="w-4.5 h-4.5 text-amber-700" /> Early Preview Mode
                                        </p>
                                        <p className="text-xs text-amber-700 leading-relaxed font-medium">
                                            You are previewing this participant's abstract and presentation slides. Evaluation scoring will unlock once the session is LIVE, the delegate is marked PRESENT, and the volunteer sets them as the active presenter.
                                        </p>
                                    </div>
                                    
                                    <div className="space-y-1.5 p-4 rounded-xl border bg-slate-50/50">
                                        <Label className="font-bold text-xs uppercase tracking-wider text-slate-400">Presentation Title</Label>
                                        <p className="font-bold text-slate-800 text-sm leading-snug">{evaluating?.title}</p>
                                    </div>

                                    <div className="space-y-1.5 p-4 rounded-xl border bg-slate-50/50">
                                        <Label className="font-bold text-xs uppercase tracking-wider text-slate-400">Category & Mode</Label>
                                        <p className="font-bold text-slate-700 text-xs">{evaluating?.subject} • {evaluating?.type} ({evaluating?.mode})</p>
                                    </div>

                                    {evaluating?.presentationUrl ? (
                                        <div className="bg-green-50 border border-green-200 text-green-950 p-4 rounded-xl flex items-center gap-2.5">
                                            <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
                                            <div className="text-xs">
                                                <p className="font-bold text-green-900">Presentation slides uploaded</p>
                                                <p className="text-green-700 mt-0.5">Use the open/download button in the viewer to access them.</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="bg-slate-100 border border-slate-200 text-slate-700 p-4 rounded-xl flex items-center gap-2.5">
                                            <Clock className="w-5 h-5 text-slate-500 shrink-0" />
                                            <div className="text-xs">
                                                <p className="font-bold text-slate-800">Slides not yet uploaded</p>
                                                <p className="text-slate-500 mt-0.5">The participant has not uploaded their presentation slides yet.</p>
                                            </div>
                                        </div>
                                    )}

                                    <div className="pt-4 border-t">
                                        <Button variant="outline" className="w-full h-11 rounded-xl font-semibold" onClick={() => setEvaluating(null)}>
                                            Close Preview
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    <h3 className="font-bold text-lg border-b pb-2">Scoring Criteria</h3>
                                    
                                    {isAcademicianOrClinician ? (
                                        <div className="space-y-4 pt-4">
                                            <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg text-blue-800">
                                                <p className="font-semibold text-base mb-1">Academician/Clinician Presentation</p>
                                                <p className="text-sm">For this presentation type, rubric scoring is not required. Simply mark the presentation as complete once done.</p>
                                            </div>
                                            
                                            <div className="flex gap-3 mt-8">
                                                <Button variant="outline" className="flex-1" onClick={() => setEvaluating(null)}>Cancel</Button>
                                                {finalized ? (
                                                    <Button className="flex-[2] bg-slate-400 cursor-not-allowed text-white font-bold" disabled>Evaluation Locked</Button>
                                                ) : (
                                                    <Button className="flex-[2] bg-blue-600 hover:bg-blue-700 text-white" onClick={handlePresentationComplete}>
                                                        Mark Presentation Complete
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            {!isStudentAbsent && getCriterias().map(criteria => (
                                                <div key={criteria.id} className="space-y-3 p-4 rounded-lg border bg-muted/20">
                                                    <div className="flex justify-between">
                                                            <Label className="font-semibold text-sm">{criteria.name}</Label>
                                                            <span className="font-bold text-primary">{scores[criteria.id] || 0} / {criteria.maxScore}</span>
                                                        </div>
                                                        <Slider
                                                            value={[scores[criteria.id] || 0]}
                                                            max={criteria.maxScore}
                                                            step={1}
                                                            disabled={finalized}
                                                            onValueChange={(val) => handleScoreChange(criteria.id, val[0])}
                                                            className="py-2"
                                                        />
                                                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Weightage: {criteria.weightage}%</p>
                                                    </div>
                                                ))}

                                            <div className="pt-4 border-t sticky bottom-0 bg-background pb-2">
                                                <div className="flex justify-between items-center mb-4 p-3 bg-primary/5 rounded-lg border border-primary/10">
                                                    <span className="text-base font-bold">Total Weighted Score</span>
                                                    <span className="text-2xl font-black text-primary">
                                                        {isStudentAbsent ? "0.00% (Absent)" : `${calculateTotal().toFixed(2)}%`}
                                                    </span>
                                                </div>

                                                <div className="space-y-2 mb-6">
                                                    <Label className="text-sm font-semibold">Feedback (Optional)</Label>
                                                    <Textarea
                                                        placeholder={finalized ? "No feedback submitted." : isStudentAbsent ? "Absent student - feedback disabled." : "Constructive feedback..."}
                                                        value={isStudentAbsent ? "" : feedback}
                                                        disabled={finalized || isStudentAbsent}
                                                        onChange={(e) => setFeedback(e.target.value)}
                                                        className="min-h-[100px] resize-none"
                                                    />
                                                </div>

                                                <div className="flex gap-3">
                                                    <Button variant="outline" className="flex-1" onClick={() => setEvaluating(null)}>Cancel</Button>
                                                    {finalized ? (
                                                        <Button className="flex-[2] bg-slate-400 cursor-not-allowed text-white font-bold" disabled>Evaluation Locked</Button>
                                                    ) : (
                                                        <Button className="flex-[2]" onClick={handleSubmitEvaluation}>
                                                            {isStudentAbsent ? "Submit as Absent" : "Submit Evaluation"}
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={isGuidelinesOpen} onOpenChange={setIsGuidelinesOpen}>
                <DialogContent className="sm:max-w-[500px] rounded-2xl">
                    <DialogHeader>
                        <DialogTitle>Judge Guidelines</DialogTitle>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="whitespace-pre-line text-sm text-slate-700 bg-slate-50 p-4 rounded-xl border border-slate-100 max-h-[350px] overflow-y-auto">
                            {events.find(e => e.id === session?.eventId)?.judgeInstructions || "No instructions provided for this event."}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button onClick={() => setIsGuidelinesOpen(false)} className="rounded-xl">Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
