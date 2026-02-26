import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import {
    getSessions,
    getAbstracts,
    getEventConfig,
    addEvaluation,
    getEvaluations,
    getJudges,
    getUsers
} from "@/services/supabaseService";
import { Session, Abstract, Evaluation, EventConfig, User } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, CheckCircle, Clock, FileText } from "lucide-react";

export default function SessionEvaluation() {
    const { sessionId } = useParams();
    const { user } = useAuth();
    const { toast } = useToast();

    const [session, setSession] = useState<Session | null>(null);
    const [abstracts, setAbstracts] = useState<Abstract[]>([]);
    const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
    const [eventConfig, setEventConfig] = useState<EventConfig | null>(null);
    const [judgeId, setJudgeId] = useState<string | null>(null);
    const [users, setUsers] = useState<User[]>([]);

    // Evaluation Dialog State
    const [evaluating, setEvaluating] = useState<Abstract | null>(null);
    const [scores, setScores] = useState<Record<string, number>>({});
    const [feedback, setFeedback] = useState("");

    useEffect(() => {
        const loadData = async () => {
            if (sessionId && user) {
                const [allSessions, allAbstracts, fetchedUsers, fetchedConfig, allJudges, allEvaluations] = await Promise.all([
                    getSessions(),
                    getAbstracts(),
                    getUsers(),
                    getEventConfig(),
                    getJudges(),
                    getEvaluations()
                ]);

                const foundSession = allSessions.find(s => s.id === sessionId);
                setSession(foundSession || null);

                if (foundSession) {
                    const sessionAbstracts = allAbstracts.filter(a => foundSession.abstractIds && foundSession.abstractIds.includes(a.id));
                    setAbstracts(sessionAbstracts);
                    setUsers(fetchedUsers);
                    setEventConfig(fetchedConfig);

                    // Find Judge ID
                    const me = allJudges.find(j => j.email === user.email);
                    if (me) setJudgeId(me.id);

                    // Fetch evaluations
                    setEvaluations(allEvaluations.filter(e => e.sessionId === sessionId && e.judgeId === me?.id));
                }
            }
        };
        loadData();
    }, [sessionId, user]);

    const handleStartEvaluation = (abstract: Abstract) => {
        setEvaluating(abstract);
        // Init scores - check if already evaluated? This dialog assumes new or overwrite. 
        // If overwrite, prefill.
        const existing = evaluations.find(e => e.studentId === abstract.studentId); // Wait, Evaluation stores studentId? Or AbstractId?
        // Evaluation interface in types.ts: studentId. 
        // In session, we have abstractIds.
        // Abstract stores studentId.
        // So we can link Abstract -> StudentId -> Evaluation.
        // BUT a student might have multiple evaluations if multiple sessions? No, 1 abstract per session usu.
        // Ideally Evaluation should store abstractId to be precise.
        // The current Type definition for Evaluation has studentId but NOT abstractId.
        // This is a flaw if student submits 2 abstracts.
        // Assume 1 for now.

        if (existing) {
            setScores(existing.scores);
            setFeedback(existing.feedback || "");
        } else {
            const initialScores: Record<string, number> = {};
            eventConfig?.criterias.forEach(c => initialScores[c.id] = 0);
            setScores(initialScores);
            setFeedback("");
        }
    };

    const calculateTotal = () => {
        if (!eventConfig) return 0;
        return eventConfig.criterias.reduce((total, criteria) => {
            const rawScore = scores[criteria.id] || 0;
            // Weighted calculation: (Score / MaxScore) * Weightage
            const weighted = (rawScore / criteria.maxScore) * criteria.weightage;
            return total + weighted;
        }, 0);
    };

    const handleScoreChange = (criteriaId: string, value: number) => {
        setScores(prev => ({ ...prev, [criteriaId]: value }));
    };

    const handleSubmitEvaluation = async () => {
        if (!evaluating || !judgeId || !eventConfig) return;

        // Validation: All criteria must be scored > 0
        const missingCriteria = eventConfig.criterias.some(c => (scores[c.id] || 0) === 0);
        if (missingCriteria) {
            toast({ title: "Incomplete Evaluation", description: "Please score all criteria before submitting.", variant: "destructive" });
            return;
        }

        const total = calculateTotal();

        try {
            // Save Evaluation
            await addEvaluation({
                sessionId: sessionId!,
                judgeId: judgeId,
                studentId: evaluating.studentId, // We use studentId based on Type def
                scores: scores,
                totalScore: total,
                feedback: feedback
            });

            toast({ title: "Evaluation Saved", description: `Score: ${total}` });

            // Refresh local state without full reload
            setEvaluations(prev => [
                ...prev.filter(e => e.studentId !== evaluating.studentId),
                {
                    id: "temp-id", // Mock ID, real is generated in DB
                    sessionId: sessionId!,
                    judgeId: judgeId,
                    studentId: evaluating.studentId,
                    scores: scores,
                    totalScore: total,
                    feedback,
                    submittedAt: new Date().toISOString()
                }
            ]);
            setEvaluating(null);
        } catch (error) {
            console.error(error);
            toast({ title: "Error", description: "Failed to save evaluation.", variant: "destructive" });
        }
    };

    const getStudentName = (id: string) => users.find(u => u.id === id)?.name || "Unknown";

    if (!session) return <div>Loading...</div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" asChild>
                    <Link to="/dashboard/judge"><ArrowLeft className="w-4 h-4" /></Link>
                </Button>
                <div>
                    <h2 className="text-xl font-bold font-display">{session.name}</h2>
                    <p className="text-muted-foreground">{session.subject} • {session.type}</p>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {abstracts.map((abstract, index) => {
                    const isEvaluated = evaluations.some(e => e.studentId === abstract.studentId);
                    const score = evaluations.find(e => e.studentId === abstract.studentId)?.totalScore;

                    const prevAbstract = index > 0 ? abstracts[index - 1] : null;
                    const isPrevEvaluated = prevAbstract ? evaluations.some(e => e.studentId === prevAbstract.studentId) : true;
                    const allEvaluated = evaluations.length === abstracts.length;

                    const canEvaluateNew = !isEvaluated && isPrevEvaluated;
                    const canEdit = isEvaluated && allEvaluated;
                    const isLocked = isEvaluated && !allEvaluated;
                    const isWaiting = !isEvaluated && !isPrevEvaluated;

                    return (
                        <Card key={abstract.id} className={isEvaluated ? "bg-muted/50" : ""}>
                            <CardHeader className="pb-2">
                                <div className="flex justify-between">
                                    <Badge variant="outline"># {index + 1} | {abstract.id.slice(0, 8)}</Badge>
                                    {isEvaluated ? (
                                        <Badge variant="secondary" className="bg-green-100 text-green-800 flex gap-1 items-center">
                                            <CheckCircle className="w-3 h-3" /> Score: {score?.toFixed(2)}
                                        </Badge>
                                    ) : (
                                        <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 flex gap-1 items-center">
                                            <Clock className="w-3 h-3" /> Pending
                                        </Badge>
                                    )}
                                </div>
                                <CardTitle className="text-lg mt-2 leading-tight">{abstract.title}</CardTitle>
                                <CardDescription>
                                    by {getStudentName(abstract.studentId)}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Button
                                    className="w-full mt-4"
                                    onClick={() => handleStartEvaluation(abstract)}
                                    disabled={isLocked || isWaiting}
                                    variant={isEvaluated ? "outline" : "default"}
                                >
                                    {canEdit ? "Edit Evaluation" :
                                        isLocked ? "Evaluated (Locked)" :
                                            isWaiting ? "Awaiting Previous" :
                                                "Evaluate Presentation"}
                                </Button>
                                {abstract.fileUrl && (
                                    <Button variant="link" size="sm" className="w-full h-auto mt-2 text-xs text-muted-foreground" onClick={() => window.open(abstract.fileUrl, "_blank")}>
                                        <FileText className="w-3 h-3 mr-1" /> View Abstract PDF
                                    </Button>
                                )}
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            <Dialog open={!!evaluating} onOpenChange={(val) => !val && setEvaluating(null)}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Evaluate Presentation</DialogTitle>
                        <CardDescription>
                            {evaluating?.title}
                        </CardDescription>
                    </DialogHeader>

                    <div className="space-y-6 py-4">
                        {eventConfig?.criterias.map(criteria => (
                            <div key={criteria.id} className="space-y-3">
                                <div className="flex justify-between">
                                    <Label className="font-medium text-base">{criteria.name}</Label>
                                    <span className="font-bold text-primary">{scores[criteria.id] || 0} / {criteria.maxScore}</span>
                                </div>
                                <Slider
                                    value={[scores[criteria.id] || 0]}
                                    max={criteria.maxScore}
                                    step={1}
                                    onValueChange={(val) => handleScoreChange(criteria.id, val[0])}
                                />
                                <p className="text-xs text-muted-foreground">Weightage: {criteria.weightage}%</p>
                            </div>
                        ))}

                        <div className="pt-4 border-t">
                            <div className="flex justify-between items-center mb-4">
                                <span className="text-lg font-bold">Total Score</span>
                                <span className="text-2xl font-bold bg-primary/10 px-3 py-1 rounded text-primary">
                                    {calculateTotal().toFixed(2)}%
                                </span>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Feedback (Optional)</Label>
                            <Textarea
                                placeholder="Constructive feedback for the student..."
                                value={feedback}
                                onChange={(e) => setFeedback(e.target.value)}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEvaluating(null)}>Cancel</Button>
                        <Button onClick={handleSubmitEvaluation}>Submit Evaluation</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
