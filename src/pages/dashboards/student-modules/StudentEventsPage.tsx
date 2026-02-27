
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
    Calendar, MapPin, Clock, Users, CreditCard, CheckCircle2,
    ArrowRight, Search, Filter, AlertCircle
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { getEvents, getEventStudents, updateEventStudent } from "@/services/supabaseService";
import { Student, Event } from "@/types";

interface EventOption {
    id: string;
    subject: string;
    type: string;
    mode: string;
    name: string;
    capacity: number;
    enrolled: number;
}

const typeColors: Record<string, string> = {
    PAPER: "bg-blue-50 text-blue-700 border-blue-200",
    POSTER: "bg-purple-50 text-purple-700 border-purple-200",
    QUIZ: "bg-amber-50 text-amber-700 border-amber-200",
    WORKSHOP: "bg-green-50 text-green-700 border-green-200",
    DEBATE: "bg-red-50 text-red-700 border-red-200",
};

const modeIcons: Record<string, string> = {
    ONLINE: "🌐",
    OFFLINE: "🏛️",
    HYBRID: "🔗",
};

export default function StudentEventsPage() {
    const { user } = useAuth();
    const [configReady, setConfigReady] = useState(false);
    const [events, setEvents] = useState<EventOption[]>([]);
    const [search, setSearch] = useState("");
    const [enrollDialog, setEnrollDialog] = useState<EventOption | null>(null);
    const [enrolling, setEnrolling] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState<{ subject: string; type: string; mode: string } | null>(null);

    useEffect(() => {
        const loadData = async () => {
            if (!user) return;
            const allEvents = await getEvents();
            setConfigReady(true);

            if ((user as Student)?.selectedEvents && (user as Student).selectedEvents!.length > 0) {
                setSelectedEvent((user as Student).selectedEvents![0]);
            }

            const allStudents = await getEventStudents();

            const options: EventOption[] = allEvents.map((evt: Event) => {
                const enrolled = allStudents.filter(s =>
                    s.selectedEvents?.some(e =>
                        e.type === evt.type && e.mode === evt.mode
                    )
                ).length;

                return {
                    id: evt.id,
                    subject: evt.name, // using name as subject for display compat
                    type: evt.type,
                    mode: evt.mode.toUpperCase(),
                    name: evt.name,
                    capacity: evt.capacity,
                    enrolled
                };
            });

            setEvents(options);
        };

        loadData();
    }, [user]);

    const filtered = events.filter(e =>
        e.name.toLowerCase().includes(search.toLowerCase()) ||
        e.subject.toLowerCase().includes(search.toLowerCase()) ||
        e.type.toLowerCase().includes(search.toLowerCase())
    );

    const handleEnroll = async (event: EventOption) => {
        if (!user) return;
        setEnrolling(true);

        try {
            await updateEventStudent(user.id, {
                selectedEvents: [{
                    subject: event.subject,
                    type: event.type,
                    mode: event.mode
                }]
            });

            setSelectedEvent({ subject: event.subject, type: event.type, mode: event.mode });
            setEvents(prev => prev.map(e => e.id === event.id ? { ...e, enrolled: e.enrolled + 1 } : e));
            setEnrollDialog(null);
            toast.success(`Registered for ${event.name} successfully!`);
        } catch (error) {
            console.error(error);
            toast.error("Failed to select event.");
        } finally {
            setEnrolling(false);
        }
    };

    if (!configReady) return <div className="p-8 text-center text-slate-500">Loading events...</div>;

    const studentData = user as Student;
    const hasPayment = studentData.paymentStatus === "PAID";

    if (!hasPayment) {
        return (
            <div className="max-w-3xl mx-auto mt-10">
                <Alert className="bg-yellow-50 border-yellow-200">
                    <AlertCircle className="h-4 w-4 text-yellow-600" />
                    <AlertTitle className="text-yellow-800">Payment Required</AlertTitle>
                    <AlertDescription className="text-yellow-700">
                        Please complete your registration payment before selecting an event.
                    </AlertDescription>
                </Alert>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Event Registration</h1>
                    <p className="text-sm text-slate-500 mt-1">Browse and select your primary event presentation category.</p>
                </div>
                <div className="relative w-full sm:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                        placeholder="Search events..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-10 h-10 rounded-xl border-slate-200 bg-white"
                    />
                </div>
            </div>

            {selectedEvent && (
                <Alert className="bg-green-50 border-green-200">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <AlertTitle className="text-green-800 font-bold">Registration Confirmed</AlertTitle>
                    <AlertDescription className="text-green-700">
                        You have successfully registered for: <strong>{selectedEvent.subject} - {selectedEvent.type} ({selectedEvent.mode})</strong>
                        <br />
                        <span className="text-xs mt-1 block">You can now proceed to submit an abstract in this category via the Submissions tab.</span>
                    </AlertDescription>
                </Alert>
            )}

            {/* Events Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filtered.map((event, i) => {
                    const isFull = event.enrolled >= event.capacity;
                    let isEnrolled = false;

                    // The old eventSelection set objects with { subject, type, mode }
                    if (selectedEvent &&
                        selectedEvent.subject === event.subject &&
                        // Ignore case since 'displayType' might differ
                        selectedEvent.mode.toLowerCase() === event.mode.toLowerCase()
                    ) {
                        isEnrolled = true;
                    }

                    return (
                        <motion.div
                            key={event.id}
                            className={`bg-white rounded-2xl border ${isEnrolled ? 'border-[#004d40] ring-1 ring-[#004d40]' : 'border-slate-100'} overflow-hidden shadow-sm hover:shadow-md transition-all ${isFull && !isEnrolled ? "opacity-60" : ""}`}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.01 }}
                        >
                            {/* Header */}
                            <div className="p-5 pb-3">
                                <div className="flex items-start justify-between mb-3">
                                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold border ${typeColors[event.type] || "bg-slate-50 text-slate-600"}`}>
                                        {event.type}
                                    </span>
                                    <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded-md">
                                        {modeIcons[event.mode]} {event.mode}
                                    </span>
                                </div>
                                <h3 className="font-bold text-slate-900 text-sm leading-tight mb-1">{event.name}</h3>
                            </div>

                            {/* Details */}
                            <div className="px-5 space-y-2 text-xs text-slate-500">
                                <div className="flex items-center gap-2">
                                    <Users className="w-3.5 h-3.5 text-slate-300" />
                                    <span>{event.enrolled} / {event.capacity} registered</span>
                                </div>
                                <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2">
                                    <div
                                        className={`h-1.5 rounded-full ${isFull ? 'bg-red-500' : 'bg-emerald-500'}`}
                                        style={{ width: `${Math.min(100, (event.enrolled / event.capacity) * 100)}%` }}
                                    />
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="p-5 pt-4 mt-3 border-t border-slate-50 flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                    {isFull && !isEnrolled && <Badge variant="destructive">Event Full</Badge>}
                                </div>
                                {selectedEvent ? (
                                    isEnrolled ? (
                                        <span className="flex items-center gap-1.5 text-xs font-bold text-green-600 bg-green-50 px-3 py-1.5 rounded-lg border border-green-200">
                                            <CheckCircle2 className="w-3.5 h-3.5" /> Selected
                                        </span>
                                    ) : (
                                        <span className="flex items-center gap-1.5 text-xs font-bold text-slate-400">
                                            -
                                        </span>
                                    )
                                ) : (
                                    <Button
                                        size="sm"
                                        className="h-8 rounded-lg bg-[#004d40] hover:bg-[#003d33] text-xs font-bold"
                                        onClick={() => setEnrollDialog(event)}
                                        disabled={isFull}
                                    >
                                        Select <ArrowRight className="w-3 h-3 ml-1" />
                                    </Button>
                                )}
                            </div>
                        </motion.div>
                    );
                })}
            </div>

            {filtered.length === 0 && (
                <div className="text-center py-16 text-slate-400">
                    <Calendar className="w-12 h-12 mx-auto mb-3 text-slate-200" />
                    <p className="font-medium">No events match your criteria</p>
                </div>
            )}

            {/* Enroll Confirmation Dialog */}
            <Dialog open={!!enrollDialog} onOpenChange={() => setEnrollDialog(null)}>
                <DialogContent className="sm:max-w-md rounded-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-lg">Confirm Registration</DialogTitle>
                        <DialogDescription className="text-slate-500">
                            You are about to select this category for your presentation. You can only choose one category.
                        </DialogDescription>
                    </DialogHeader>
                    {enrollDialog && (
                        <div className="space-y-3 py-2">
                            <div className="bg-slate-50 p-4 rounded-xl text-sm space-y-2">
                                <div className="flex justify-between"><span className="text-slate-500">Event:</span><span className="font-bold text-slate-800">{enrollDialog.name}</span></div>
                                <div className="flex justify-between"><span className="text-slate-500">Mode:</span><span className="font-medium">{enrollDialog.mode}</span></div>
                            </div>
                        </div>
                    )}
                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => setEnrollDialog(null)} className="rounded-xl">Cancel</Button>
                        <Button onClick={() => enrollDialog && handleEnroll(enrollDialog)} disabled={enrolling} className="rounded-xl bg-[#004d40] hover:bg-[#003d33]">
                            {enrolling ? "Processing..." : "Confirm Selection"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
