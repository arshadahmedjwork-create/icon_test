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
import { CheckCircle2, Search, XCircle, FileSpreadsheet, ExternalLink } from "lucide-react";
import { getEventStudents, updateEventStudent } from "@/services/supabaseService";
import { sendApprovalEmail } from "@/services/emailService";
import bcrypt from "bcryptjs";
import { Student } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { useProgram } from "@/contexts/ProgramContext";

export default function AdminRegistrations() {
    const [students, setStudents] = useState<Student[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [paymentFilter, setPaymentFilter] = useState("ALL");
    const { toast } = useToast();
    const { currentProgram } = useProgram();
    const isIcon = currentProgram === 'ICON';

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
                                                    <a href={student.dciCertificateUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 bg-blue-50 px-2 py-1 rounded-md border border-blue-100 hover:underline">
                                                        View Certificate <ExternalLink className="w-3 h-3" />
                                                    </a>
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
        </div>
    );
}
