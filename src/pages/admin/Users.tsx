
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
import { Input } from "@/components/ui/input";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Plus, Search, Trash2, Mail, Upload, AlertTriangle } from "lucide-react";
import * as XLSX from "xlsx";
import { getUsers, createMember, deleteUser } from "@/services/supabaseService";
import { User, UserRole } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { sendAccountCreationEmail } from "@/services/emailService";
import { useProgram } from "@/contexts/ProgramContext";

// Role display mapping
const roleDisplayMap: Record<string, string> = {
    ADMIN: 'admin',
    CORE_SCIENTIFIC_TEAM: 'core_team',
    STAFF_COORDINATOR: 'staff',
    JUDGE: 'judge',
    VOLUNTEER: 'volunteer',
};
const reverseRoleMap: Record<string, string> = {
    admin: 'ADMIN',
    core_team: 'CORE_SCIENTIFIC_TEAM',
    staff: 'STAFF_COORDINATOR',
    judge: 'JUDGE',
    volunteer: 'VOLUNTEER',
};

const colleges = [
    "KLE VK Institute of Dental Sciences, Belagavi",
    "SDM College of Dental Sciences, Dharwad",
    "Government Dental College, Bangalore",
    "Bapuji Dental College, Davangere",
    "Manipal College of Dental Sciences",
    "Other"
];

// Generate a random temp password
const generateTempPassword = () => {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let pwd = '';
    for (let i = 0; i < 10; i++) pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    return pwd;
};

