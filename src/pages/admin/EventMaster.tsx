import { useState, useEffect } from "react";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    CardFooter
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter
} from "@/components/ui/dialog";
import { getEvents, addEvent, updateEvent, deleteEvent } from "@/services/supabaseService";
import { Event, EvaluationCriteria } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Edit, Calendar, Users, Settings, PlusCircle } from "lucide-react";
import { useProgram } from "@/contexts/ProgramContext";

export default function AdminEventMaster() {
    const [events, setEvents] = useState<Event[]>([]);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingEvent, setEditingEvent] = useState<Event | null>(null);
    const { toast } = useToast();
    const { currentProgram } = useProgram();

    // Form State
    const [name, setName] = useState("");
    const [type, setType] = useState("Paper");
    const [mode, setMode] = useState("Online");
    const [capacity, setCapacity] = useState<number>(20);
    const [rules, setRules] = useState("");
    const [judgeInstructions, setJudgeInstructions] = useState("");
    const [abstractDeadline, setAbstractDeadline] = useState("");
    const [presentationDeadline, setPresentationDeadline] = useState("");
    const [criterias, setCriterias] = useState<EvaluationCriteria[]>([
        { id: "1", name: "Content", maxScore: 10, weightage: 50 },
        { id: "2", name: "Delivery", maxScore: 10, weightage: 50 }
    ]);

    useEffect(() => {
        loadEvents();
    }, [currentProgram]);

    const loadEvents = async () => {
        try {
            const data = await getEvents(currentProgram);
            setEvents(data);
        } catch (error) {
            console.error("Failed to load events", error);
        }
    };

    const handleOpenDialog = (event?: Event) => {
        if (event) {
            setEditingEvent(event);
            setName(event.name);
            setType(event.type);
            setMode(event.mode);
            setCapacity(event.capacity);
            setRules(event.rules);
            setJudgeInstructions(event.judgeInstructions);
            setAbstractDeadline(event.abstractDeadline ? new Date(event.abstractDeadline).toISOString().slice(0, 16) : "");
            setPresentationDeadline(event.presentationDeadline ? new Date(event.presentationDeadline).toISOString().slice(0, 16) : "");
            setCriterias(event.criterias || []);
        } else {
            setEditingEvent(null);
            setName(currentProgram === 'ICON' ? "Postgraduate Presentation" : "");
            setType("Paper");
            setMode(currentProgram === 'ICON' ? "Offline" : "Online");
            setCapacity(20);
            setRules("");
            setJudgeInstructions("");
            setAbstractDeadline("");
            setPresentationDeadline("");
            setCriterias([
                { id: Date.now().toString(), name: "Content", maxScore: 10, weightage: 50 },
                { id: (Date.now() + 1).toString(), name: "Delivery", maxScore: 10, weightage: 50 }
            ]);
        }
        setIsDialogOpen(true);
    };

    const handleSave = async () => {
        if (!name.trim()) {
            toast({ title: "Validation Error", description: "Event name is required.", variant: "destructive" });
            return;
        }

        const eventData = {
            name,
            type: type,
            mode: currentProgram === 'ICON' ? "OFFLINE" : mode.toUpperCase(),
            capacity, rules, judgeInstructions,
            abstractDeadline: abstractDeadline ? new Date(abstractDeadline).toISOString() : null as any,
            presentationDeadline: presentationDeadline ? new Date(presentationDeadline).toISOString() : null as any,
            criterias,
            program: currentProgram
        };

        try {
            if (editingEvent) {
                await updateEvent(editingEvent.id, eventData);
                toast({ title: "Event Updated", description: "Event configured successfully." });
            } else {
                await addEvent(eventData);
                toast({ title: "Event Created", description: "New event created successfully." });
            }
            setIsDialogOpen(false);
            loadEvents();
        } catch (error) {
            console.error(error);
            toast({ title: "Error", description: "Failed to save event.", variant: "destructive" });
        }
    };

    const handleDelete = async (id: string) => {
        if (confirm("Are you sure you want to delete this event? This action cannot be undone.")) {
            try {
                await deleteEvent(id);
                toast({ title: "Event Deleted", description: "The event has been removed." });
                loadEvents();
            } catch (error) {
                console.error(error);
                toast({ title: "Error", description: "Failed to delete event.", variant: "destructive" });
            }
        }
    };

    const addCriteria = () => {
        setCriterias([...criterias, { id: Date.now().toString(), name: "New Criteria", maxScore: 10, weightage: 0 }]);
    };
    const updateCriteria = (index: number, field: keyof EvaluationCriteria, val: string | number) => {
        const newC = [...criterias];
        newC[index] = { ...newC[index], [field]: val };
        setCriterias(newC);
    };
    const removeCriteria = (index: number) => {
        setCriterias(criterias.filter((_, i) => i !== index));
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center border-b pb-4">
                <div>
                    <h2 className="text-2xl font-bold font-display">{currentProgram === 'ICON' ? 'ICON' : 'MIDAS'} Event Master</h2>
                    <p className="text-muted-foreground">Create and manage {currentProgram === 'ICON' ? 'Madras ICON' : 'MIDAS'} conference events, capacities, and rules.</p>
                </div>
                <Button onClick={() => handleOpenDialog()} className="gap-2">
                    <Plus className="w-4 h-4" /> Create New Event
                </Button>
            </div>

            {events.length === 0 ? (
                <div className="text-center py-12 bg-secondary/30 rounded-2xl border border-dashed border-border">
                    <Settings className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                    <h3 className="text-lg font-semibold mb-1">No Events Configured</h3>
                    <p className="text-muted-foreground mb-4">You haven't added any presentation events yet.</p>
                    <Button onClick={() => handleOpenDialog()} variant="outline">Create Your First Event</Button>
                </div>
            ) : (
                <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {events.map(event => (
                        <Card key={event.id} className="hover:shadow-md transition-shadow flex flex-col">
                            <CardHeader className="pb-3 border-b">
                                <div className="flex justify-between items-start">
                                    <CardTitle className="text-lg font-bold leading-tight">{event.name}</CardTitle>
                                    <div className="flex gap-1">
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => handleOpenDialog(event)}>
                                            <Edit className="w-4 h-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(event.id)}>
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                                <div className="flex gap-2 mt-2">
                                    <Badge variant="secondary">{event.type}</Badge>
                                    <Badge variant="outline">{event.mode}</Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="py-4 flex-1 space-y-4">
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground flex items-center gap-1.5"><Users className="w-4 h-4" /> Capacity</span>
                                    <span className="font-semibold">{event.capacity} Students / Session</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground flex items-center gap-1.5"><Settings className="w-4 h-4" /> Evaluation</span>
                                    <span className="font-semibold">{event.criterias?.length || 0} Criteria</span>
                                </div>
                                <div className="space-y-2 pt-2 border-t">
                                    <div className="flex justify-between text-sm text-foreground">
                                        <span className="text-muted-foreground text-xs uppercase tracking-wider font-bold">Abstracts</span>
                                        <span className="text-xs">{event.abstractDeadline ? new Date(event.abstractDeadline).toLocaleDateString() : 'Not set'}</span>
                                    </div>
                                    <div className="flex justify-between text-sm text-foreground">
                                        <span className="text-muted-foreground text-xs uppercase tracking-wider font-bold">Presentations</span>
                                        <span className="text-xs">{event.presentationDeadline ? new Date(event.presentationDeadline).toLocaleDateString() : 'Not set'}</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* CREATE / EDIT DIALOG */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editingEvent ? "Edit Event Configuration" : "Create New Event"}</DialogTitle>
                    </DialogHeader>

                    <div className="grid md:grid-cols-2 gap-8 py-4">
                        {/* Basic Info Column */}
                        <div className="space-y-4">
                            <h3 className="font-semibold border-b pb-2">Basic Details</h3>

                            <div className="space-y-2">
                                <Label>Event Name</Label>
                                {currentProgram === 'ICON' ? (
                                    <select
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                        value={name}
                                        onChange={e => setName(e.target.value)}
                                    >
                                        <option value="">Select Event Category</option>
                                        <option value="Postgraduate Presentation">Postgraduate Presentation</option>
                                        <option value="Faculty Presentation">Faculty Presentation</option>
                                        <option value="Clinician Presentation">Clinician Presentation</option>
                                    </select>
                                ) : (
                                    <Input placeholder="e.g. Undergrad Poster Presentation" value={name} onChange={e => setName(e.target.value)} />
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Presentation Type</Label>
                                    <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={type} onChange={e => setType(e.target.value)}>
                                        <option value="Paper">Paper</option>
                                        <option value="Poster">Poster</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Execution Mode</Label>
                                    <select
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-60"
                                        value={currentProgram === 'ICON' ? 'Offline' : mode}
                                        onChange={e => setMode(e.target.value)}
                                        disabled={currentProgram === 'ICON'}
                                    >
                                        {currentProgram === 'ICON' ? (
                                            <>
                                                <option value="Offline">Offline</option>
                                                <option value="Online" disabled>Online (Coming Soon)</option>
                                            </>
                                        ) : (
                                            <>
                                                <option value="Online">Online</option>
                                                <option value="Offline">Offline</option>
                                            </>
                                        )}
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Capacity (Participant per session)</Label>
                                <Input type="number" value={capacity} onChange={e => setCapacity(parseInt(e.target.value) || 0)} />
                            </div>

                            <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                                <div className="space-y-2">
                                    <Label>Abstract Deadline</Label>
                                    <Input type="datetime-local" value={abstractDeadline} onChange={e => setAbstractDeadline(e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Final PPT Upload Deadline</Label>
                                    <Input type="datetime-local" value={presentationDeadline} onChange={e => setPresentationDeadline(e.target.value)} />
                                </div>
                            </div>
                        </div>

                        {/* Rules & Rubric Column */}
                        <div className="space-y-4">
                            <h3 className="font-semibold border-b pb-2">Rules & Guidelines</h3>
                            <div className="space-y-2">
                                <Label>Student Rules & Instructions</Label>
                                <Textarea className="h-24 resize-none" placeholder="Enter rules for students..." value={rules} onChange={e => setRules(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>Judge Guidelines</Label>
                                <Textarea className="h-24 resize-none" placeholder="Instructions specifically for the judges evaluating..." value={judgeInstructions} onChange={e => setJudgeInstructions(e.target.value)} />
                            </div>

                            <div className="pt-4 flex justify-between items-center border-t">
                                <Label className="text-base font-semibold">Assessment Criteria</Label>
                                <Button size="sm" variant="outline" onClick={addCriteria} className="h-7 text-xs gap-1"><PlusCircle className="w-3 h-3" /> Add Criteria</Button>
                            </div>

                            <div className="space-y-3 max-h-[250px] overflow-y-auto pr-2">
                                {criterias.map((c, i) => (
                                    <div key={i} className="flex items-center gap-2 bg-secondary/50 p-2 rounded-md">
                                        <Input className="h-8 text-xs flex-1" placeholder="Criterion Name" value={c.name} onChange={e => updateCriteria(i, 'name', e.target.value)} />
                                        <Input className="h-8 text-xs w-16" type="number" placeholder="Max" value={c.maxScore} onChange={e => updateCriteria(i, 'maxScore', parseInt(e.target.value) || 0)} title="Max Score" />
                                        <Input className="h-8 text-xs w-16" type="number" placeholder="Wt %" value={c.weightage} onChange={e => updateCriteria(i, 'weightage', parseInt(e.target.value) || 0)} title="Weightage %" />
                                        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => removeCriteria(i)}><Trash2 className="w-3 h-3" /></Button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="mt-4">
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleSave}>Save Event Config</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
