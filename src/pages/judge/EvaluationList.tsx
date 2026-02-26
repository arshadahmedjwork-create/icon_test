import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
    getSessions,
    getJudges
} from "@/services/supabaseService";
import { Session, Judge } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, MapPin, Users, ArrowRight } from "lucide-react";

export default function EvaluationList() {
    const { user } = useAuth();
    const [mySessions, setMySessions] = useState<Session[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadData = async () => {
            if (user?.email) {
                const [allJudges, allSessions] = await Promise.all([
                    getJudges(),
                    getSessions()
                ]);

                const me = allJudges.find(j => j.email === user.email);

                if (me) {
                    const assigned = allSessions.filter(s => s.judges && s.judges.includes(me.id));
                    setMySessions(assigned);
                }
            }
            setLoading(false);
        };
        loadData();
    }, [user]);

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
                    {mySessions.map(session => (
                        <Card key={session.id} className="hover:border-primary/50 transition-colors">
                            <CardHeader>
                                <div className="flex justify-between items-start">
                                    <div>
                                        <CardTitle>{session.name}</CardTitle>
                                        <CardDescription>{session.subject}</CardDescription>
                                    </div>
                                    <Badge variant={session.status === "completed" ? "secondary" : "default"}>
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
                                <Button asChild className="w-full">
                                    <Link to={`/dashboard/judge/session/${session.id}`}>
                                        Start Evaluation <ArrowRight className="w-4 h-4 ml-2" />
                                    </Link>
                                </Button>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
