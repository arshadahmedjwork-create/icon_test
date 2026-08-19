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
    DialogFooter
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
    CheckCircle,
    XCircle,
    Search,
    FileText,
    ExternalLink,
    ShieldCheck,
    CreditCard,
    UserCheck,
    Image as ImageIcon
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getEventStudents, updateEventStudent } from "@/services/supabaseService";
import { sendApprovalEmail } from "@/services/emailService";
import bcrypt from "bcryptjs";
import { Student } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { useProgram } from "@/contexts/ProgramContext";

export default function RegistrationApprovals() {
    const { user } = useAuth();
    const { currentProgram } = useProgram();
    const { toast } = useToast();
    const [searchQuery, setSearchQuery] = useState("");
    const [rejectDialog, setRejectDialog] = useState(false);
    const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
    const [detailStudent, setDetailStudent] = useState<any | null>(null);
    const [rejectionReason, setRejectionReason] = useState("");
    const [students, setStudents] = useState<Student[]>([]);

    useEffect(() => {
        loadStudents();
    }, [user, currentProgram]);

    const loadStudents = async () => {
        try {
            const data = await getEventStudents(currentProgram);
            if (user?.role === 'staff' && user.college) {
                setStudents(data.filter((s: Student) => s.college === user.college));
            } else {
                setStudents(data);
            }
        } catch (error) {
            console.error("Failed to load students", error);
            toast({ title: "Error", description: "Failed to load student registrations.", variant: "destructive" });
        }
    };

    const staffCollege = user?.college;
    const pendingStudents = students.filter(s =>
        (s.college === staffCollege || !staffCollege) && 
        s.approvalStatus === "PENDING" &&
        s.program === currentProgram
    );

    const handleApprove = async (student: any) => {
        try {
            const tempPassword = Math.random().toString(36).slice(-8);
            const hashedPassword = await bcrypt.hash(tempPassword, 10);

            await updateEventStudent(student.id, {
                approvalStatus: "APPROVED",
                password: hashedPassword
            });

            try {
                await sendApprovalEmail({
                    student_name: student.participantName || student.name,
                    student_email: student.email,
                    temp_password: tempPassword,
                    login_url: window.location.origin + "/member-login"
                });
                toast({ title: "Approved", description: `${student.participantName || student.name} is approved and notified.` });
            } catch (emailError) {
                console.error("Email failed:", emailError);
                toast({ title: "Approved (Email Failed)", description: `${student.participantName || student.name} approved, but email failed to send.`, variant: "destructive" });
            }

            setStudents(prev => prev.map(u => u.id === student.id ? { ...u, approvalStatus: "APPROVED" } : u));
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
                toast({ title: "Rejected", description: `${selectedStudent.participantName || selectedStudent.name} registration rejected.` });

                setStudents(prev => prev.map(u => u.id === selectedStudent.id ? { ...u, approvalStatus: "REJECTED" } : u));

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
        (s.participantName || s.name || "")?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.idCardNumber || "")?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-bold font-display">Pending Registrations & Undertaking Verification</h2>
                    <p className="text-muted-foreground">Verify ID Card Numbers, Passport Photos, Payment status, and signed Undertakings for students from {staffCollege || "all colleges"}.</p>
                </div>
            </div>

            <div className="flex items-center gap-2 max-w-sm">
                <Search className="w-4 h-4 text-muted-foreground" />
                <Input
                    placeholder="Search name, email, ID Card Number..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>

            <div className="border rounded-xl overflow-hidden bg-white shadow-sm">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Student</TableHead>
                            <TableHead>ID Card / Gender</TableHead>
                            <TableHead>Passport Photo</TableHead>
                            <TableHead>Payment & Undertaking</TableHead>
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
                                        <div className="font-medium text-slate-900">{student.participantName || student.name}</div>
                                        <div className="text-xs text-muted-foreground">{student.email}</div>
                                        <div className="text-xs text-slate-500 font-medium">{student.college} • {student.year}</div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="font-mono text-xs font-bold text-slate-800">{student.idCardNumber || "—"}</div>
                                        <div className="text-xs text-slate-500">{student.gender || "—"}</div>
                                    </TableCell>
                                    <TableCell>
                                        {student.passportPhotoUrl ? (
                                            <a href={student.passportPhotoUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-emerald-700 hover:underline bg-emerald-50 px-2 py-1 rounded-md border border-emerald-200">
                                                <ImageIcon className="w-3.5 h-3.5" /> View Photo
                                            </a>
                                        ) : (
                                            <span className="text-xs text-muted-foreground italic">No photo</span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <div className="space-y-1">
                                            <Badge variant="outline" className={student.paymentStatus === "PAID" ? "bg-green-50 text-green-700 border-green-200" : "bg-amber-50 text-amber-700 border-amber-200"}>
                                                <CreditCard className="w-3 h-3 mr-1" /> {student.paymentStatus === "PAID" ? "PAID (₹1,030)" : "UNPAID"}
                                            </Badge>
                                            {student.declarationAccepted && (
                                                <div className="flex items-center gap-1 text-[11px] text-emerald-700 font-semibold">
                                                    <ShieldCheck className="w-3 h-3 text-emerald-600" /> Signed Undertaking v{student.termsVersion || "1.0"}
                                                </div>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-8 text-xs"
                                                onClick={() => setDetailStudent(student)}
                                            >
                                                Details
                                            </Button>
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

            {/* Student Details Dialog */}
            <Dialog open={!!detailStudent} onOpenChange={(open) => !open && setDetailStudent(null)}>
                <DialogContent className="sm:max-w-lg rounded-3xl p-6">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold flex items-center gap-2">
                            <UserCheck className="w-5 h-5 text-emerald-700" /> Student Verification Record
                        </DialogTitle>
                    </DialogHeader>

                    {detailStudent && (
                        <div className="space-y-4 my-2 text-xs">
                            <div className="grid grid-cols-2 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                                <div>
                                    <span className="text-slate-400 font-semibold block">Full Name</span>
                                    <span className="font-bold text-slate-800 text-sm">{detailStudent.participantName || detailStudent.name}</span>
                                </div>
                                <div>
                                    <span className="text-slate-400 font-semibold block">ID Card Number</span>
                                    <span className="font-mono font-bold text-slate-900">{detailStudent.idCardNumber || "—"}</span>
                                </div>
                                <div>
                                    <span className="text-slate-400 font-semibold block">Gender</span>
                                    <span className="font-semibold text-slate-800">{detailStudent.gender || "—"}</span>
                                </div>
                                <div>
                                    <span className="text-slate-400 font-semibold block">Assigned MIDAS ID</span>
                                    <span className="font-mono font-bold text-emerald-700">{detailStudent.midasId || "Pending"}</span>
                                </div>
                                <div>
                                    <span className="text-slate-400 font-semibold block">College</span>
                                    <span className="font-semibold text-slate-800">{detailStudent.college}</span>
                                </div>
                                <div>
                                    <span className="text-slate-400 font-semibold block">Year</span>
                                    <span className="font-semibold text-slate-800">{detailStudent.year}</span>
                                </div>
                            </div>

                            {/* Documents */}
                            <div className="space-y-2">
                                <h4 className="font-bold text-slate-900">Uploaded Documents</h4>
                                <div className="flex flex-wrap gap-2">
                                    {detailStudent.passportPhotoUrl && (
                                        <a href={detailStudent.passportPhotoUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-800 px-3 py-1.5 rounded-xl border border-emerald-200 font-semibold">
                                            <ImageIcon className="w-4 h-4" /> Passport Photo <ExternalLink className="w-3 h-3" />
                                        </a>
                                    )}
                                    {detailStudent.idProofUrl && (
                                        <a href={detailStudent.idProofUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-800 px-3 py-1.5 rounded-xl border border-blue-200 font-semibold">
                                            <FileText className="w-4 h-4" /> Bonafide / ID Proof <ExternalLink className="w-3 h-3" />
                                        </a>
                                    )}
                                </div>
                            </div>

                            {/* Undertaking Audit Trail */}
                            <div className="bg-emerald-50/60 border border-emerald-200 p-4 rounded-2xl space-y-2">
                                <h4 className="font-bold text-emerald-900 flex items-center gap-1.5 text-sm">
                                    <ShieldCheck className="w-4 h-4 text-emerald-700" /> Undertaking & Legal Acceptance Record
                                </h4>
                                <div className="space-y-1 text-emerald-900">
                                    <p>✓ Declaration of Authenticity: <strong className="text-emerald-700">Accepted</strong></p>
                                    <p>✓ Terms & Conditions: <strong className="text-emerald-700">Accepted (v{detailStudent.termsVersion || "1.0"})</strong></p>
                                    <p>✓ Refund Policy (Non-refundable): <strong className="text-emerald-700">Accepted (v{detailStudent.refundPolicyVersion || "1.0"})</strong></p>
                                    {detailStudent.acceptedAt && (
                                        <p className="text-[11px] text-emerald-700 font-mono mt-1">
                                            Signed Timestamp: {new Date(detailStudent.acceptedAt).toLocaleString("en-IN")}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button onClick={() => setDetailStudent(null)} className="rounded-xl">Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Reject Dialog */}
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
