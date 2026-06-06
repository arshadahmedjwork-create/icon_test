
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
import { Plus, Search, Trash2, Mail } from "lucide-react";
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
        </div>
    );
}
