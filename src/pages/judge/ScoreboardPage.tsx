import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { getSessions, getEvaluations, getEventStudents, isNonCompetitiveSession } from "@/services/supabaseService";
import { Session, Evaluation, Student } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Trophy, Users, RefreshCw } from "lucide-react";
import { useProgram } from "@/contexts/ProgramContext";

export default function ScoreboardPage() {
    const { sessionId } = useParams();
    const { currentProgram } = useProgram();
    const [session, setSession] = useState<Session | null>(null);
    const [students, setStudents] = useState<Student[]>([]);
    const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const loadData = async () => {
        if (!sessionId) return;
        setIsLoading(true);
        try {
            const [allSessions, fetchedStudents, allEvaluations] = await Promise.all([
                getSessions(currentProgram),
                getEventStudents(currentProgram),
                getEvaluations(currentProgram)
            ]);

            const foundSession = allSessions.find(s => s.id === sessionId);
            setSession(foundSession || null);
            setStudents(fetchedStudents);
            setEvaluations(allEvaluations.filter(e => e.sessionId === sessionId));
        } catch (error) {
            console.error("Failed to load scoreboard data:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [sessionId, currentProgram]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (!session) {
        return (
            <div className="p-8 text-center text-muted-foreground">
                Session not found.
            </div>
        );
    }

    // Filter to present session participants (excluding those that didn't present or were absent)
    const attendedSubIds = (session as any)._attendedSubmissionIds || [];
    
    // Group evaluations by student and calculate average score
    const studentScores: Record<string, { totalWeighted: number, count: number }> = {};
    evaluations.forEach(evalData => {
        if (evalData.isAbsent) return;
        
        const studentId = evalData.studentId;
        
        // Use criterias for this session
        const activeCriterias = session.criterias || [
            { id: 'std-content', name: 'Scientific Content', maxScore: 10, weightage: 40 },
            { id: 'std-delivery', name: 'Presentation / Delivery', maxScore: 10, weightage: 30 },
            { id: 'std-impact', name: 'Innovation & Impact', maxScore: 10, weightage: 30 }
        ];

        let weightedSum = 0;
        Object.entries(evalData.scores).forEach(([critId, score]) => {
            const criteria = activeCriterias.find(c => c.id === critId);
            const numScore = Number(score);
            if (criteria && !isNaN(numScore)) {
                weightedSum += (numScore / criteria.maxScore) * criteria.weightage;
            }
        });

        if (!studentScores[studentId]) {
            studentScores[studentId] = { totalWeighted: 0, count: 0 };
        }
        studentScores[studentId].totalWeighted += weightedSum;
        studentScores[studentId].count += 1;
    });

    // Generate ranked list
    const rankings = Object.entries(studentScores)
        .map(([studentId, data]) => {
            const student = students.find(s => s.id === studentId);
            return {
                studentId,
                name: student?.participantName || student?.name || "Unknown",
                college: student?.college || "Unknown Institution",
                score: Number((data.totalWeighted / data.count).toFixed(2))
            };
        })
        .sort((a, b) => b.score - a.score);

    const isNonComp = isNonCompetitiveSession(session);

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <div className="flex items-center justify-between border-b pb-4">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" asChild>
                        <Link to={`/dashboard/judge/session/${sessionId}`}><ArrowLeft className="w-4 h-4" /></Link>
                    </Button>
                    <div>
                        <h2 className="text-2xl font-bold font-display flex items-center gap-2">
                            <Trophy className="w-6 h-6 text-yellow-500" />
                            Session Scoreboard
                        </h2>
                        <p className="text-muted-foreground text-sm">{session.name} • {session.subject}</p>
                    </div>
                </div>
                <Button variant="outline" size="sm" onClick={loadData} className="gap-1">
                    <RefreshCw className="w-4 h-4" /> Refresh
                </Button>
            </div>

            {isNonComp ? (
                <Card className="border-red-100 bg-red-50/10">
                    <CardHeader>
                        <CardTitle className="text-red-800">Non-Competitive Session</CardTitle>
                        <CardDescription>
                            This session type (Accommodation / Clinician / Academician) is attendance-only. Ranking is disabled.
                        </CardDescription>
                    </CardHeader>
                </Card>
            ) : (
                <div className="space-y-4">
                    {rankings.length === 0 ? (
                        <Card className="text-center py-12 border-dashed">
                            <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                            <h3 className="text-lg font-semibold mb-1">No Scores Submitted Yet</h3>
                            <p className="text-muted-foreground text-sm">Rankings will appear here as evaluations are saved.</p>
                        </Card>
                    ) : (
                        <div className="grid gap-4">
                            {rankings.map((rank, index) => {
                                const isTopThree = index < 3;
                                const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : "";
                                const ordinal = index === 0 ? "1st Place" : index === 1 ? "2nd Place" : index === 2 ? "3rd Place" : `${index + 1}th Place`;
                                
                                return (
                                    <Card key={rank.studentId} className={`transition-all ${isTopThree ? 'border-amber-200 bg-amber-50/10 shadow-sm' : ''}`}>
                                        <CardContent className="flex justify-between items-center p-6">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center font-bold text-lg border">
                                                    {medal || (index + 1)}
                                                </div>
                                                <div>
                                                    <div className="text-xs font-bold text-amber-600 uppercase tracking-wide">{ordinal}</div>
                                                    <h3 className="font-bold text-lg text-slate-900 mt-0.5">{rank.name}</h3>
                                                    <p className="text-sm text-slate-500">{rank.college}</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <Badge className={`${isTopThree ? 'bg-amber-600' : 'bg-primary'} text-white font-bold text-lg px-4 py-1.5 rounded-xl border-none`}>
                                                    {rank.score}%
                                                </Badge>
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
