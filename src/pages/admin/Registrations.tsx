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
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import { CheckCircle2, Search, XCircle, FileSpreadsheet, ExternalLink, RefreshCw, Pencil } from "lucide-react";
import { getEventStudents, updateEventStudent } from "@/services/supabaseService";
import { sendApprovalEmail } from "@/services/emailService";
import bcrypt from "bcryptjs";
import { Student } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { useProgram } from "@/contexts/ProgramContext";
import { supabase } from "@/lib/supabaseClient";
import { verifyDciCertificate } from "@/services/dciService";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export default function AdminRegistrations() {
    const [students, setStudents] = useState<Student[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [paymentFilter, setPaymentFilter] = useState("ALL");
    const { toast } = useToast();
    const { currentProgram } = useProgram();
    const isIcon = currentProgram === 'ICON';

    const [editingStudent, setEditingStudent] = useState<Student | null>(null);
    const [saving, setSaving] = useState(false);
    const [editForm, setEditForm] = useState({
        participantName: "",
        email: "",
        mobile: "",
        college: "",
        dciNumber: "",
        delegateType: "",
        paymentStatus: "PENDING",
        approvalStatus: "PENDING",
    });

    const handleOpenEdit = (student: Student) => {
        setEditingStudent(student);
        setEditForm({
            participantName: student.participantName || student.name || "",
            email: student.email || "",
            mobile: student.mobile || student.phone || "",
            college: student.college || "",
            dciNumber: student.dciNumber || "",
            delegateType: student.delegateType || "",
            paymentStatus: student.paymentStatus || "PENDING",
            approvalStatus: student.approvalStatus || "PENDING",
        });
    };

    const handleSaveEdit = async () => {
        if (!editingStudent) return;
        setSaving(true);
        try {
            await updateEventStudent(editingStudent.id, {
                participantName: editForm.participantName,
                email: editForm.email,
                mobile: editForm.mobile,
                college: editForm.college,
                dciNumber: editForm.dciNumber,
                delegateType: editForm.delegateType,
                paymentStatus: editForm.paymentStatus,
                approvalStatus: editForm.approvalStatus,
            });

            toast({ title: "Updated", description: "Student registration updated successfully." });
            setEditingStudent(null);
            loadData();
        } catch (error: any) {
            console.error(error);
            toast({ title: "Error", description: error.message || "Failed to update registration.", variant: "destructive" });
        } finally {
            setSaving(false);
        }
    };

    const handleTriggerOCR = async (studentId: string) => {
        try {
            toast({ title: "Processing OCR", description: "Verifying DCI certificate..." });
            const result = await verifyDciCertificate(studentId);
            if (!result.success) {
                throw new Error("Verification failed");
            }
            toast({ title: "OCR Completed", description: `Result: ${result.status || 'Success'}` });
            loadData();
        } catch (error: any) {
            console.error(error);
            toast({ title: "OCR Failed", description: error.message || "Failed to process certificate.", variant: "destructive" });
            loadData();
        }
    };

    useEffect(() => {
        loadData();
    }, [currentProgram]);

    const loadData = async () => {
        try {
            const data = await getEventStudents(currentProgram);
            setStudents(data);
        } catch (error) {
            console.error("Failed to load students", error);
            toast({ title: "Error", description: "Failed to load registrations.", variant: "destructive" });
        }
    };

    const handleApprove = async (id: string, currentStatus: string) => {
        if (currentStatus === "APPROVED") return;

        try {
            const student = students.find(s => s.id === id);
            if (!student) return;

            // Generate a random 8-character password
            const tempPassword = Math.random().toString(36).slice(-8);
            const hashedPassword = await bcrypt.hash(tempPassword, 10);

            await updateEventStudent(id, {
                approvalStatus: "APPROVED",
                password: hashedPassword,
                mustChangePassword: true
            });

            // Send Email
            try {
                await sendApprovalEmail({
                    student_name: student.name,
                    student_email: student.email,
                    temp_password: tempPassword,
                    login_url: window.location.origin + "/member-login"
                });
                toast({ title: "Approved", description: "Student registration approved and notified." });
            } catch (emailError) {
                console.error("Email failed:", emailError);
                toast({ title: "Approved (Email Failed)", description: "Approved, but email failed to send.", variant: "destructive" });
            }

            loadData();
        } catch (error) {
            console.error(error);
            toast({ title: "Error", description: "Failed to approve student.", variant: "destructive" });
        }
    };

    const handleReject = async (id: string, currentStatus: string) => {
        if (currentStatus === "REJECTED") return;

        try {
            await updateEventStudent(id, { approvalStatus: "REJECTED" });
            toast({ title: "Rejected", description: "Student registration rejected." });
            loadData();
        } catch (error) {
            console.error(error);
            toast({ title: "Error", description: "Failed to reject student.", variant: "destructive" });
        }
    };

    const handleExport = () => {
        const headers = [isIcon ? "ICON ID" : "MIDAS ID", "Name", "Email", "Phone", "College", "Payment Status", "Approval Status", "Date"];
        const csvContent = [
            headers.join(","),
            ...filteredStudents.map(s => [
                `"${s.midasId || ''}"`,
                `"${s.name}"`,
                `"${s.email}"`,
                `"${s.phone}"`,
                `"${s.college}"`,
                `"${s.paymentStatus}"`,
                `"${s.approvalStatus || 'PENDING'}"`,
                `"${new Date(s.createdAt).toLocaleDateString()}"`
            ].join(","))
        ].join("\n");

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `registrations_export_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    };

    const filteredStudents = students.filter(s => {
        const matchesSearch = (s.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
            (s.email || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
            (s.midasId || "").toLowerCase().includes(searchQuery.toLowerCase());

        const matchesStatus = statusFilter === "ALL" || (s.approvalStatus || "PENDING") === statusFilter;
        const matchesPayment = paymentFilter === "ALL" || s.paymentStatus === paymentFilter;

        return matchesSearch && matchesStatus && matchesPayment;
    });

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold font-display">{isIcon ? 'ICON' : 'MIDAS'} Registration Management</h2>
                    <p className="text-muted-foreground">View and approve student registrations.</p>
                </div>
                <Button variant="outline" size="sm" onClick={handleExport}>
                    <FileSpreadsheet className="w-4 h-4 mr-2" /> Export CSV
                </Button>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex items-center gap-2 flex-1">
                    <Search className="w-4 h-4 text-muted-foreground" />
                    <Input
                        placeholder={`Search by name, email or ${isIcon ? 'ICON' : 'MIDAS'} ID...`}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="max-w-sm"
                    />
                </div>
                <div className="flex gap-2">
                    <Select value={paymentFilter} onValueChange={setPaymentFilter}>
                        <SelectTrigger className="w-[140px]">
                            <SelectValue placeholder="Payment" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">All Payments</SelectItem>
                            <SelectItem value="PAID">Paid</SelectItem>
                            <SelectItem value="PENDING">Pending</SelectItem>
                        </SelectContent>
                    </Select>

                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-[140px]">
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">All Statuses</SelectItem>
                            <SelectItem value="APPROVED">Approved</SelectItem>
                            <SelectItem value="PENDING">Pending</SelectItem>
                            <SelectItem value="REJECTED">Rejected</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="border rounded-lg overflow-hidden bg-white">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Student</TableHead>
                            <TableHead>Contact / Mobile</TableHead>
                            <TableHead>College</TableHead>
                            <TableHead>Bonafide</TableHead>
                            {isIcon && (
                                <>
                                    <TableHead>DCI Number</TableHead>
                                    <TableHead>DCI Certificate</TableHead>
                                </>
                            )}
                            <TableHead>Payment</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredStudents.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={isIcon ? 9 : 7} className="text-center h-24 text-muted-foreground">
                                    No registrations found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredStudents.map((student) => (
                                <TableRow key={student.id}>
                                    <TableCell>
                                        <div className="font-medium">{student.name}</div>
                                        <div className="text-xs text-muted-foreground">{student.midasId || "No ID yet"}</div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="text-sm">{student.email}</div>
                                        <div className="text-xs font-semibold text-slate-700 mt-0.5">{student.phone || "—"}</div>
                                    </TableCell>
                                    <TableCell className="max-w-[200px] truncate" title={student.college}>
                                        {student.college}
                                    </TableCell>
                                    <TableCell>
                                        {student.idProofUrl ? (
                                            <a href={student.idProofUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 bg-blue-50 px-2 py-1 rounded-md border border-blue-100 hover:underline">
                                                View <ExternalLink className="w-3 h-3" />
                                            </a>
                                        ) : (
                                            <span className="text-xs text-muted-foreground italic">Not uploaded</span>
                                        )}
                                    </TableCell>
                                    {isIcon && (
                                        <>
                                            <TableCell className="font-mono text-sm">
                                                {student.dciNumber || <span className="text-xs text-muted-foreground italic">—</span>}
                                            </TableCell>
                                            <TableCell>
                                                {student.dciCertificateUrl ? (
                                                    <div className="flex flex-col gap-1.5 items-start">
                                                        <a href={student.dciCertificateUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 bg-blue-50 px-2 py-1 rounded-md border border-blue-100 hover:underline">
                                                            View Certificate <ExternalLink className="w-3 h-3" />
                                                        </a>
                                                        {((student as any).dciVerificationStatus === 'VERIFIED') ? (
                                                            <Badge className="bg-green-100 text-green-800 border-none font-bold text-[10px] py-0.5 px-1.5">OCR: Match</Badge>
                                                        ) : ((student as any).dciVerificationStatus === 'FAILED') ? (
                                                            <div className="flex items-center gap-1.5">
                                                                <Badge variant="destructive" className="font-bold text-[10px] py-0.5 px-1.5">OCR: Mismatch</Badge>
                                                                <Button variant="outline" size="icon" className="w-6 h-6 rounded-md" onClick={() => handleTriggerOCR(student.id)} title="Retry OCR"><RefreshCw className="w-3.5 h-3.5" /></Button>
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center gap-1.5">
                                                                <Badge className="bg-amber-100 text-amber-800 border-none font-bold text-[10px] py-0.5 px-1.5">OCR: Pending</Badge>
                                                                <Button variant="outline" size="icon" className="w-6 h-6 rounded-md" onClick={() => handleTriggerOCR(student.id)} title="Verify OCR"><RefreshCw className="w-3.5 h-3.5" /></Button>
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-muted-foreground italic">—</span>
                                                )}
                                            </TableCell>
                                        </>
                                    )}
                                    <TableCell>
                                        <Badge variant="outline" className={student.paymentStatus === "PAID" ? "bg-green-50 text-green-700 border-green-200" : "bg-yellow-50 text-yellow-700 border-yellow-200"}>
                                            {student.paymentStatus}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className={
                                            (student.approvalStatus || "PENDING") === "APPROVED" ? "bg-green-50 text-green-700 border-green-200" :
                                                (student.approvalStatus || "PENDING") === "REJECTED" ? "bg-red-50 text-red-700 border-red-200" :
                                                    "bg-blue-50 text-blue-700 border-blue-200"
                                        }>
                                            {student.approvalStatus || "PENDING"}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleOpenEdit(student)}
                                                className="text-slate-600 hover:text-slate-700 hover:bg-slate-50"
                                            >
                                                <Pencil className="w-4 h-4 mr-1" /> Edit
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleApprove(student.id, student.approvalStatus || "PENDING")}
                                                disabled={(student.approvalStatus || "PENDING") === "APPROVED"}
                                                className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                            >
                                                <CheckCircle2 className="w-4 h-4 mr-1" /> Approve
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleReject(student.id, student.approvalStatus || "PENDING")}
                                                disabled={(student.approvalStatus || "PENDING") === "REJECTED"}
                                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                            >
                                                <XCircle className="w-4 h-4 mr-1" /> Reject
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Edit Dialog */}
            <Dialog open={!!editingStudent} onOpenChange={(open) => !open && setEditingStudent(null)}>
                <DialogContent className="sm:max-w-lg rounded-3xl p-6">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold">Edit Registration</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4 my-4 max-h-[60vh] overflow-y-auto px-1">
                        <div className="space-y-1.5">
                            <Label htmlFor="edit-name">Participant Name</Label>
                            <Input
                                id="edit-name"
                                value={editForm.participantName}
                                onChange={(e) => setEditForm({ ...editForm, participantName: e.target.value })}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="edit-email">Email Address</Label>
                            <Input
                                id="edit-email"
                                type="email"
                                value={editForm.email}
                                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="edit-mobile">Mobile Number</Label>
                            <Input
                                id="edit-mobile"
                                value={editForm.mobile}
                                onChange={(e) => setEditForm({ ...editForm, mobile: e.target.value })}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="edit-college">College</Label>
                            <Input
                                id="edit-college"
                                value={editForm.college}
                                onChange={(e) => setEditForm({ ...editForm, college: e.target.value })}
                            />
                        </div>

                        {isIcon && (
                            <>
                                <div className="space-y-1.5">
                                    <Label htmlFor="edit-dci">DCI Number</Label>
                                    <Input
                                        id="edit-dci"
                                        value={editForm.dciNumber}
                                        onChange={(e) => setEditForm({ ...editForm, dciNumber: e.target.value })}
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="edit-delegate-type">Delegate Type</Label>
                                    <Select 
                                        value={editForm.delegateType} 
                                        onValueChange={(val) => setEditForm({ ...editForm, delegateType: val })}
                                    >
                                        <SelectTrigger id="edit-delegate-type">
                                            <SelectValue placeholder="Select Type" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="PG">Postgraduate (PG)</SelectItem>
                                            <SelectItem value="Academician">Academician</SelectItem>
                                            <SelectItem value="Clinician">Clinician</SelectItem>
                                            <SelectItem value="Guest">Guest</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label htmlFor="edit-payment">Payment Status</Label>
                                <Select 
                                    value={editForm.paymentStatus} 
                                    onValueChange={(val) => setEditForm({ ...editForm, paymentStatus: val })}
                                >
                                    <SelectTrigger id="edit-payment">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="PENDING">Pending</SelectItem>
                                        <SelectItem value="PAID">Paid</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="edit-approval">Approval Status</Label>
                                <Select 
                                    value={editForm.approvalStatus} 
                                    onValueChange={(val) => setEditForm({ ...editForm, approvalStatus: val })}
                                >
                                    <SelectTrigger id="edit-approval">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="PENDING">Pending</SelectItem>
                                        <SelectItem value="APPROVED">Approved</SelectItem>
                                        <SelectItem value="REJECTED">Rejected</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="flex gap-2">
                        <Button variant="outline" onClick={() => setEditingStudent(null)} className="rounded-xl">
                            Cancel
                        </Button>
                        <Button onClick={handleSaveEdit} disabled={saving} className="rounded-xl">
                            {saving ? "Saving..." : "Save Changes"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
