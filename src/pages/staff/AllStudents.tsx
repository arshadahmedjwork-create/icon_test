import { useState, useEffect } from "react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Search, Mail, Phone, MapPin, ExternalLink, GraduationCap, Calendar, CreditCard } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { useProgram } from "@/contexts/ProgramContext";

export default function AllStudents() {
    const { user } = useAuth();
    const { currentProgram } = useProgram();
    const [students, setStudents] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
    
    const isIcon = currentProgram === 'ICON';

    useEffect(() => {
        loadStudents();
    }, [user, currentProgram]);

    const loadStudents = async () => {
        if (!user) return;
        try {
            let query = supabase.from('event_students').select('*').eq('program', currentProgram).order('registeredAt', { ascending: false });
            if (user.role === 'staff' && user.college) {
                query = query.eq('college', user.college);
            }
            const { data, error } = await query;
            if (error) throw error;
            setStudents(data || []);
        } catch (error) {
            console.error("Failed to load students", error);
        }
    };

    const filteredStudents = students.filter(s =>
        s.participantName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.midasId?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-xl font-bold font-display">All Students</h2>
                    <p className="text-muted-foreground text-sm">View comprehensive details of all students registered from your college.</p>
                </div>
            </div>

            <div className="flex items-center gap-4 max-w-sm">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        placeholder={`Search by name, email, or ${isIcon ? 'ICON' : 'MIDAS'} ID...`}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9"
                    />
                </div>
            </div>

            <div className="border border-border rounded-xl bg-card overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Student</TableHead>
                            <TableHead>Contact</TableHead>
                            <TableHead>Program</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredStudents.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center h-32 text-muted-foreground">
                                    No students found matching your search.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredStudents.map((student) => (
                                <TableRow key={student.id}>
                                    <TableCell>
                                        <div className="font-semibold text-foreground">{student.participantName}</div>
                                        {student.midasId ? (
                                            <div className="text-xs font-mono text-primary font-semibold mt-0.5">{student.midasId}</div>
                                        ) : (
                                            <div className="text-xs text-muted-foreground mt-0.5">No {isIcon ? 'ICON' : 'MIDAS'} ID</div>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <div className="text-sm flex items-center gap-1.5"><Mail className="w-3 h-3 text-muted-foreground" />{student.email}</div>
                                        <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1"><Phone className="w-3 h-3" />{student.mobile || "N/A"}</div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="text-sm font-medium">{student.course || "N/A"}</div>
                                        <div className="text-xs text-muted-foreground">{student.year || "N/A"}</div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col gap-1 items-start">
                                            <Badge variant="outline" className={`text-[10px] ${student.approvalStatus === "APPROVED" ? "border-emerald-200 text-emerald-700 bg-emerald-50" :
                                                student.approvalStatus === "REJECTED" ? "border-red-200 text-red-700 bg-red-50" :
                                                    "border-amber-200 text-amber-700 bg-amber-50"
                                                }`}>
                                                {student.approvalStatus}
                                            </Badge>
                                            <Badge variant="outline" className={`text-[10px] ${student.paymentStatus === "PAID" ? "border-emerald-200 text-emerald-700 bg-emerald-50" :
                                                "border-slate-200 text-slate-500 bg-slate-50"
                                                }`}>
                                                {student.paymentStatus === "PAID" ? "PAID" : "UNPAID"}
                                            </Badge>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            className="h-8 text-xs gap-1.5"
                                            onClick={() => setSelectedStudent(student)}
                                        >
                                            <ExternalLink className="w-3.5 h-3.5" /> View Details
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            <Dialog open={!!selectedStudent} onOpenChange={(open) => !open && setSelectedStudent(null)}>
                <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden rounded-2xl">
                    {selectedStudent && (
                        <>
                            <div className="bg-gradient-to-r from-primary/10 to-primary/5 px-6 py-8 border-b border-border">
                                <div className="flex items-start justify-between">
                                    <div className="flex gap-4 items-center">
                                        <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-display text-2xl font-bold shadow-sm">
                                            {selectedStudent.participantName.charAt(0)}
                                        </div>
                                        <div>
                                            <h2 className="text-2xl font-bold font-display text-foreground">{selectedStudent.participantName}</h2>
                                            {selectedStudent.midasId && (
                                                <Badge variant="secondary" className="mt-1 font-mono tracking-widest text-primary border-primary/20 bg-primary/10">
                                                    {selectedStudent.midasId}
                                                </Badge>
                                            )}
                                        </div>
                                    </div>
                                    <Badge variant="outline" className={`px-3 py-1 text-xs border bg-background/50 backdrop-blur-sm shadow-sm ${selectedStudent.approvalStatus === "APPROVED" ? "border-emerald-300 text-emerald-700" :
                                        selectedStudent.approvalStatus === "REJECTED" ? "border-red-300 text-red-700" :
                                            "border-amber-300 text-amber-700"
                                        }`}>
                                        Registration: {selectedStudent.approvalStatus}
                                    </Badge>
                                </div>
                            </div>

                            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-6">
                                    <div>
                                        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                                            <img src="https://api.iconify.design/lucide:user.svg" className="w-3.5 h-3.5 opacity-50" alt="" />
                                            Contact Info
                                        </h4>
                                        <div className="space-y-3">
                                            <div className="flex items-start gap-3">
                                                <Mail className="w-4 h-4 text-muted-foreground mt-0.5" />
                                                <div className="text-sm font-medium">{selectedStudent.email}</div>
                                            </div>
                                            <div className="flex items-start gap-3">
                                                <Phone className="w-4 h-4 text-muted-foreground mt-0.5" />
                                                <div className="text-sm font-medium">{selectedStudent.mobile || "Not provided"}</div>
                                            </div>
                                            <div className="flex items-start gap-3">
                                                <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                                                <div className="text-sm font-medium">{selectedStudent.college || "Not provided"}</div>
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                                            <img src="https://api.iconify.design/lucide:graduation-cap.svg" className="w-3.5 h-3.5 opacity-50" alt="" />
                                            Academic
                                        </h4>
                                        <div className="space-y-3">
                                            <div className="flex items-start gap-3">
                                                <GraduationCap className="w-4 h-4 text-muted-foreground mt-0.5" />
                                                <div>
                                                    <div className="text-sm font-medium">{selectedStudent.course || "Not provided"}</div>
                                                    <div className="text-xs text-muted-foreground">{selectedStudent.year || "Not provided"} Year</div>
                                                </div>
                                            </div>
                                            {selectedStudent.dciNumber && (
                                                <div className="flex items-start gap-3">
                                                    <Badge variant="outline" className="text-[10px] opacity-70">DCI</Badge>
                                                    <div className="text-sm font-medium">{selectedStudent.dciNumber}</div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <div>
                                        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                                            <img src="https://api.iconify.design/lucide:ticket.svg" className="w-3.5 h-3.5 opacity-50" alt="" />
                                            Participation
                                        </h4>
                                        <div className="space-y-3">
                                            <div className="flex items-start gap-3">
                                                <CreditCard className="w-4 h-4 text-muted-foreground mt-0.5" />
                                                <div>
                                                    <div className="text-sm font-medium">Payment Status</div>
                                                    <div className={`text-xs font-bold ${selectedStudent.paymentStatus === 'PAID' ? 'text-emerald-600' : 'text-slate-500'}`}>
                                                        {selectedStudent.paymentStatus === 'PAID' ? 'COMPLETED' : 'PENDING'}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-3">
                                                <Calendar className="w-4 h-4 text-muted-foreground mt-0.5" />
                                                <div>
                                                    <div className="text-sm font-medium">Registered Events</div>
                                                    <ul className="text-xs text-muted-foreground mt-1 list-disc list-inside">
                                                        {selectedStudent.selectedEvents && selectedStudent.selectedEvents.length > 0
                                                            ? selectedStudent.selectedEvents.map((e: any, i: number) => (
                                                                <li key={i}>{e.type} — {e.subject}</li>
                                                            ))
                                                            : <li>No events selected</li>
                                                        }
                                                    </ul>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {selectedStudent.registeredAt && (
                                        <div className="bg-secondary/50 p-3 rounded-lg border border-border mt-auto">
                                            <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1">Registration Date</div>
                                            <div className="text-sm font-medium">
                                                {new Date(selectedStudent.registeredAt).toLocaleDateString('en-IN', {
                                                    weekday: 'short',
                                                    year: 'numeric',
                                                    month: 'long',
                                                    day: 'numeric',
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
