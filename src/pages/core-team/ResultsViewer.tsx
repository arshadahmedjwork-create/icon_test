import { useState, useEffect } from "react";
import {
    getSessions,
    getEvaluations,
    getAbstracts,
    getUsers
} from "@/services/supabaseService";
import { Session, Evaluation, Abstract, User } from "@/types";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trophy, Download } from "lucide-react";

interface ResultRow {
    rank: number;
    studentName: string;
    studentId: string;
    abstractTitle: string;
    college: string;
    totalScore: number;
    judgeCount: number;
}

export default function ResultsViewer() {
    const [sessions, setSessions] = useState<Session[]>([]);
    const [selectedSessionId, setSelectedSessionId] = useState<string>("");
    const [results, setResults] = useState<ResultRow[]>([]);

    // Cache
    const [users, setUsers] = useState<User[]>([]);
    const [abstracts, setAbstracts] = useState<Abstract[]>([]);
    const [evaluations, setEvaluations] = useState<Evaluation[]>([]);

    useEffect(() => {
        const loadData = async () => {
            const [fetchedSessions, fetchedUsers, fetchedAbstracts, fetchedEvaluations] = await Promise.all([
                getSessions(),
                getUsers(),
                getAbstracts(),
                getEvaluations()
            ]);
            setSessions(fetchedSessions);
            setUsers(fetchedUsers);
            setAbstracts(fetchedAbstracts);
            setEvaluations(fetchedEvaluations);
        };
        loadData();
    }, []);

    useEffect(() => {
        if (!selectedSessionId) return;

        const session = sessions.find(s => s.id === selectedSessionId);
        if (!session) return;

        // Filter evaluations for this session
        const sessionEvals = evaluations.filter(e => e.sessionId === selectedSessionId);

        // Group by student
        const studentScores: Record<string, { total: number, count: number }> = {};

        sessionEvals.forEach(e => {
            if (!studentScores[e.studentId]) {
                studentScores[e.studentId] = { total: 0, count: 0 };
            }
            studentScores[e.studentId].total += e.totalScore;
            studentScores[e.studentId].count += 1;
        });

        // Create Result Rows
        const rows = session.abstractIds.map(absId => {
            const abstract = abstracts.find(a => a.id === absId);
            if (!abstract) return null;

            const student = users.find(u => u.id === abstract.studentId);
            const scoreData = studentScores[abstract.studentId] || { total: 0, count: 0 };

            const avgScore = scoreData.count > 0 ? (scoreData.total / scoreData.count) : 0;

            return {
                rank: 0,
                studentId: abstract.studentId,
                studentName: student?.name || "Unknown",
                college: student?.college || "Unknown",
                abstractTitle: abstract.title,
                totalScore: parseFloat(avgScore.toFixed(2)),
                judgeCount: scoreData.count
            };
        }).filter(row => row !== null) as ResultRow[];

        // Sort by Score Descending
        rows.sort((a, b) => b.totalScore - a.totalScore);

        // Assign Ranks
        rows.forEach((row, index) => {
            row.rank = index + 1;
        });

        setResults(rows);
    }, [selectedSessionId, sessions, evaluations, users, abstracts]);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-bold font-display">Results Compilation</h2>
                    <p className="text-muted-foreground">View calculated scores and standings.</p>
                </div>
                <Button variant="outline" disabled={!selectedSessionId}>
                    <Download className="w-4 h-4 mr-2" /> Export CSV
                </Button>
            </div>

            <div className="flex items-center gap-4">
                <div className="w-[300px]">
                    <Select value={selectedSessionId} onValueChange={setSelectedSessionId}>
                        <SelectTrigger>
                            <SelectValue placeholder="Select Session to View Results" />
                        </SelectTrigger>
                        <SelectContent>
                            {sessions.map(s => (
                                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {selectedSessionId ? (
                <Card>
                    <CardHeader>
                        <CardTitle>Session Standings</CardTitle>
                        <CardDescription>
                            Rankings based on average judge scores.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[80px]">Rank</TableHead>
                                    <TableHead>Student</TableHead>
                                    <TableHead>College</TableHead>
                                    <TableHead className="max-w-[300px]">Presentation</TableHead>
                                    <TableHead className="text-right">Judges</TableHead>
                                    <TableHead className="text-right">Avg Score</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {results.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
                                            No evaluations recorded for this session yet.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    results.map((row) => (
                                        <TableRow key={row.studentId} className={row.rank === 1 ? "bg-yellow-50/50" : ""}>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    {row.rank === 1 && <Trophy className="w-4 h-4 text-yellow-500" />}
                                                    <span className="font-bold">#{row.rank}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="font-medium">{row.studentName}</div>
                                                <div className="text-xs text-muted-foreground">{row.studentId}</div>
                                            </TableCell>
                                            <TableCell>{row.college}</TableCell>
                                            <TableCell className="truncate" title={row.abstractTitle}>
                                                {row.abstractTitle}
                                            </TableCell>
                                            <TableCell className="text-right">{row.judgeCount}</TableCell>
                                            <TableCell className="text-right font-bold text-lg">
                                                {row.totalScore}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            ) : (
                <div className="flex flex-col items-center justify-center h-64 border rounded-lg bg-muted/10 text-muted-foreground">
                    <Trophy className="w-12 h-12 mb-4 opacity-20" />
                    <p className="mt-2 font-medium">Select a session to view results.</p>
                </div>
            )}
        </div>
    );
}
