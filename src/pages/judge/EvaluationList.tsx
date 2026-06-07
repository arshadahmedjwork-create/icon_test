import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
    getSessions,
    getJudges,
    getCertificates
} from "@/services/supabaseService";
import { Session, Judge, Certificate } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, MapPin, Users, ArrowRight, Download } from "lucide-react";
import { useProgram } from "@/contexts/ProgramContext";
import { downloadCertificate } from "@/services/certificateEngine";

export default function EvaluationList() {
    const { user } = useAuth();
    const { currentProgram } = useProgram();
    const [mySessions, setMySessions] = useState<Session[]>([]);
    const [judgeCertificates, setJudgeCertificates] = useState<Certificate[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadData = async () => {
            if (user?.email) {
                const [allJudges, allSessions, allCerts] = await Promise.all([
                    getJudges(currentProgram),
                    getSessions(currentProgram),
                    getCertificates()
                ]);

                const me = allJudges.find(j => j.email === user.email);

                if (me) {
                    const assigned = allSessions.filter(s => s.judges && s.judges.includes(me.id));
                    setMySessions(assigned);

                    const myCerts = allCerts.filter(c => c.userId === me.id && c.type === 'judge');
                    setJudgeCertificates(myCerts);
                }
            }
            setLoading(false);
        };
        loadData();
    }, [user, currentProgram]);

    if (loading) return <div>Loading assigned sessions...</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-bold font-display">My Assigned Sessions</h2>
                    <p className="text-muted-foreground">Select a session to begin evaluation.</p>
                </div>
            </div>

            {mySessions.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center p-12 text-center">
                        <Calendar className="w-12 h-12 text-muted-foreground mb-4 opacity-20" />
                        <h3 className="text-lg font-medium">No Sessions Assigned</h3>
                        <p className="text-muted-foreground mt-1">You have not been assigned to any sessions yet.</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4 md:grid-cols-2">
                    {mySessions.map(session => {
                        const isCompleted = session.status.toLowerCase() === "completed" || session.status === "SESSION_COMPLETED";
                        const myCert = judgeCertificates.find(c => c.sessionId === session.id);
                        
                        return (
                            <Card key={session.id} className="hover:border-primary/50 transition-colors">
                                <CardHeader>
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <CardTitle>{session.name}</CardTitle>
                                            <CardDescription>{session.subject}</CardDescription>
                                        </div>
                                        <Badge variant={isCompleted ? "secondary" : "default"}>
                                            {session.status}
                                        </Badge>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-2 text-sm text-muted-foreground mb-4">
                                        <div className="flex items-center gap-2">
                                            <Calendar className="w-4 h-4" />
                                            <span>{new Date(session.date).toLocaleDateString()} at {session.time}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <MapPin className="w-4 h-4" />
                                            <span>{session.venue} ({session.mode})</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Users className="w-4 h-4" />
                                            <span>{session.abstractIds.length} Presentations</span>
                                        </div>
                                    </div>
                                    {isCompleted ? (
                                        <div className="space-y-2">
                                            <Button disabled className="w-full" variant="secondary">
                                                Event Ended
                                            </Button>
                                            {myCert && (
                                                <Button 
                                                    className="w-full bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-semibold"
                                                    onClick={async () => {
                                                        try {
                                                            await downloadCertificate(myCert.id);
                                                        } catch (error) {
                                                            console.error("Download failed:", error);
                                                        }
                                                    }}
                                                >
                                                    <Download className="w-4 h-4 mr-2" /> Download Participation Certificate
                                                </Button>
                                            )}
                                        </div>
                                    ) : (
                                        <Button asChild className="w-full">
                                            <Link to={`/dashboard/judge/session/${session.id}`}>
                                                Start Evaluation <ArrowRight className="w-4 h-4 ml-2" />
                                            </Link>
                                        </Button>
                                    )}
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
