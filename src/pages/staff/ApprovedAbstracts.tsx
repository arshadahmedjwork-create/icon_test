import { useState, useEffect } from "react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
    Search,
    FileText,
    CheckCircle
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getAbstracts } from "@/services/supabaseService";
import { supabase } from "@/lib/supabaseClient";
import { Abstract, User } from "@/types";
import { useProgram } from "@/contexts/ProgramContext";

export default function ApprovedAbstracts() {
    const { user } = useAuth();
    const [abstracts, setAbstracts] = useState<Abstract[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedSubject, setSelectedSubject] = useState<string>("all");
    const { currentProgram } = useProgram();

    useEffect(() => {
        const loadData = async () => {
            let query = supabase.from('event_students').select('*').eq('program', currentProgram);
            if (user?.role === 'staff' && user?.college) {
                query = query.eq('college', user.college);
            }

            const [fetchedAbstracts, { data: students }] = await Promise.all([
                getAbstracts(currentProgram),
                query
            ]);

            const validStudents = students || [];
            const studentIds = new Set(validStudents.map((s: any) => s.id));

            // Only show abstracts for students in this college
            const filteredAbstracts = fetchedAbstracts.filter(a => studentIds.has(a.studentId));

            setAbstracts(filteredAbstracts);
            // Map student to User type expectation for getStudentName
            setUsers(validStudents.map((s: any) => ({ ...s, name: s.participantName })));
        };
        loadData();
    }, [user, currentProgram]);

    const getStudentName = (studentId: string) => {
        return users.find(u => u.id === studentId)?.name || "Unknown Student";
    };

    // Get unique subjects for filter
    const subjects = Array.from(new Set(abstracts.map(a => a.subject)));

    // Only approved abstracts (staff approved or final approved)
    const approvedAbstracts = abstracts.filter(a => a.status === "approved" || a.status === "staff_approved");

    const filteredAbstracts = approvedAbstracts.filter(a => {
        const matchesSearch = a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            getStudentName(a.studentId).toLowerCase().includes(searchQuery.toLowerCase());
        const matchesSubject = selectedSubject === "all" || a.subject === selectedSubject;
        return matchesSearch && matchesSubject;
    });

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-bold font-display">Approved Abstracts</h2>
                    <p className="text-muted-foreground">Showcase of all approved student abstracts with reviewer comments.</p>
                </div>
            </div>

            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 max-w-sm flex-1">
                    <Search className="w-4 h-4 text-muted-foreground" />
                    <Input
                        placeholder="Search by title or student..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <div className="w-[200px]">
                    <select
                        className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        value={selectedSubject}
                        onChange={(e) => setSelectedSubject(e.target.value)}
                    >
                        <option value="all">All Subjects</option>
                        {subjects.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>
            </div>

            <div className="border rounded-lg overflow-hidden bg-white dark:bg-zinc-950">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Title / Subject</TableHead>
                            <TableHead>Student</TableHead>
                            <TableHead>Type / Mode</TableHead>
                            <TableHead>Reviewer Feedback</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredAbstracts.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                                    No approved abstracts found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredAbstracts.map((abstract) => (
                                <TableRow key={abstract.id}>
                                    <TableCell className="max-w-[250px]">
                                        <div className="font-medium truncate" title={abstract.title}>{abstract.title}</div>
                                        <div className="text-xs text-muted-foreground">{abstract.subject}</div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="text-sm">{getStudentName(abstract.studentId)}</div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="text-sm">{abstract.type}</div>
                                        <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400">{abstract.mode}</Badge>
                                    </TableCell>
                                    <TableCell className="max-w-[300px]">
                                        {abstract.feedback ? (
                                            <p className="text-sm text-muted-foreground line-clamp-2" title={abstract.feedback}>
                                                "{abstract.feedback}"
                                            </p>
                                        ) : (
                                            <span className="text-sm italic text-muted-foreground/60">No specific comments provided.</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="outline" size="sm" className="h-8 gap-1" onClick={() => window.open(abstract.fileUrl, "_blank")}>
                                            <FileText className="w-3 h-3" /> View PDF
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
