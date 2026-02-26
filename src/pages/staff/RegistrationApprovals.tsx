
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
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
    CheckCircle,
    XCircle,
    Search,
    Eye,
    FileText
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getEventStudents, updateEventStudent } from "@/services/supabaseService";
import { sendApprovalEmail } from "@/services/emailService";
import bcrypt from "bcryptjs";
import { Student } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";

export default function RegistrationApprovals() {
    const { user } = useAuth();
    const { toast } = useToast();
    const [searchQuery, setSearchQuery] = useState("");
    const [rejectDialog, setRejectDialog] = useState(false);
    const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
    const [rejectionReason, setRejectionReason] = useState("");
    const [users, setUsers] = useState<any[]>([]);

    useEffect(() => {
        const loadStudents = async () => {
            const fetchedStudents = await getEventStudents();
            setUsers(fetchedStudents);
        };
        loadStudents();
    }, []);

    // Filter registrations linked to this staff's college
    const staffCollege = user?.college;
    const pendingStudents = users.filter(s =>
        (s.college === staffCollege || !staffCollege) && // !staffCollege allows admin to see all
        s.approvalStatus === "PENDING"
    );

    const handleApprove = async (student: any) => {
        try {
            // Generate a random 8-character password
            const tempPassword = Math.random().toString(36).slice(-8);
            const hashedPassword = await bcrypt.hash(tempPassword, 10);

            // Update student status and password
            await updateEventStudent(student.id, {
                approvalStatus: "APPROVED",
                password: hashedPassword
            });

            // Send Email
            try {
                await sendApprovalEmail({
                    student_name: student.participantName,
                    student_email: student.email,
                    temp_password: tempPassword,
                    login_url: window.location.origin + "/member-login"
                });
                toast({ title: "Approved", description: `${student.participantName} is approved and notified.` });
            } catch (emailError) {
                console.error("Email failed:", emailError);
                toast({ title: "Approved (Email Failed)", description: `${student.participantName} approved, but email failed to send.`, variant: "destructive" });
            }

            // Update local state
            setUsers(prev => prev.map(u => u.id === student.id ? { ...u, approvalStatus: "APPROVED" } : u));
        } catch (error) {
            console.error(error);
            toast({ title: "Error", description: "Failed to approve student.", variant: "destructive" });
        }
    };

    const handleRejectInit = (student: any) => {
        setSelectedStudent(student);
        setRejectDialog(true);
    };

    const handleRejectConfirm = async () => {
        if (selectedStudent && rejectionReason) {
            try {
                await updateEventStudent(selectedStudent.id, {
                    approvalStatus: "REJECTED"
                });
                toast({ title: "Rejected", description: `${selectedStudent.participantName} registration rejected.` });

                // Update local state
                setUsers(prev => prev.map(u => u.id === selectedStudent.id ? { ...u, approvalStatus: "REJECTED" } : u));

                setRejectDialog(false);
                setRejectionReason("");
                setSelectedStudent(null);
            } catch (error) {
                console.error(error);
                toast({ title: "Error", description: "Failed to reject student.", variant: "destructive" });
            }
        }
    };

    const filteredStudents = pendingStudents.filter(s =>
        s.participantName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.email?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-bold font-display">Pending Registrations</h2>
                    <p className="text-muted-foreground">Verify ID proofs and approve students from {staffCollege || "your college"}.</p>
                </div>
            </div>

            <div className="flex items-center gap-2 max-w-sm">
                <Search className="w-4 h-4 text-muted-foreground" />
                <Input
                    placeholder="Search students..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>

            <div className="border rounded-lg overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Student Name</TableHead>
                            <TableHead>Course / Year</TableHead>
                            <TableHead>Contact</TableHead>
                            <TableHead>ID Proof</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredStudents.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                                    No pending registrations found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredStudents.map((student) => (
                                <TableRow key={student.id}>
                                    <TableCell>
                                        <div className="font-medium">{student.participantName}</div>
                                        <div className="text-xs text-muted-foreground">{student.email}</div>
                                        {staffCollege && student.college !== staffCollege && (
                                            <div className="text-xs text-amber-600 font-bold mt-1">
                                                ⚠ College Mismatch: {student.college}
                                            </div>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <div className="text-sm">{student.year || "3rd Year"}</div>
                                        <div className="text-xs text-muted-foreground">UG Delegate</div>
                                    </TableCell>
                                    <TableCell>{student.mobile}</TableCell>
                                    <TableCell>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-8 gap-1"
                                            onClick={() => window.open(student.idProofUrl || "https://placehold.co/600x400?text=ID+Proof", "_blank")}
                                        >
                                            <FileText className="w-3 h-3" /> View ID
                                        </Button>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button
                                                size="sm"
                                                className="bg-green-600 hover:bg-green-700 h-8"
                                                onClick={() => handleApprove(student)}
                                            >
                                                <CheckCircle className="w-3 h-3 mr-1" /> Approve
                                            </Button>
                                            <Button
                                                variant="destructive"
                                                size="sm"
                                                className="h-8"
                                                onClick={() => handleRejectInit(student)}
                                            >
                                                <XCircle className="w-3 h-3 mr-1" /> Reject
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            <Dialog open={rejectDialog} onOpenChange={setRejectDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Reject Registration</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Reason for Rejection</Label>
                            <Textarea
                                placeholder="e.g. ID proof unclear, incorrect details..."
                                value={rejectionReason}
                                onChange={(e) => setRejectionReason(e.target.value)}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setRejectDialog(false)}>Cancel</Button>
                        <Button variant="destructive" onClick={handleRejectConfirm}>Confirm Rejection</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
