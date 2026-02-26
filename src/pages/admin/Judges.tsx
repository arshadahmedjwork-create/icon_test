
import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
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
import { Checkbox } from "@/components/ui/checkbox";
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
import { Plus, Search, Trash2, Edit, FileSpreadsheet } from "lucide-react";
import { getJudges, addJudge, updateJudge, deleteJudge } from "@/services/supabaseService";
import { Judge, JudgeType } from "@/types";
import { useToast } from "@/hooks/use-toast";

export default function AdminJudges() {
    const [searchParams] = useSearchParams();
    const [judges, setJudges] = useState<Judge[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingJudge, setEditingJudge] = useState<Judge | null>(null);
    const { toast } = useToast();

    const [formData, setFormData] = useState<Partial<Judge>>({
        name: "",
        specialization: "",
        type: "Academic",
        affiliation: "",
        contact: "",
        email: "",
        status: "Available",
        timeSlots: [],
    });

    useEffect(() => {
        loadJudges();
        if (searchParams.get("action") === "add") {
            setIsDialogOpen(true);
        }
    }, [searchParams]);

    const loadJudges = async () => {
        try {
            const data = await getJudges();
            setJudges(data);
        } catch (error) {
            console.error("Failed to load judges", error);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            if (editingJudge) {
                await updateJudge(editingJudge.id, formData);
                toast({ title: "Success", description: "Judge updated successfully" });
            } else {
                await addJudge(formData as Judge);
                toast({ title: "Success", description: "Judge added successfully" });
            }

            setIsDialogOpen(false);
            setEditingJudge(null);
            setFormData({
                name: "",
                specialization: "",
                type: "Academic",
                affiliation: "",
                contact: "",
                email: "",
                status: "Available",
                timeSlots: [],
            });
            loadJudges();
        } catch (error) {
            console.error(error);
            toast({ title: "Error", description: "Failed to save judge.", variant: "destructive" });
        }
    };

    const handleEdit = (judge: Judge) => {
        setEditingJudge(judge);
        setFormData(judge);
        setIsDialogOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (confirm("Are you sure you want to delete this judge?")) {
            try {
                await deleteJudge(id);
                toast({ title: "Deleted", description: "Judge removed successfully" });
                loadJudges();
            } catch (error) {
                console.error(error);
                toast({ title: "Error", description: "Failed to delete judge.", variant: "destructive" });
            }
        }
    };

    const handleExport = () => {
        const headers = ["Name", "Specialization", "Type", "Affiliation", "Email", "Contact", "Time Slots"];
        const csvContent = [
            headers.join(","),
            ...judges.map(j => [
                `"${j.name}"`,
                `"${j.specialization}"`,
                `"${j.type}"`,
                `"${j.affiliation}"`,
                `"${j.email}"`,
                `"${j.contact}"`,
                `"${(j.timeSlots || []).join(" | ")}"`
            ].join(","))
        ].join("\n");

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `judges_export_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        toast({ title: "Exported", description: "Judge list downloaded successfully." });
    };

    const filteredJudges = judges.filter(j =>
        j.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        j.specialization.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold font-display">Judge Management</h2>
                    <p className="text-muted-foreground">Manage judge profiles and assignments.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleExport}>
                        <FileSpreadsheet className="w-4 h-4 mr-2" /> Export
                    </Button>
                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                        <DialogTrigger asChild>
                            <Button size="sm" onClick={() => { setEditingJudge(null); setFormData({}); }}>
                                <Plus className="w-4 h-4 mr-2" /> Add Judge
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[425px]">
                            <DialogHeader>
                                <DialogTitle>{editingJudge ? "Edit Judge" : "Add New Judge"}</DialogTitle>
                            </DialogHeader>
                            <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="name">Full Name</Label>
                                    <Input
                                        id="name"
                                        value={formData.name || ""}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="type">Type</Label>
                                        <Select
                                            value={formData.type}
                                            onValueChange={(val: JudgeType) => setFormData({ ...formData, type: val })}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select type" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Academic">Academic</SelectItem>
                                                <SelectItem value="Non-Academic">Non-Academic</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="specialization">Specialization</Label>
                                        <Input
                                            id="specialization"
                                            value={formData.specialization || ""}
                                            onChange={e => setFormData({ ...formData, specialization: e.target.value })}
                                            required
                                        />
                                    </div>
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="affiliation">Affiliation (College/Hospital)</Label>
                                    <Input
                                        id="affiliation"
                                        value={formData.affiliation || ""}
                                        onChange={e => setFormData({ ...formData, affiliation: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="email">Email</Label>
                                        <Input
                                            id="email"
                                            type="email"
                                            value={formData.email || ""}
                                            onChange={e => setFormData({ ...formData, email: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="contact">Phone</Label>
                                        <Input
                                            id="contact"
                                            value={formData.contact || ""}
                                            onChange={e => setFormData({ ...formData, contact: e.target.value })}
                                            required
                                        />
                                    </div>
                                </div>
                                <div className="grid gap-2">
                                    <Label>Preferred Time Slots</Label>
                                    <div className="flex flex-wrap gap-4">
                                        {["Morning", "Afternoon", "Whole Day"].map((slot) => (
                                            <div key={slot} className="flex items-center space-x-2">
                                                <Checkbox
                                                    id={`slot-${slot}`}
                                                    checked={(formData.timeSlots || []).includes(slot)}
                                                    onCheckedChange={(checked) => {
                                                        const current = formData.timeSlots || [];
                                                        if (checked) {
                                                            setFormData({ ...formData, timeSlots: [...current, slot] });
                                                        } else {
                                                            setFormData({ ...formData, timeSlots: current.filter(s => s !== slot) });
                                                        }
                                                    }}
                                                />
                                                <Label htmlFor={`slot-${slot}`} className="font-normal cursor-pointer">
                                                    {slot}
                                                </Label>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <Button type="submit" className="w-full">
                                    {editingJudge ? "Update Judge" : "Create Judge"}
                                </Button>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            <div className="flex items-center gap-2 max-w-sm">
                <Search className="w-4 h-4 text-muted-foreground" />
                <Input
                    placeholder="Search by name or specialization..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>

            <div className="border rounded-lg overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Specialization</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Affiliation</TableHead>
                            <TableHead>Contact</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredJudges.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
                                    No judges found. Add one to get started.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredJudges.map((judge) => (
                                <TableRow key={judge.id}>
                                    <TableCell className="font-medium">{judge.name}</TableCell>
                                    <TableCell>{judge.specialization}</TableCell>
                                    <TableCell>
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${judge.type === "Academic" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"
                                            }`}>
                                            {judge.type}
                                        </span>
                                    </TableCell>
                                    <TableCell>{judge.affiliation}</TableCell>
                                    <TableCell>
                                        <div className="text-xs">
                                            <div>{judge.email}</div>
                                            <div className="text-muted-foreground">{judge.contact}</div>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button variant="ghost" size="icon" onClick={() => handleEdit(judge)}>
                                                <Edit className="w-4 h-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleDelete(judge.id)}>
                                                <Trash2 className="w-4 h-4" />
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
