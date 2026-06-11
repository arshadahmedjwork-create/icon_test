import { useState, useEffect, useRef } from "react";
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
import { CheckCircle2, Search, XCircle, FileSpreadsheet, ExternalLink, RefreshCw, Pencil, Upload, AlertTriangle, Mail } from "lucide-react";
import { getEventStudents, updateEventStudent, addEventStudent, getCollegesList, bulkAddEventStudents } from "@/services/supabaseService";
import { sendApprovalEmail, sendAccountCreationEmail } from "@/services/emailService";
import * as XLSX from "xlsx";
import bcrypt from "bcryptjs";
import { Student } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { useProgram } from "@/contexts/ProgramContext";
import { supabase } from "@/lib/supabaseClient";
import { verifyDciCertificate } from "@/services/dciService";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
const indianStates = [
    "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat",
    "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh",
    "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab",
    "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh",
    "Uttarakhand", "West Bengal", "Andaman and Nicobar Islands", "Chandigarh",
    "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Jammu and Kashmir",
    "Ladakh", "Lakshadweep", "Puducherry"
];

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
        registrationId: "",
    });

    const [addDialogOpen, setAddDialogOpen] = useState(false);
    const [collegesList, setCollegesList] = useState<{ value: string, label: string }[]>([]);

    useEffect(() => {
        const fetchColleges = async () => {
            try {
                const list = await getCollegesList();
                setCollegesList(list);
            } catch (err) {
                console.error("Failed to load colleges list", err);
            }
        };
        fetchColleges();
    }, []);

    const [newStudentForm, setNewStudentForm] = useState({
        participantName: "",
        email: "",
        mobile: "",
        college: "",
        course: "",
        year: "",
        delegateType: "",
        dciNumber: "",
        speciality: "",
        state: "",
        registrationId: "",
    });

    const fileInputRef = useRef<HTMLInputElement>(null);
    const [bulkUploadDialogOpen, setBulkUploadDialogOpen] = useState(false);
    const [bulkValidData, setBulkValidData] = useState<any[]>([]);
    const [bulkErrors, setBulkErrors] = useState<{ rowNum: number; name: string; missingFields: string[] }[]>([]);
    const [bulkTotalCount, setBulkTotalCount] = useState(0);
    const [isUploadingBulk, setIsUploadingBulk] = useState(false);

    const handleBulkUploadClick = () => {
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
        fileInputRef.current?.click();
    };

    const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const bstr = evt.target?.result;
                const workbook = XLSX.read(bstr, { type: "binary" });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const rows = XLSX.utils.sheet_to_json(worksheet) as any[];

                if (rows.length === 0) {
                    toast({ title: "Empty File", description: "No records found in the selected file.", variant: "destructive" });
                    return;
                }

                // Query existing emails and mobiles in DB to prevent conflicts
                const { data: dbStudents } = await supabase.from('event_students').select('email, mobile');
                const existingEmails = new Set((dbStudents || []).map(s => String(s.email || "").toLowerCase().trim()));
                const existingMobiles = new Set((dbStudents || []).map(s => String(s.mobile || "").trim()));
                const seenEmailsInFile = new Set<string>();
                const seenMobilesInFile = new Set<string>();

                const findKey = (row: any, candidates: string[]) => {
                    const keys = Object.keys(row);
                    for (const cand of candidates) {
                        const found = keys.find(k => k.toLowerCase().replace(/[\s_\-]/g, "") === cand.toLowerCase().replace(/[\s_\-]/g, ""));
                        if (found) return found;
                    }
                    return null;
                };

                const validRecords: any[] = [];
                const errorsList: typeof bulkErrors = [];

                rows.forEach((row, index) => {
                    const nameKey = findKey(row, ["name", "participantname", "fullname"]);
                    const emailKey = findKey(row, ["email", "emailaddress"]);
                    const mobileKey = findKey(row, ["mobile", "mobilenumber", "phone", "phonenumber"]);
                    const collegeKey = findKey(row, ["college", "institution", "collegename"]);
                    const yearKey = findKey(row, ["year", "yearofstudy", "mdsyear", "currentyear"]);
                    const regIdKey = findKey(row, ["registrationid", "regid", "id", "registrationno", "regno"]);

                    const nameVal = nameKey ? String(row[nameKey] || "").trim() : "";
                    const emailVal = emailKey ? String(row[emailKey] || "").trim() : "";
                    const mobileVal = mobileKey ? String(row[mobileKey] || "").trim() : "";
                    const collegeVal = collegeKey ? String(row[collegeKey] || "").trim() : "";
                    const yearVal = yearKey ? String(row[yearKey] || "").trim() : "";
                    const regIdVal = regIdKey ? String(row[regIdKey] || "").trim() : "";

                    const rowNumber = index + 2;
                    const emailLower = emailVal.toLowerCase();

                    const criticalMissing: string[] = [];
                    if (!nameVal) criticalMissing.push("Name");
                    if (!emailVal) criticalMissing.push("Email");
                    if (!mobileVal) criticalMissing.push("Mobile");

                    if (criticalMissing.length > 0) {
                        errorsList.push({
                            rowNum: rowNumber,
                            name: nameVal || "Unnamed Profile",
                            missingFields: criticalMissing,
                        });
                    } else if (existingEmails.has(emailLower)) {
                        errorsList.push({
                            rowNum: rowNumber,
                            name: nameVal,
                            missingFields: ["EMAIL ALREADY EXISTS"],
                        });
                    } else if (existingMobiles.has(mobileVal)) {
                        errorsList.push({
                            rowNum: rowNumber,
                            name: nameVal,
                            missingFields: ["MOBILE ALREADY EXISTS"],
                        });
                    } else if (seenEmailsInFile.has(emailLower)) {
                        errorsList.push({
                            rowNum: rowNumber,
                            name: nameVal,
                            missingFields: ["DUPLICATE EMAIL IN FILE"],
                        });
                    } else if (seenMobilesInFile.has(mobileVal)) {
                        errorsList.push({
                            rowNum: rowNumber,
                            name: nameVal,
                            missingFields: ["DUPLICATE MOBILE IN FILE"],
                        });
                    } else {
                        seenEmailsInFile.add(emailLower);
                        seenMobilesInFile.add(mobileVal);
                        
                        validRecords.push({
                            participantName: nameVal,
                            email: emailVal,
                            mobile: mobileVal,
                            college: collegeVal || "",
                            year: yearVal || "",
                            registrationId: regIdVal || null,
                            program: currentProgram,
                        });

                        const profileMissing: string[] = [];
                        if (!collegeVal) profileMissing.push("COLLEGE");
                        if (!yearVal) profileMissing.push("YEAR");

                        if (profileMissing.length > 0) {
                            errorsList.push({
                                rowNum: rowNumber,
                                name: nameVal,
                                missingFields: profileMissing,
                            });
                        }
                    }
                });

                setBulkTotalCount(rows.length);
                setBulkValidData(validRecords);
                setBulkErrors(errorsList);
                setBulkUploadDialogOpen(true);

            } catch (err) {
                console.error("Error reading file:", err);
                toast({ title: "Error", description: "Failed to parse CSV/Excel file.", variant: "destructive" });
            }
        };

        reader.readAsBinaryString(file);
    };

    const handleConfirmBulkUpload = async () => {
        if (bulkValidData.length === 0) return;
        setIsUploadingBulk(true);
        try {
            const res = await bulkAddEventStudents(bulkValidData);
            toast({
                title: "Upload Successful",
                description: `Successfully imported ${res.count} registrations.`,
            });
            setBulkUploadDialogOpen(false);
            loadData();
        } catch (err: any) {
            console.error("Failed bulk uploading:", err);
            toast({
                title: "Upload Failed",
                description: err.message || "An error occurred during bulk upload.",
                variant: "destructive"
            });
        } finally {
            setIsUploadingBulk(false);
        }
    };

    const [sendingEmails, setSendingEmails] = useState(false);

    const handleSendBulkEmails = async () => {
        const targetStudents = students.filter(s => {
            const id = s.midasId || "";
            return id !== "ICON-2026-0001" && id !== "ICON-2026-0002" && s.approvalStatus === "APPROVED";
        });

        if (targetStudents.length === 0) {
            toast({ title: "No Eligible Students", description: "No approved students found (excluding ICON-2026-0001 and ICON-2026-0002)." });
            return;
        }

        if (!confirm(`Are you sure you want to send credentials emails to ${targetStudents.length} students (excluding ICON-2026-0001 and ICON-2026-0002)?`)) {
            return;
        }

        setSendingEmails(true);
        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < targetStudents.length; i++) {
            const student = targetStudents[i];
            const tempPassword = student.phone || student.mobile || "";
            
            try {
                toast({
                    title: `Sending Emails (${i + 1}/${targetStudents.length})`,
                    description: `Sending to ${student.name} (${student.email})...`,
                });

                await sendAccountCreationEmail({
                    user_name: student.name || student.participantName || "",
                    user_email: student.email,
                    temp_password: tempPassword,
                    login_url: window.location.origin + "/member-login"
                });
                successCount++;
            } catch (err) {
                console.error(`Failed to send email to ${student.email}:`, err);
                failCount++;
            }

            await new Promise(resolve => setTimeout(resolve, 300));
        }

        setSendingEmails(false);
        toast({
            title: "Process Completed",
            description: `Emails sent successfully to ${successCount} students. Failed: ${failCount}.`,
        });
    };

    const handleAddStudent = async () => {
        if (!newStudentForm.participantName.trim() || !newStudentForm.email.trim() || !newStudentForm.mobile.trim() || !newStudentForm.college.trim()) {
            toast({ title: "Validation Error", description: "Name, email, mobile, and college are required.", variant: "destructive" });
            return;
        }
        setSaving(true);
        try {
            const { student, tempPassword } = await addEventStudent({
                ...newStudentForm,
                program: currentProgram,
            });

            try {
                await sendAccountCreationEmail({
                    user_name: student.participantName,
                    user_email: student.email,
                    temp_password: tempPassword,
                    login_url: window.location.origin + "/member-login"
                });
            } catch (emailErr) {
                console.error("Manual registration email failed:", emailErr);
            }

            toast({ title: "Student Added", description: "Registered successfully. An email with login credentials has been sent to the student." });
            setAddDialogOpen(false);
            setNewStudentForm({
                participantName: "",
                email: "",
                mobile: "",
                college: "",
                course: "",
                year: "",
                delegateType: "",
                dciNumber: "",
                speciality: "",
                state: "",
                registrationId: "",
            });
            loadData();
        } catch (error: any) {
            console.error(error);
            toast({ title: "Error", description: error.message || "Failed to add student.", variant: "destructive" });
        } finally {
            setSaving(false);
        }
    };

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
            registrationId: student.registrationId || "",
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
                registrationId: editForm.registrationId || null,
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
                <div className="flex gap-2">
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileSelected}
                        className="hidden"
                        accept=".csv, .xlsx, .xls"
                    />
                    <Button variant="outline" size="sm" onClick={handleBulkUploadClick}>
                        <Upload className="w-4 h-4 mr-2" /> Bulk Upload
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleSendBulkEmails} disabled={sendingEmails} className="border-primary/50 text-primary hover:text-primary-foreground hover:bg-primary">
                        <Mail className="w-4 h-4 mr-2" /> {sendingEmails ? "Sending..." : "Send Welcome Emails"}
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleExport}>
                        <FileSpreadsheet className="w-4 h-4 mr-2" /> Export CSV
                    </Button>
                    <Button size="sm" onClick={() => setAddDialogOpen(true)} className="bg-primary hover:bg-primary/95 text-white">
                        Add Student
                    </Button>
                </div>
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
                                        {student.registrationId && (
                                            <div className="text-[10px] text-primary/70 font-semibold mt-0.5">Reg ID: {student.registrationId}</div>
                                        )}
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
                            <Label htmlFor="edit-reg-id">Registration ID (Optional)</Label>
                            <Input
                                id="edit-reg-id"
                                value={editForm.registrationId}
                                onChange={(e) => setEditForm({ ...editForm, registrationId: e.target.value })}
                            />
                        </div>
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

            {/* Add Student Dialog */}
            <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
                <DialogContent className="sm:max-w-lg rounded-3xl p-6">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold">Add Student (Paid & Approved)</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4 my-4 max-h-[60vh] overflow-y-auto px-1">
                        <div className="space-y-1.5">
                            <Label htmlFor="add-reg-id">Registration ID (Optional)</Label>
                            <Input
                                id="add-reg-id"
                                value={newStudentForm.registrationId}
                                onChange={(e) => setNewStudentForm({ ...newStudentForm, registrationId: e.target.value })}
                                placeholder="e.g. PD001"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="add-name">Participant Name *</Label>
                            <Input
                                id="add-name"
                                value={newStudentForm.participantName}
                                onChange={(e) => setNewStudentForm({ ...newStudentForm, participantName: e.target.value })}
                                placeholder="Enter full name"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="add-email">Email Address *</Label>
                            <Input
                                id="add-email"
                                type="email"
                                value={newStudentForm.email}
                                onChange={(e) => setNewStudentForm({ ...newStudentForm, email: e.target.value })}
                                placeholder="Enter email"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="add-mobile">Mobile Number *</Label>
                            <Input
                                id="add-mobile"
                                value={newStudentForm.mobile}
                                onChange={(e) => setNewStudentForm({ ...newStudentForm, mobile: e.target.value })}
                                placeholder="Enter 10-digit mobile"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="add-college">College / Institution *</Label>
                            <Select 
                                value={newStudentForm.college} 
                                onValueChange={(val) => setNewStudentForm({ ...newStudentForm, college: val })}
                            >
                                <SelectTrigger id="add-college">
                                    <SelectValue placeholder="Select College" />
                                </SelectTrigger>
                                <SelectContent>
                                    {collegesList.map((c) => (
                                        <SelectItem key={c.value} value={c.label}>
                                            {c.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {isIcon ? (
                            <>
                                <div className="space-y-1.5">
                                    <Label htmlFor="add-delegate-type">Delegate Type</Label>
                                    <Select 
                                        value={newStudentForm.delegateType} 
                                        onValueChange={(val) => setNewStudentForm({ ...newStudentForm, delegateType: val })}
                                    >
                                        <SelectTrigger id="add-delegate-type">
                                            <SelectValue placeholder="Select Type" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="PG">Postgraduate (PG)</SelectItem>
                                            <SelectItem value="Academician">Academician</SelectItem>
                                            <SelectItem value="Clinician">Clinician</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="add-dci">DCI Number</Label>
                                    <Input
                                        id="add-dci"
                                        value={newStudentForm.dciNumber}
                                        onChange={(e) => setNewStudentForm({ ...newStudentForm, dciNumber: e.target.value })}
                                        placeholder="Optional DCI number"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="add-state">State</Label>
                                    <Select 
                                        value={newStudentForm.state} 
                                        onValueChange={(val) => setNewStudentForm({ ...newStudentForm, state: val })}
                                    >
                                        <SelectTrigger id="add-state">
                                            <SelectValue placeholder="Select State" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {indianStates.map((s) => (
                                                <SelectItem key={s} value={s}>
                                                    {s}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <Label htmlFor="add-course">Course</Label>
                                        <Select 
                                            value={newStudentForm.course} 
                                            onValueChange={(val) => setNewStudentForm({ ...newStudentForm, course: val })}
                                        >
                                            <SelectTrigger id="add-course">
                                                <SelectValue placeholder="Select Course" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="BDS">BDS</SelectItem>
                                                <SelectItem value="MDS">MDS</SelectItem>
                                                <SelectItem value="Other">Other</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label htmlFor="add-year">Year</Label>
                                        <Select 
                                            value={newStudentForm.year} 
                                            onValueChange={(val) => setNewStudentForm({ ...newStudentForm, year: val })}
                                        >
                                            <SelectTrigger id="add-year">
                                                <SelectValue placeholder="Select Year" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="1st Year">1st Year</SelectItem>
                                                <SelectItem value="2nd Year">2nd Year</SelectItem>
                                                <SelectItem value="3rd Year">3rd Year</SelectItem>
                                                <SelectItem value="4th Year">4th Year</SelectItem>
                                                <SelectItem value="Intern">Intern</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    <DialogFooter className="flex gap-2">
                        <Button variant="outline" onClick={() => setAddDialogOpen(false)} className="rounded-xl">
                            Cancel
                        </Button>
                        <Button onClick={handleAddStudent} disabled={saving} className="rounded-xl">
                            {saving ? "Registering..." : "Add & Approve"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Bulk Upload Summary Dialog */}
            <Dialog open={bulkUploadDialogOpen} onOpenChange={setBulkUploadDialogOpen}>
                <DialogContent className="sm:max-w-2xl rounded-3xl p-6">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold flex items-center gap-2">
                            <Upload className="w-5 h-5 text-primary" />
                            Bulk Upload Summary
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-6 my-4">
                        <div className="grid grid-cols-3 gap-4">
                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-center">
                                <div className="text-2xl font-bold text-slate-800">{bulkTotalCount}</div>
                                <div className="text-xs text-muted-foreground mt-1">Total Found</div>
                            </div>
                            <div className="bg-green-50/50 p-4 rounded-2xl border border-green-100 text-center">
                                <div className="text-2xl font-bold text-green-600">{bulkValidData.length}</div>
                                <div className="text-xs text-green-700 mt-1">Valid (Ready)</div>
                            </div>
                            <div className="bg-red-50/50 p-4 rounded-2xl border border-red-100 text-center">
                                <div className="text-2xl font-bold text-red-600">{bulkErrors.length}</div>
                                <div className="text-xs text-red-700 mt-1">Missing Data</div>
                            </div>
                        </div>

                        {bulkErrors.length > 0 && (
                            <div className="space-y-3">
                                <div className="flex items-center gap-2 text-amber-600 font-semibold text-sm">
                                    <AlertTriangle className="w-4 h-4" />
                                    <span>Validation Alerts: Missing Required Data</span>
                                </div>
                                <div className="border border-red-100 rounded-2xl overflow-hidden max-h-[200px] overflow-y-auto bg-red-50/10">
                                    <table className="w-full text-left text-xs border-collapse">
                                        <thead>
                                            <tr className="bg-red-50 border-b border-red-100 text-red-800 font-semibold">
                                                <th className="p-2.5">Row</th>
                                                <th className="p-2.5">User Name</th>
                                                <th className="p-2.5">Missing Fields</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {bulkErrors.map((err, i) => (
                                                <tr key={i} className="border-b border-red-50/50 text-slate-700 hover:bg-red-50/20">
                                                    <td className="p-2.5 font-medium">Row {err.rowNum}</td>
                                                    <td className="p-2.5 font-medium">{err.name}</td>
                                                    <td className="p-2.5">
                                                        <div className="flex flex-wrap gap-1">
                                                            {err.missingFields.map((f, fi) => (
                                                                <Badge key={fi} variant="destructive" className="text-[10px] py-0 px-1.5 uppercase font-bold">{f}</Badge>
                                                            ))}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {bulkValidData.length === 0 ? (
                            <div className="bg-red-50 text-red-800 p-4 rounded-2xl border border-red-100 text-center text-sm font-medium">
                                No valid records found to import. Please correct the fields in your file and try again.
                            </div>
                        ) : bulkErrors.length > 0 ? (
                            <div className="bg-amber-50 text-amber-800 p-4 rounded-2xl border border-amber-100 text-sm">
                                Some rows are missing college or year. We will upload all <strong>{bulkValidData.length} records</strong>. These {bulkErrors.length} users will be prompted to provide missing college/year details upon login.
                            </div>
                        ) : (
                            <div className="bg-green-50 text-green-800 p-4 rounded-2xl border border-green-100 text-sm text-center font-medium">
                                All {bulkTotalCount} records are fully valid and ready to import!
                            </div>
                        )}
                    </div>

                    <DialogFooter className="flex gap-2">
                        <Button variant="outline" onClick={() => setBulkUploadDialogOpen(false)} className="rounded-xl">
                            Cancel
                        </Button>
                        <Button
                            onClick={handleConfirmBulkUpload}
                            disabled={bulkValidData.length === 0 || isUploadingBulk}
                            className="rounded-xl"
                        >
                            {isUploadingBulk ? "Importing..." : `Proceed with ${bulkValidData.length} Uploads`}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
