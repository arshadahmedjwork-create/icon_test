import { useState, useEffect } from "react";
import { getSessions, getSubjectToppers, getSessionResults, calculateSessionResults, getEvaluations, getUsers } from "@/services/supabaseService";
import { Session, User } from "@/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Trophy, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";

export default function CoreTeamSessionView() {
    const { toast } = useToast();
    const [sessions, setSessions] = useState<Session[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [view, setView] = useState<"ongoing" | "completed">("ongoing");

    useEffect(() => {
        const loadData = async () => {
            const [fetchedSessions, fetchedUsers] = await Promise.all([
                getSessions(),
                getUsers()
            ]);
            setSessions(fetchedSessions);
            setUsers(fetchedUsers);
        };
        loadData();
    }, []);

    const handleCalculateResults = async (sessionId: string) => {
        try {
            const results = await calculateSessionResults(sessionId);
            if (results) {
                toast({ title: "Results Calculated", description: "Winners identified and certificates generated." });
                const updatedSessions = await getSessions();
                setSessions(updatedSessions); // Refresh
            } else {
                toast({ title: "Error", description: "Could not calculate results. Check if evaluations exist.", variant: "destructive" });
            }
        } catch (error) {
            console.error(error);
            toast({ title: "Error", description: "Failed to calculate results.", variant: "destructive" });
        }
    };

    const getStudentName = (id: string) => users.find(u => u.id === id)?.name || "Unknown";

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
                    {sessions.filter(s => s.status !== "completed").map(session => (
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
                            <CardContent>
                                <div className="flex gap-2">
                                    <Button
                                        onClick={() => handleCalculateResults(session.id)}
                                        disabled={session.status === "scheduled"}
                                    >
                                        <Trophy className="w-4 h-4 mr-2" />
                                        Finalize Results & Generate Certificates
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                    {sessions.filter(s => s.status !== "completed").length === 0 && (
                        <div className="text-center py-8 text-muted-foreground">No ongoing sessions.</div>
                    )}
                </TabsContent>

                <TabsContent value="completed" className="space-y-4">
                    {sessions.filter(s => s.status === "completed").map(session => (
                        <Card key={session.id}>
                            <CardHeader>
                                <CardTitle>{session.name} - Winners</CardTitle>
                                <CardDescription>{session.subject}</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[100px]">Rank</TableHead>
                                            <TableHead>Student</TableHead>
                                            <TableHead className="text-right">Score</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {session.winners?.map((winner) => (
                                            <TableRow key={winner.studentId}>
                                                <TableCell className="font-medium">
                                                    {winner.rank === 1 ? "🥇 1st" : winner.rank === 2 ? "🥈 2nd" : "🥉 3rd"}
                                                </TableCell>
                                                <TableCell>{getStudentName(winner.studentId)}</TableCell>
                                                <TableCell className="text-right">{winner.score}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                                <div className="mt-4 flex items-center text-sm text-green-600">
                                    <CheckCircle2 className="w-4 h-4 mr-1" />
                                    Certificates Sent
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </TabsContent>
            </Tabs>
        </div>
    );
}
