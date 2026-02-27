
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
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
    CheckCircle,
    XCircle,
    Search,
    FileText,
    AlertTriangle,
    ExternalLink
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getAbstracts, updateAbstractStatus } from "@/services/supabaseService";
import { supabase } from "@/lib/supabaseClient";
import { sendProvisionalAcceptanceEmail } from "@/services/emailService";
import { Abstract, User } from "@/types";
import { useToast } from "@/hooks/use-toast";

export default function AbstractScrutiny() {
    const { user } = useAuth();
    const { toast } = useToast();
    const [abstracts, setAbstracts] = useState<Abstract[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [searchQuery, setSearchQuery] = useState("");

    // Dialog State
    const [actionDialog, setActionDialog] = useState(false);
    const [selectedAbstract, setSelectedAbstract] = useState<Abstract | null>(null);
    const [actionType, setActionType] = useState<"approve" | "reject" | "revision">("approve");
    const [feedback, setFeedback] = useState("");

    useEffect(() => {
        const loadData = async () => {
            let query = supabase.from('event_students').select('*');
            if (user?.role === 'staff' && user?.college) {
                query = query.eq('college', user.college);
            }

            const [fetchedAbstracts, { data: students }] = await Promise.all([
                getAbstracts(),
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
    }, [user]);

    const refreshData = async () => {
        const fetchedAbstracts = await getAbstracts();
        setAbstracts(fetchedAbstracts);
    };

    const getStudentName = (studentId: string) => {
        return users.find(u => u.id === studentId)?.name || "Unknown Student";
    };

    const getStudentEmail = (studentId: string) => {
        return users.find(u => u.id === studentId)?.email || "unknown@example.com";
    };

    const [selectedSubject, setSelectedSubject] = useState<string>("all");

    // Get unique subjects for filter
    const subjects = Array.from(new Set(abstracts.map(a => a.subject)));

    const pendingAbstracts = abstracts.filter(a => a.status === "pending" || a.status === "revision_requested");

    const filteredAbstracts = pendingAbstracts.filter(a => {
        const matchesSearch = a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            getStudentName(a.studentId).toLowerCase().includes(searchQuery.toLowerCase());
        const matchesSubject = selectedSubject === "all" || a.subject === selectedSubject;
        return matchesSearch && matchesSubject;
    });

    const handleActionInit = (abstract: Abstract, type: "approve" | "reject" | "revision") => {
        setSelectedAbstract(abstract);
        setActionType(type);
        setFeedback("");
        setActionDialog(true);
    };

    const handleConfirmAction = async () => {
        if (!selectedAbstract) return;

        let newStatus: Abstract["status"];
        let successMessage = "";

        switch (actionType) {
            case "approve":
                newStatus = "approved";
                successMessage = "Abstract approved successfully.";
                break;
            case "reject":
                newStatus = "rejected";
                successMessage = "Abstract rejected.";
                break;
            case "revision":
                newStatus = "revision_requested";
                successMessage = "Revision requested from student.";
                break;
            // Default needed to satisfy TS if switch incomplete, but covered above
        }

        try {
            // @ts-ignore - Status strings match but TS might be picking up slight diffs or just being strict
            await updateAbstractStatus(selectedAbstract.id, newStatus!, feedback);
            toast({ title: "Updated", description: successMessage });

            // Send provisional acceptance email if approved
            if (newStatus === "approved") {
                try {
                    await sendProvisionalAcceptanceEmail({
                        student_name: getStudentName(selectedAbstract.studentId),
                        student_email: getStudentEmail(selectedAbstract.studentId),
                        abstract_title: selectedAbstract.title,
                        event_type: selectedAbstract.type,
                        subject: selectedAbstract.subject
                    });
                    console.log("Provisional acceptance email sent.");
                } catch (emailErr) {
                    console.error("Failed to send provisional acceptance email:", emailErr);
                    toast({ title: "Email Error", description: "Abstract approved, but email failed to send.", variant: "destructive" });
                }
            }

            setActionDialog(false);
            refreshData(); // Refresh list to remove processed item
        } catch (error) {
            console.error(error);
            toast({ title: "Error", description: "Failed to update abstract.", variant: "destructive" });
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-bold font-display">Abstract Scrutiny</h2>
                    <p className="text-muted-foreground">Review scientific abstracts submitted by students.</p>
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

            <div className="border rounded-lg overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Title / Subject</TableHead>
                            <TableHead>Student</TableHead>
                            <TableHead>Type / Mode</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredAbstracts.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                                    No pending abstracts found.
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
                                        <Badge variant="outline" className="text-xs">{abstract.mode}</Badge>
                                    </TableCell>
                                    <TableCell>
                                        {abstract.status === "revision_requested" ? (
                                            <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Revision Pending</Badge>
                                        ) : (
                                            <Badge variant="secondary">New</Badge>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button variant="outline" size="sm" className="h-8 gap-1" onClick={() => window.open(abstract.fileUrl, "_blank")}>
                                                <FileText className="w-3 h-3" /> View PDF
                                            </Button>
                                            <Button
                                                size="sm"
                                                className="bg-green-600 hover:bg-green-700 h-8 gap-1"
                                                onClick={() => handleActionInit(abstract, "approve")}
                                            >
                                                <CheckCircle className="w-3 h-3" />
                                            </Button>
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                className="h-8 gap-1 bg-yellow-100 hover:bg-yellow-200 text-yellow-800"
                                                onClick={() => handleActionInit(abstract, "revision")}
                                                title="Request Revision"
                                            >
                                                <AlertTriangle className="w-3 h-3" />
                                            </Button>
                                            <Button
                                                variant="destructive"
                                                size="sm"
                                                className="h-8 gap-1"
                                                onClick={() => handleActionInit(abstract, "reject")}
                                            >
                                                <XCircle className="w-3 h-3" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            <Dialog open={actionDialog} onOpenChange={setActionDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {actionType === "approve" && "Approve Abstract"}
                            {actionType === "reject" && "Reject Abstract"}
                            {actionType === "revision" && "Request Revision"}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        {selectedAbstract && (
                            <div className="text-sm text-muted-foreground mb-2">
                                <p>Title: <span className="font-medium text-foreground">{selectedAbstract.title}</span></p>
                            </div>
                        )}
                        <div className="space-y-2">
                            <Label>Feedback / Comments {actionType !== "approve" && <span className="text-destructive">*</span>}</Label>
                            <Textarea
                                placeholder={actionType === "approve" ? "Optional feedback..." : "Please specify reason..."}
                                value={feedback}
                                onChange={(e) => setFeedback(e.target.value)}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setActionDialog(false)}>Cancel</Button>
                        <Button
                            variant={actionType === "reject" ? "destructive" : "default"}
                            onClick={handleConfirmAction}
                            disabled={actionType !== "approve" && !feedback.trim()}
                        >
                            Confirm
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
