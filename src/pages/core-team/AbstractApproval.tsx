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
import { getAbstracts, updateAbstractStatus, getEventStudents } from "@/services/supabaseService";
import { supabase } from "@/lib/supabaseClient";
import { sendProvisionalAcceptanceEmail } from "@/services/emailService";
import { Abstract, User } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { useProgram } from "@/contexts/ProgramContext";

export default function AbstractApproval() {
    const { user } = useAuth();
    const { toast } = useToast();
    const { currentProgram } = useProgram();
    const [abstracts, setAbstracts] = useState<Abstract[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedSubject, setSelectedSubject] = useState<string>("all");

    // Dialog State
    const [actionDialog, setActionDialog] = useState(false);
    const [selectedAbstract, setSelectedAbstract] = useState<Abstract | null>(null);
    const [actionType, setActionType] = useState<"approve" | "reject" | "revision">("approve");
    const [feedback, setFeedback] = useState("");
    const [viewingPdf, setViewingPdf] = useState<Abstract | null>(null);

    const loadData = async () => {
        try {
            const [fetchedAbstracts, students] = await Promise.all([
                getAbstracts(currentProgram),
                getEventStudents(currentProgram)
            ]);

            const validStudents = students || [];
            setAbstracts(fetchedAbstracts);
            // Map student to User type expectation for getStudentName / getStudentCollege
            setUsers(validStudents.map((s: any) => ({ ...s, name: s.participantName })));
        } catch (error) {
            console.error("Failed to load abstracts data", error);
            toast({ title: "Error", description: "Failed to load abstract submissions.", variant: "destructive" });
        }
    };

    useEffect(() => {
        loadData();
    }, [user, currentProgram]);

    const refreshData = async () => {
        await loadData();
    };

    const getStudentName = (studentId: string) => {
        return users.find(u => u.id === studentId)?.name || "Unknown Student";
    };

    const getStudentEmail = (studentId: string) => {
        return users.find(u => u.id === studentId)?.email || "unknown@example.com";
    };

    const getStudentCollege = (studentId: string) => {
        return users.find(u => u.id === studentId)?.college || "Unknown College";
    };

    // Get unique subjects for filter
    const subjects = Array.from(new Set(abstracts.map(a => a.subject).filter(Boolean)));

    // Filters and sorting
    const filteredAbstracts = abstracts.filter(a => {
        const matchesSearch = a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            getStudentName(a.studentId).toLowerCase().includes(searchQuery.toLowerCase()) ||
            getStudentCollege(a.studentId).toLowerCase().includes(searchQuery.toLowerCase());
        const matchesSubject = selectedSubject === "all" || a.subject === selectedSubject;
        return matchesSearch && matchesSubject;
    });

    // Push already approved abstracts to the down
    const sortedAbstracts = [...filteredAbstracts].sort((a, b) => {
        const getScore = (status: string) => {
            if (status === "pending") return 0;
            if (status === "revision_requested") return 1;
            if (status === "approved") return 2;
            if (status === "rejected") return 3;
            return 4;
        };
        return getScore(a.status) - getScore(b.status);
    });

    const handleActionInit = (abstract: Abstract, type: "approve" | "reject" | "revision") => {
        setSelectedAbstract(abstract);
        setActionType(type);
        setFeedback("");
        setActionDialog(true);
    };

    const handleConfirmAction = async (overrideAbstract?: Abstract, overrideType?: string, overrideFeedback?: string) => {
        const abstract = overrideAbstract || selectedAbstract;
        const type = overrideType || actionType;
        const finalFeedback = overrideFeedback !== undefined ? overrideFeedback : feedback;

        if (!abstract) return;

        let newStatus: Abstract["status"];
        let successMessage = "";

        switch (type) {
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
            default:
                return;
        }

        try {
            await updateAbstractStatus(abstract.id, newStatus!, finalFeedback);
            toast({ title: "Updated", description: successMessage });

            // Send provisional acceptance email if approved
            if (newStatus === "approved") {
                try {
                    await sendProvisionalAcceptanceEmail({
                        student_name: getStudentName(abstract.studentId),
                        student_email: getStudentEmail(abstract.studentId),
                        abstract_title: abstract.title,
                        event_type: abstract.type,
                        subject: abstract.subject
                    });
                } catch (emailErr) {
                    console.error("Email failed:", emailErr);
                }
            }

            setActionDialog(false);
            setViewingPdf(null);
            refreshData(); 
        } catch (error) {
            console.error(error);
            toast({ title: "Error", description: "Failed to update abstract.", variant: "destructive" });
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-bold font-display">Abstract Approval</h2>
                    <p className="text-muted-foreground">Review, approve, or request revisions on student abstract submissions.</p>
                </div>
            </div>

            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 max-w-sm flex-1">
                    <Search className="w-4 h-4 text-muted-foreground" />
                    <Input
                        placeholder="Search by title, student, or college..."
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
                        <option value="all">All Subjects/Specialities</option>
                        {subjects.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>
            </div>

            <div className="border rounded-lg overflow-hidden bg-white dark:bg-zinc-950">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Title / Subject</TableHead>
                            <TableHead>Student / College</TableHead>
                            <TableHead>Type / Mode</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {sortedAbstracts.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                                    No abstracts found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            sortedAbstracts.map((abstract) => (
                                <TableRow key={abstract.id}>
                                    <TableCell className="max-w-[250px]">
                                        <div className="font-medium truncate" title={abstract.title}>{abstract.title}</div>
                                        <div className="text-xs text-muted-foreground">{abstract.subject}</div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="text-sm font-semibold">{getStudentName(abstract.studentId)}</div>
                                        <div className="text-xs text-muted-foreground">{getStudentCollege(abstract.studentId)}</div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="text-sm">{abstract.type}</div>
                                        <Badge variant="outline" className="text-xs">{abstract.mode}</Badge>
                                    </TableCell>
                                    <TableCell>
                                        {abstract.status === "approved" ? (
                                            <Badge variant="secondary" className="bg-green-100 text-green-800 hover:bg-green-100">Approved</Badge>
                                        ) : abstract.status === "rejected" ? (
                                            <Badge variant="secondary" className="bg-red-100 text-red-800 hover:bg-red-100">Rejected</Badge>
                                        ) : abstract.status === "revision_requested" || abstract.status === "STAFF_APPROVED" ? (
                                            <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Revision Pending</Badge>
                                        ) : (
                                            <Badge variant="secondary">New</Badge>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button variant="outline" size="sm" className="h-8 gap-1" onClick={() => setViewingPdf(abstract)}>
                                                <FileText className="w-3 h-3" /> Review
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Integrated PDF Viewer Dialog */}
            <Dialog open={!!viewingPdf} onOpenChange={(val) => !val && setViewingPdf(null)}>
                <DialogContent className="max-w-[95vw] max-h-[95vh] h-[95vh] p-0 flex flex-col md:flex-row overflow-hidden border-none shadow-2xl">
                    {/* Left: PDF Viewer */}
                    <div className="flex-1 bg-muted/30 border-r flex flex-col overflow-hidden relative">
                        <div className="p-4 border-b bg-background flex justify-between items-center shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-primary/10 rounded-lg">
                                    <FileText className="w-5 h-5 text-primary" />
                                </div>
                                <div>
                                    <DialogTitle className="text-lg font-bold truncate max-w-[400px] leading-tight">
                                        {viewingPdf?.title}
                                    </DialogTitle>
                                    <p className="text-xs text-muted-foreground">Double check formatting and content before approval</p>
                                </div>
                            </div>
                            <Button 
                                variant="outline" 
                                size="sm" 
                                className="hover:bg-primary hover:text-white transition-colors"
                                onClick={() => viewingPdf?.fileUrl && window.open(viewingPdf.fileUrl, "_blank")}
                            >
                                <ExternalLink className="w-4 h-4 mr-2" /> Open Original
                            </Button>
                        </div>
                        <div className="flex-1 p-0 bg-neutral-100/50">
                            {viewingPdf?.fileUrl ? (
                                <iframe 
                                    src={viewingPdf.fileUrl} 
                                    className="w-full h-full border-none"
                                    title="Abstract PDF Preview"
                                />
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-10 text-center">
                                    <AlertTriangle className="w-16 h-16 mb-4 opacity-20 text-yellow-500" />
                                    <h3 className="text-xl font-bold">No Preview Available</h3>
                                    <p className="max-w-xs">This abstract doesn't have a valid PDF file attached or it's currently unreachable.</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right: Abstract Details & Fast Actions */}
                    <div className="md:w-[400px] shrink-0 bg-background flex flex-col border-l shadow-xl z-10">
                        <div className="flex-1 overflow-y-auto p-8">
                            <div className="space-y-8">
                                <section>
                                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground mb-4">Submission Metadata</h3>
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-start gap-4">
                                            <span className="text-sm text-muted-foreground">Author:</span>
                                            <span className="text-sm font-bold text-right">{viewingPdf ? getStudentName(viewingPdf.studentId) : "N/A"}</span>
                                        </div>
                                        <div className="flex justify-between items-start gap-4">
                                            <span className="text-sm text-muted-foreground">Institution:</span>
                                            <span className="text-sm font-bold text-right">{viewingPdf ? getStudentCollege(viewingPdf.studentId) : "N/A"}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm text-muted-foreground">Category:</span>
                                            <Badge variant="secondary" className="font-bold">{viewingPdf?.subject}</Badge>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm text-muted-foreground">Format:</span>
                                            <Badge variant="outline" className="border-primary/30 text-primary font-bold">{viewingPdf?.type} ({viewingPdf?.mode})</Badge>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm text-muted-foreground">Current Status:</span>
                                            <Badge variant="outline" className="font-bold">{viewingPdf?.status}</Badge>
                                        </div>
                                    </div>
                                </section>

                                <section className="pt-6 border-t">
                                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground mb-4">Reviewer Decision</h3>
                                    <div className="space-y-4 pt-2">
                                        {/* Action Selection Tabs */}
                                        <div className="flex p-1 bg-muted rounded-xl gap-1">
                                            <Button 
                                                variant={actionType === "approve" ? "default" : "ghost"}
                                                className={`flex-1 rounded-lg text-xs font-bold ${actionType === "approve" ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""}`}
                                                onClick={() => { setActionType("approve"); setFeedback(""); }}
                                            >
                                                Approve
                                            </Button>
                                            <Button 
                                                variant={actionType === "revision" ? "default" : "ghost"}
                                                className={`flex-1 rounded-lg text-xs font-bold ${actionType === "revision" ? "bg-amber-600 hover:bg-amber-700 text-white" : ""}`}
                                                onClick={() => { setActionType("revision"); setFeedback(""); }}
                                            >
                                                Revise
                                            </Button>
                                            <Button 
                                                variant={actionType === "reject" ? "default" : "ghost"}
                                                className={`flex-1 rounded-lg text-xs font-bold ${actionType === "reject" ? "bg-rose-600 hover:bg-rose-700 text-white" : ""}`}
                                                onClick={() => { setActionType("reject"); setFeedback(""); }}
                                            >
                                                Reject
                                            </Button>
                                        </div>

                                        {/* Action Configuration Area */}
                                        <div className="p-4 border rounded-xl bg-slate-50/50 space-y-4 min-h-[160px] flex flex-col justify-center">
                                            {actionType === "approve" && (
                                                <div className="text-center space-y-3">
                                                    <div className="p-2 bg-emerald-100 text-emerald-700 rounded-full w-10 h-10 mx-auto flex items-center justify-center">
                                                        <CheckCircle className="w-5 h-5" />
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-bold">Approve for Presentation</p>
                                                        <p className="text-xs text-muted-foreground mt-1">This will notify the student and allow them to proceed.</p>
                                                    </div>
                                                    {viewingPdf?.feedback && (
                                                        <div className="text-left space-y-1">
                                                            <Label className="text-[10px] font-black uppercase text-muted-foreground">Previous Feedback</Label>
                                                            <p className="text-xs italic bg-white p-2 border rounded">{viewingPdf.feedback}</p>
                                                        </div>
                                                    )}
                                                    <div className="space-y-1 text-left">
                                                        <Label className="text-[10px] font-black uppercase text-muted-foreground">Acceptance Remarks (Optional)</Label>
                                                        <Textarea 
                                                            placeholder="Add remarks for approval..." 
                                                            className="min-h-[60px] text-xs bg-white rounded-lg"
                                                            value={feedback}
                                                            onChange={(e) => setFeedback(e.target.value)}
                                                        />
                                                    </div>
                                                    <Button 
                                                        className="w-full bg-emerald-600 hover:bg-emerald-700 rounded-xl text-white"
                                                        onClick={() => handleConfirmAction(viewingPdf, "approve", feedback)}
                                                    >
                                                        Confirm Approval
                                                    </Button>
                                                </div>
                                            )}

                                            {actionType === "revision" && (
                                                <div className="space-y-3">
                                                    <Label className="text-[10px] font-black uppercase text-amber-600">REVISION INSTRUCTIONS</Label>
                                                    <Textarea 
                                                        placeholder="Example: 'Please revise the Abstract section to be under 300 words...'" 
                                                        className="min-h-[80px] text-xs bg-white rounded-lg"
                                                        value={feedback}
                                                        onChange={(e) => setFeedback(e.target.value)}
                                                    />
                                                    <Button 
                                                        disabled={!feedback.trim()}
                                                        className="w-full bg-amber-600 hover:bg-amber-700 rounded-xl text-white"
                                                        onClick={() => handleConfirmAction(viewingPdf, "revision", feedback)}
                                                    >
                                                        Send Revision Request
                                                    </Button>
                                                </div>
                                            )}

                                            {actionType === "reject" && (
                                                <div className="space-y-3">
                                                    <Label className="text-[10px] font-black uppercase text-rose-600">REJECTION REASON</Label>
                                                    <select 
                                                        className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-xs ring-offset-background"
                                                        value={feedback}
                                                        onChange={(e) => setFeedback(e.target.value)}
                                                    >
                                                        <option value="">Select a reason...</option>
                                                        <option value="Topic Mismatch: The abstract does not align with the event scope.">Topic Mismatch (Scope)</option>
                                                        <option value="Insufficient Data: The abstract lacks clear results or methodology.">Insufficient Methodology</option>
                                                        <option value="Plagiarism Concern: Similarity detected with existing literature.">Plagiarism / Similarity</option>
                                                        <option value="Formatting Failed: Does not meet specified guidelines.">Formatting Violations</option>
                                                    </select>
                                                    <Button 
                                                        disabled={!feedback}
                                                        className="w-full bg-rose-600 hover:bg-rose-700 rounded-xl text-white"
                                                        onClick={() => handleConfirmAction(viewingPdf, "reject", feedback)}
                                                    >
                                                        Confirm Rejection
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </section>
                            </div>
                        </div>
                        <div className="p-4 border-t bg-muted/10 shrink-0">
                            <Button variant="ghost" className="w-full text-muted-foreground" onClick={() => setViewingPdf(null)}>
                                Close Review Panel
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