export default function AdminUsers() {
    const [users, setUsers] = useState<User[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const { toast } = useToast();
    const { currentProgram } = useProgram();
    const isIcon = currentProgram === 'ICON';

    const [formData, setFormData] = useState({
        name: "",
        email: "",
        role: "staff",
        college: "",
    });

    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isUploadingBulk, setIsUploadingBulk] = useState(false);
    const [bulkUploadDialogOpen, setBulkUploadDialogOpen] = useState(false);
    const [bulkValidData, setBulkValidData] = useState<any[]>([]);
    const [bulkErrors, setBulkErrors] = useState<any[]>([]);
    const [bulkTotalCount, setBulkTotalCount] = useState(0);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const bstr = evt.target?.result;
                const workbook = XLSX.read(bstr, { type: "binary" });
                const wsname = workbook.SheetNames[0];
                const ws = workbook.Sheets[wsname];
                const rows = XLSX.utils.sheet_to_json<any>(ws);

                if (rows.length === 0) {
                    toast({ title: "Empty File", description: "No rows found in the uploaded file.", variant: "destructive" });
                    return;
                }

                // Check for duplicates in DB
                const existingEmails = new Set(users.map(u => u.email.toLowerCase()));
                const seenEmailsInFile = new Set<string>();

                const validRecords: any[] = [];
                const errorsList: any[] = [];

                const findKey = (row: any, candidates: string[]) => {
                    return Object.keys(row).find(k => candidates.includes(k.toLowerCase().replace(/[\s_-]/g, "")));
                };

                rows.forEach((row, index) => {
                    const nameKey = findKey(row, ["name", "fullname", "username", "participantname"]);
                    const emailKey = findKey(row, ["email", "emailaddress"]);
                    const mobileKey = findKey(row, ["mobile", "phone", "mobilenumber", "phonenumber"]);
                    const roleKey = findKey(row, ["role", "userrole", "memberrole"]);
                    const collegeKey = findKey(row, ["college", "institution", "collegename"]);

                    const nameVal = nameKey ? String(row[nameKey] || "").trim() : "";
                    const emailVal = emailKey ? String(row[emailKey] || "").trim() : "";
                    const mobileVal = mobileKey ? String(row[mobileKey] || "").trim() : "";
                    const roleVal = roleKey ? String(row[roleKey] || "").trim() : "staff";
                    const collegeVal = collegeKey ? String(row[collegeKey] || "").trim() : "";

                    const rowNumber = index + 2;
                    const emailLower = emailVal.toLowerCase();

                    const criticalMissing: string[] = [];
                    if (!nameVal) criticalMissing.push("Name");
                    if (!emailVal) criticalMissing.push("Email");

                    // Normalize role
                    let normalizedRole = "STAFF_COORDINATOR";
                    const r = roleVal.toLowerCase().replace(/[\s_-]/g, "");
                    if (r === "admin") normalizedRole = "ADMIN";
                    else if (r === "coreteam" || r === "coreteamdetails" || r === "corescientificteam") normalizedRole = "CORE_SCIENTIFIC_TEAM";
                    else if (r === "staff" || r === "staffcoordinator") normalizedRole = "STAFF_COORDINATOR";
                    else if (r === "judge") normalizedRole = "JUDGE";
                    else if (r === "volunteer") normalizedRole = "VOLUNTEER";

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
                    } else if (seenEmailsInFile.has(emailLower)) {
                        errorsList.push({
                            rowNum: rowNumber,
                            name: nameVal,
                            missingFields: ["DUPLICATE EMAIL IN FILE"],
                        });
                    } else {
                        seenEmailsInFile.add(emailLower);
                        validRecords.push({
                            name: nameVal,
                            email: emailVal,
                            mobile: mobileVal,
                            role: normalizedRole,
                            college: collegeVal,
                        });
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
        // Reset file input value so same file can be selected again
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const handleConfirmBulkUpload = async () => {
        if (bulkValidData.length === 0) return;
        setIsUploadingBulk(true);
        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < bulkValidData.length; i++) {
            const userRecord = bulkValidData[i];
            const tempPassword = generateTempPassword();

            try {
                // 1. Create member in Supabase
                await createMember({
                    name: userRecord.name,
                    email: userRecord.email,
                    password: tempPassword,
                    role: userRecord.role,
                    staffCoordinatorCollege: userRecord.role === 'STAFF_COORDINATOR' ? userRecord.college : undefined,
                    program: currentProgram,
                });

                // 2. Send email with temp password
                const frontendRole = roleDisplayMap[userRecord.role] || userRecord.role;
                await sendAccountCreationEmail({
                    user_name: userRecord.name,
                    user_email: userRecord.email,
                    temp_password: tempPassword,
                    login_url: window.location.origin + "/member-login",
                    role: frontendRole
                });
                successCount++;
            } catch (err) {
                console.error(`Failed to bulk create user ${userRecord.email}:`, err);
                failCount++;
            }
        }

        setIsUploadingBulk(false);
        setBulkUploadDialogOpen(false);
        toast({
            title: "Upload Completed",
            description: `Successfully imported and emailed ${successCount} users. Failed: ${failCount}.`,
        });
        loadUsers();
    };

    useEffect(() => {
        loadUsers();
    }, [currentProgram]);

    const loadUsers = async () => {
        try {
            const data = await getUsers(currentProgram);
            setUsers(data);
        } catch (error) {
            console.error("Failed to load users", error);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.role || !formData.name || !formData.email) return;

        setIsCreating(true);
        try {
            const tempPassword = generateTempPassword();
            const backendRole = reverseRoleMap[formData.role] || formData.role;

            // Create member in Supabase with hashed password + mustChangePassword = true
            await createMember({
                name: formData.name,
                email: formData.email,
                password: tempPassword,
                role: backendRole,
                staffCoordinatorCollege: formData.role === 'staff' ? formData.college : undefined,
                program: currentProgram,
            });

            // Send email via EmailJS with temp password
            try {
                await sendAccountCreationEmail({
                    user_name: formData.name,
                    user_email: formData.email,
                    temp_password: tempPassword,
                    login_url: window.location.origin + "/member-login",
                    role: formData.role
                });
                toast({ title: "User Created", description: `Credentials sent to ${formData.email}` });
            } catch (emailError) {
                console.error("Email send failed:", emailError);
                toast({
                    title: "User Created",
                    description: `User created but email failed. Temp password: ${tempPassword}`,
                    variant: "destructive",
                });
            }

            setIsDialogOpen(false);
            setFormData({ name: "", email: "", role: "staff", college: "" });
            loadUsers();
        } catch (error: any) {
            console.error(error);
            toast({ title: "Error", description: error.message || "Failed to create user.", variant: "destructive" });
        } finally {
            setIsCreating(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (confirm("Revoke access for this user?")) {
            try {
                await deleteUser(id);
                loadUsers();
            } catch (error) {
                console.error(error);
                toast({ title: "Error", description: "Failed to delete user.", variant: "destructive" });
            }
        }
    };

    const filteredUsers = users.filter((u) =>
        u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold font-display">{isIcon ? 'ICON' : 'MIDAS'} User Management</h2>
                    <p className="text-muted-foreground">Manage {isIcon ? 'Madras ICON' : 'MIDAS'} system access and roles.</p>
                </div>
                <div className="flex gap-2">
                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept=".csv,.xlsx,.xls"
                        onChange={handleFileChange}
                    />
                    <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                        <Upload className="w-4 h-4 mr-2" /> Bulk Upload
                    </Button>
                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                        <DialogTrigger asChild>
                            <Button>
                                <Plus className="w-4 h-4 mr-2" /> Create User
                            </Button>
                        </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Create New User</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                            <div className="grid gap-2">
                                <Label>Full Name</Label>
                                <Input
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label>Email Address</Label>
                                <Input
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label>Role</Label>
                                <Select
                                    value={formData.role}
                                    onValueChange={(val: string) => setFormData({ ...formData, role: val })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select role" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="admin">Admin</SelectItem>
                                        <SelectItem value="core_team">Core Team</SelectItem>
                                        <SelectItem value="staff">Staff Coordinator</SelectItem>
                                        <SelectItem value="judge">Judge</SelectItem>
                                        <SelectItem value="volunteer">Volunteer</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            {formData.role === "staff" && (
                                <div className="grid gap-2">
                                    <Label>College Name</Label>
                                    <Select
                                        value={formData.college}
                                        onValueChange={(val: string) => setFormData({ ...formData, college: val })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select College" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {colleges.map((college) => (
                                                <SelectItem key={college} value={college}>{college}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                            <Button type="submit" className="w-full" disabled={isCreating}>
                                {isCreating ? "Creating..." : "Create Account & Send Email"}
                            </Button>
                        </form>
                    </DialogContent>
                </Dialog>
                </div>
            </div>

            <div className="bg-muted/10 p-4 rounded-lg border flex gap-4 items-center">
                <Mail className="w-5 h-5 text-primary" />
                <div className="text-sm">
                    <p className="font-medium">Auto-Email Enabled (EmailJS)</p>
                    <p className="text-muted-foreground">New users will receive their login credentials automatically via email.</p>
                </div>
            </div>

            <div className="flex items-center gap-2 max-w-sm">
                <Search className="w-4 h-4 text-muted-foreground" />
                <Input
                    placeholder="Search users..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>

            <div className="border rounded-lg overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>User</TableHead>
                            <TableHead>Role</TableHead>
                            <TableHead>Context</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredUsers.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                                    No users found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredUsers.map((user) => (
                                <TableRow key={user.id}>
                                    <TableCell>
                                        <div className="font-medium">{user.name}</div>
                                        <div className="text-xs text-muted-foreground">{user.email}</div>
                                    </TableCell>
                                    <TableCell>
                                        <span className="capitalize bg-secondary px-2 py-1 rounded text-xs font-medium">
                                            {user.role}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        {user.college || "-"}
                                    </TableCell>
                                    <TableCell>
                                        <span className={`${user.isActive ? 'text-green-600' : 'text-red-500'} text-xs font-medium flex items-center gap-1`}>
                                            <span className={`w-2 h-2 ${user.isActive ? 'bg-green-500' : 'bg-red-500'} rounded-full`}></span>
                                            {user.isActive ? 'Active' : 'Inactive'}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="sm" onClick={() => handleDelete(user.id)}>
                                            <Trash2 className="w-4 h-4 text-destructive" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
            {/* Bulk Upload Confirm Dialog */}
            <Dialog open={bulkUploadDialogOpen} onOpenChange={setBulkUploadDialogOpen}>
                <DialogContent className="sm:max-w-xl rounded-3xl p-6">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold">Bulk Upload Summary</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4 my-4 max-h-[60vh] overflow-y-auto px-1">
                        <div className="grid grid-cols-2 gap-4 text-center">
                            <div className="bg-slate-50 p-3 rounded-2xl">
                                <span className="block text-2xl font-bold text-slate-900">{bulkValidData.length}</span>
                                <span className="text-xs text-slate-500 font-medium">Valid Records to Import</span>
                            </div>
                            <div className="bg-slate-50 p-3 rounded-2xl">
                                <span className="block text-2xl font-bold text-red-500">{bulkErrors.length}</span>
                                <span className="text-xs text-slate-500 font-medium">Errors / Skipped Rows</span>
                            </div>
                        </div>

                        {bulkErrors.length > 0 && (
                            <div className="space-y-2">
                                <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                                    <AlertTriangle className="w-4 h-4 text-amber-500" /> Error Log (Will be skipped)
                                </h4>
                                <div className="border border-slate-100 rounded-xl overflow-hidden max-h-[200px] overflow-y-auto text-xs">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-slate-50 border-b border-slate-100 font-semibold text-slate-500">
                                                <th className="p-2">Row</th>
                                                <th className="p-2">Name</th>
                                                <th className="p-2">Reason</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {bulkErrors.map((err, idx) => (
                                                <tr key={idx} className="border-b border-slate-50 text-slate-600">
                                                    <td className="p-2 font-medium">#{err.rowNum}</td>
                                                    <td className="p-2">{err.name}</td>
                                                    <td className="p-2 text-red-500 font-medium">{err.missingFields.join(", ")}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        <div className="text-xs text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-100">
                            <p className="font-semibold text-slate-700 mb-1">Important Info:</p>
                            <ul className="list-disc pl-4 space-y-1">
                                <li>Account credentials emails will be automatically sent to all {bulkValidData.length} valid users.</li>
                                <li>Temporary random passwords will be generated for security.</li>
                            </ul>
                        </div>
                    </div>

                    <DialogFooter className="flex gap-2">
                        <Button variant="outline" onClick={() => setBulkUploadDialogOpen(false)} className="rounded-xl">
                            Cancel
                        </Button>
                        <Button 
                            onClick={handleConfirmBulkUpload} 
                            disabled={isUploadingBulk || bulkValidData.length === 0} 
                            className="rounded-xl bg-primary text-white"
                        >
                            {isUploadingBulk ? "Uploading & Emailing..." : `Import ${bulkValidData.length} Users`}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
