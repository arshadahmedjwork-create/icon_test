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
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import { Search, FileSpreadsheet, Filter } from "lucide-react";
import { getJudges } from "@/services/supabaseService";
import { Judge } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useProgram } from "@/contexts/ProgramContext";

export default function JudgeDatabase() {
    const [judges, setJudges] = useState<Judge[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [typeFilter, setTypeFilter] = useState<string>("all");
    const { toast } = useToast();
    const { currentProgram } = useProgram();

    useEffect(() => {
        const loadJudges = async () => {
            const data = await getJudges(currentProgram);
            setJudges(data);
        };
        loadJudges();
    }, [currentProgram]);

    const handleExport = () => {
        const headers = ["Name", "Specialization", "Type", "Affiliation", "Email", "Contact", "Status"];
        const csvContent = [
            headers.join(","),
            ...judges.map(j => [
                `"${j.name}"`,
                `"${j.specialization}"`,
                `"${j.type}"`,
                `"${j.affiliation}"`,
                `"${j.email}"`,
                `"${j.contact}"`,
                `"${j.status}"`
            ].join(","))
        ].join("\n");

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `midas_judges_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        toast({ title: "Exported", description: "Judge database downloaded successfully." });
    };

    const filteredJudges = judges.filter(j => {
        const matchesSearch =
            j.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            j.specialization.toLowerCase().includes(searchQuery.toLowerCase()) ||
            j.affiliation.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesType = typeFilter === "all" || j.type === typeFilter;

        return matchesSearch && matchesType;
    });

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold font-display">Judge Database</h1>
                    <p className="text-muted-foreground">Directory of all registered judges and their details.</p>
                </div>
                <Button variant="outline" onClick={handleExport}>
                    <FileSpreadsheet className="w-4 h-4 mr-2" /> Export CSV
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center">
                        <div className="space-y-1">
                            <CardTitle>Judge List</CardTitle>
                            <CardDescription>
                                Total {judges.length} judges registered in the system.
                            </CardDescription>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
                            <div className="relative w-full lg:w-64">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search judges..."
                                    className="pl-8 w-full"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                            <Select value={typeFilter} onValueChange={setTypeFilter}>
                                <SelectTrigger className="w-full sm:w-[140px]">
                                    <Filter className="w-4 h-4 mr-2" />
                                    <SelectValue placeholder="Type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Types</SelectItem>
                                    <SelectItem value="Academic">Academic</SelectItem>
                                    <SelectItem value="Non-Academic">Non-Academic</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border overflow-x-auto w-full">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="min-w-[120px]">Name</TableHead>
                                    <TableHead className="min-w-[120px]">Specialization</TableHead>
                                    <TableHead className="min-w-[100px]">Type</TableHead>
                                    <TableHead className="min-w-[140px]">Affiliation</TableHead>
                                    <TableHead className="min-w-[160px]">Contact Info</TableHead>
                                    <TableHead className="min-w-[100px]">Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredJudges.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
                                            No judges found matching your criteria.
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
                                                <div className="space-y-1">
                                                    <div className="text-xs">{judge.email}</div>
                                                    <div className="text-xs text-muted-foreground">{judge.contact}</div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${judge.status === "Available" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"
                                                    }`}>
                                                    {judge.status}
                                                </span>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
