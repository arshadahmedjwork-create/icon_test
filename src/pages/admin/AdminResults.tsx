import { useState, useEffect } from "react";
import { getSubjectToppers, getSessions, getUsers } from "@/services/supabaseService";
import { Session, User } from "@/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, Trophy, Medal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useProgram } from "@/contexts/ProgramContext";

export default function AdminResults() {
    const [toppers, setToppers] = useState<{ subject: string, studentId: string, score: number, sessionName: string }[]>([]);
    const [sessions, setSessions] = useState<Session[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const { currentProgram } = useProgram();
    const isIcon = currentProgram === 'ICON';

    useEffect(() => {
        const loadData = async () => {
            try {
                // Determine order or parallelism. getUsers is needed for name lookup.
                // Subject toppers might take time.
                const [toppersData, sessionsData, usersData] = await Promise.all([
                    getSubjectToppers(),
                    getSessions(currentProgram),
                    getUsers(currentProgram)
                ]);

                setToppers(toppersData);
                setSessions(sessionsData.filter(s => s.status === "completed"));
                setUsers(usersData);
            } catch (error) {
                console.error("Failed to load results", error);
            }
        };
        loadData();
    }, [currentProgram]);

    const getStudentName = (id: string) => users.find(u => u.id === id)?.name || "Unknown";
    const getStudentCollege = (id: string) => users.find(u => u.id === id)?.college || "Unknown Analysis";

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="font-display text-2xl font-bold mb-1">{isIcon ? 'ICON' : 'MIDAS'} Results & Reports</h1>
                    <p className="text-sm text-muted-foreground">
                        View subject toppers and detailed winner lists.
                    </p>
                </div>
                <Button variant="outline">
                    <Download className="w-4 h-4 mr-2" />
                    Export Report
                </Button>
            </div>

            <Tabs defaultValue="toppers">
                <TabsList>
                    <TabsTrigger value="toppers">Subject Toppers</TabsTrigger>
                    <TabsTrigger value="all-winners">All Winners</TabsTrigger>
                </TabsList>

                <TabsContent value="toppers" className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {toppers.map((topper, idx) => (
                            <Card key={idx} className="border-yellow-200 bg-yellow-50/20">
                                <CardHeader className="pb-2">
                                    <div className="flex justify-between items-start">
                                        <Trophy className="h-8 w-8 text-yellow-600 mb-2" />
                                        <div className="text-2xl font-bold">{topper.score}</div>
                                    </div>
                                    <CardTitle className="text-lg">{topper.subject}</CardTitle>
                                    <CardDescription>Subject Topper</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="font-semibold text-lg">{getStudentName(topper.studentId)}</div>
                                    <div className="text-sm text-muted-foreground">{getStudentCollege(topper.studentId)}</div>
                                    <div className="mt-2 text-xs bg-white p-2 rounded border inline-block">
                                        Session: {topper.sessionName}
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </TabsContent>

                <TabsContent value="all-winners">
                    <Card>
                        <CardHeader>
                            <CardTitle>Detailed Winner List</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Session</TableHead>
                                        <TableHead>Rank</TableHead>
                                        <TableHead>Student</TableHead>
                                        <TableHead>College</TableHead>
                                        <TableHead className="text-right">Score</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {sessions.flatMap(session =>
                                        session.winners?.map(winner => (
                                            <TableRow key={`${session.id}-${winner.studentId}`}>
                                                <TableCell className="font-medium">{session.name}</TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-1">
                                                        {winner.rank === 1 && <Medal className="w-4 h-4 text-yellow-500" />}
                                                        {winner.rank === 2 && <Medal className="w-4 h-4 text-gray-400" />}
                                                        {winner.rank === 3 && <Medal className="w-4 h-4 text-amber-600" />}
                                                        Rank {winner.rank}
                                                    </div>
                                                </TableCell>
                                                <TableCell>{getStudentName(winner.studentId)}</TableCell>
                                                <TableCell>{getStudentCollege(winner.studentId)}</TableCell>
                                                <TableCell className="text-right">{winner.score}</TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
