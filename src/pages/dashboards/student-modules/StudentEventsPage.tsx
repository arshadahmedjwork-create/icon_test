
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
import { useProgram } from "@/contexts/ProgramContext";
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
    rules: string;
    abstractDeadline: string;
    presentationDeadline: string;
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
};

export default function StudentEventsPage() {
    const { user, refreshUser } = useAuth();
    const { currentProgram } = useProgram();
    const [configReady, setConfigReady] = useState(false);
    const [events, setEvents] = useState<EventOption[]>([]);
    const [unfilteredEvents, setUnfilteredEvents] = useState<EventOption[]>([]);
    const [search, setSearch] = useState("");
    const [enrollDialog, setEnrollDialog] = useState<EventOption | null>(null);
    const [enrolling, setEnrolling] = useState(false);
    const [selectedEvents, setSelectedEvents] = useState<{ subject: string; type: string; mode: string }[]>([]);

    // Refresh user session on mount to sync newly added fields like delegateType
    useEffect(() => {
        refreshUser();
    }, [refreshUser]);

    useEffect(() => {
        const loadData = async () => {
            if (!user) return;
            const allEvents = await getEvents(currentProgram);
            setConfigReady(true);

            if ((user as Student)?.selectedEvents) {
                setSelectedEvents((user as Student).selectedEvents || []);
            }

            const allStudents = await getEventStudents(currentProgram);

            const allOptions: EventOption[] = allEvents.map((evt: Event) => {
                const enrolled = allStudents.filter(s =>
                    s.selectedEvents?.some(e =>
                        e.type === evt.type && e.mode === evt.mode && (e.subject === evt.name || e.subject === evt.type)
                    )
                ).length;

                return {
                    id: evt.id,
                    subject: evt.name, 
                    type: evt.type,
                    mode: evt.mode.toUpperCase(),
                    name: evt.name,
                    capacity: evt.capacity,
                    enrolled,
                    rules: evt.rules || "No specific rules provided.",
                    abstractDeadline: evt.abstractDeadline,
                    presentationDeadline: evt.presentationDeadline
                };
            });

            setUnfilteredEvents(allOptions);

            let filteredOptions = allOptions;
            if (currentProgram === 'ICON') {
                const role = (user as Student)?.delegateType;
                if (role === 'PG') {
                    filteredOptions = allOptions.filter(e => e.name.toLowerCase().includes("postgraduate"));
                } else if (role === 'Academician') {
                    filteredOptions = allOptions.filter(e => e.name.toLowerCase().includes("academician"));
                } else if (role === 'Clinician') {
                    filteredOptions = allOptions.filter(e => e.name.toLowerCase().includes("clinician"));
                } else {
                    filteredOptions = [];
                }
            }

            setEvents(filteredOptions);
        };

        loadData();
    }, [user, currentProgram]);

    const filtered = events.filter(e =>
        e.name.toLowerCase().includes(search.toLowerCase()) ||
        e.subject.toLowerCase().includes(search.toLowerCase()) ||
        e.type.toLowerCase().includes(search.toLowerCase())
    );

    const handleEnroll = async (event: EventOption) => {
        if (!user) return;
        setEnrolling(true);

        const newSelection = {
            subject: event.subject,
            type: event.type,
            mode: event.mode
        };

        // Check if already enrolled in this exact event
        if (selectedEvents.some(e => e.subject === event.subject && e.type === event.type && e.mode === event.mode)) {
            toast.error("You are already registered for this event.");
            setEnrolling(false);
            return;
        }

        const updatedSelection = [...selectedEvents, newSelection];

        try {
            await updateEventStudent(user.id, {
                selectedEvents: updatedSelection
            });

            setSelectedEvents(updatedSelection);
            setEvents(prev => prev.map(e => e.id === event.id ? { ...e, enrolled: e.enrolled + 1 } : e));
            setEnrollDialog(null);
            toast.success(`Registered for ${event.name} successfully!`);
        } catch (error) {
            console.error(error);
            toast.error("Failed to register for event.");
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
                <Alert className="bg-yellow-50 border-yellow-200 rounded-3xl p-6">
                    <AlertCircle className="h-6 w-6 text-yellow-600" />
                    <AlertTitle className="text-xl font-bold text-yellow-800">Payment Required</AlertTitle>
                    <AlertDescription className="text-yellow-700 mt-2">
                        Please complete your registration payment before selecting events.
                    </AlertDescription>
                </Alert>
            </div>
        );
    }

    const availableEvents = filtered.filter(event => 
        !selectedEvents.some(e => 
            e.subject === event.subject && 
            e.type.toLowerCase() === event.type.toLowerCase() &&
            e.mode.toLowerCase() === event.mode.toLowerCase()
        )
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                    <h1 className="text-2xl font-bold text-slate-900">Event Registration</h1>
                    <p className="text-sm text-slate-500 mt-1 mb-3">Browse and select your presentation categories. You can participate in multiple events.</p>
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

                {/* Header Ad Box */}
                <div className="flex-grow bg-red-600 border border-red-700 rounded-2xl overflow-hidden shadow-sm flex items-center justify-center h-[110px]">
                    <img src="/silver.png" alt="Silver Sponsor" className="w-full h-full object-contain p-1" />
                </div>
            </div>

            {selectedEvents.length > 0 && (
                <div className="space-y-4">
                    <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Your Registered Events</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {selectedEvents.map((evt, idx) => {
                            // Find matching event from the loaded events list to get rules and deadlines
                            const fullEvent = unfilteredEvents.find(e => 
                                e.subject === evt.subject && 
                                e.type.toLowerCase() === evt.type.toLowerCase() && 
                                e.mode.toLowerCase() === evt.mode.toLowerCase()
                            );
                            
                            return (
                                <div key={idx} className="bg-emerald-50/20 border border-emerald-100 rounded-2xl p-5 shadow-sm space-y-4">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-bold bg-emerald-100 text-emerald-800 border-none capitalize">
                                                {evt.type}
                                            </span>
                                            <h4 className="font-bold text-slate-800 text-base mt-1.5">{evt.subject}</h4>
                                            <p className="text-xs text-slate-500 mt-0.5">Mode: {evt.mode}</p>
                                        </div>
                                        <span className="flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                                            <CheckCircle2 className="w-3.5 h-3.5" /> Enrolled
                                        </span>
                                    </div>
                                    
                                    {fullEvent && (
                                        <>
                                            <div className="bg-white border border-emerald-100/50 p-3.5 rounded-xl text-xs text-slate-600 leading-relaxed max-h-32 overflow-y-auto">
                                                <p className="font-bold text-slate-800 mb-1">Rules & Guidelines:</p>
                                                <div className="whitespace-pre-wrap">{fullEvent.rules}</div>
                                            </div>
                                            
                                            <div className="grid grid-cols-2 gap-3 text-xs pt-1">
                                                <div className="bg-white p-2.5 border border-slate-100 rounded-xl">
                                                    <span className="text-slate-400 font-medium">Abstract Deadline</span>
                                                    <p className="font-bold text-red-500 mt-0.5">
                                                        {fullEvent.abstractDeadline ? new Date(fullEvent.abstractDeadline).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : 'Concluded'}
                                                    </p>
                                                </div>
                                                <div className="bg-white p-2.5 border border-slate-100 rounded-xl">
                                                    <span className="text-slate-400 font-medium">Presentation Upload</span>
                                                    <p className="font-bold text-slate-800 mt-0.5">
                                                        {fullEvent.presentationDeadline ? new Date(fullEvent.presentationDeadline).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : 'TBA'}
                                                    </p>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Events Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {availableEvents.map((event, i) => {
                    const isFull = event.enrolled >= event.capacity;
                    const isEnrolled = false;

                    return (
                        <motion.div
                            key={event.id}
                            className={`bg-white rounded-2xl border ${isEnrolled ? 'border-[#004d40] ring-1 ring-[#004d40]' : 'border-slate-100 shadow-sm'} overflow-hidden shadow-sm hover:shadow-md transition-all ${isFull && !isEnrolled ? "opacity-60" : ""}`}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.01 }}
                        >
                            {/* Header */}
                            <div className="p-5 pb-3">
                                <div className="flex items-start justify-between mb-3">
                                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold border ${typeColors[event.type.toUpperCase()] || "bg-slate-50 text-slate-600"}`}>
                                        {event.type}
                                    </span>
                                    <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded-md">
                                        {modeIcons[event.mode] || "📍"} {event.mode}
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
                                <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1">
                                    <div
                                        className={`h-1.5 rounded-full ${isFull ? 'bg-red-500' : 'bg-emerald-500'}`}
                                        style={{ width: `${Math.min(100, (event.enrolled / event.capacity) * 100)}%` }}
                                    />
                                </div>

                                {/* Deadlines */}
                                <div className="grid grid-cols-2 gap-2 mt-3 pt-2.5 border-t border-slate-100 text-[10px]">
                                    <div>
                                        <span className="text-slate-400 font-medium uppercase tracking-wider block">Abstract</span>
                                        <span className="font-bold text-red-500 mt-0.5 block">
                                            {event.abstractDeadline ? new Date(event.abstractDeadline).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : 'Concluded'}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-slate-400 font-medium uppercase tracking-wider block">Presentation</span>
                                        <span className="font-bold text-slate-700 mt-0.5 block">
                                            {event.presentationDeadline ? new Date(event.presentationDeadline).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : 'TBA'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="p-5 pt-4 mt-3 border-t border-slate-50 flex items-center justify-between gap-2">
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 rounded-lg border-slate-200 text-xs font-semibold text-slate-600 px-3 hover:bg-slate-50"
                                    onClick={() => setEnrollDialog(event)}
                                >
                                    View Rules
                                </Button>
                                
                                {isEnrolled ? (
                                    <span className="flex items-center justify-center gap-1 text-xs font-bold text-green-600 bg-green-50 px-3 py-1.5 rounded-lg border border-green-200 h-8">
                                        <CheckCircle2 className="w-3.5 h-3.5" /> Enrolled
                                    </span>
                                ) : (
                                    <Button
                                        size="sm"
                                        className="h-8 rounded-lg bg-[#004d40] hover:bg-[#003d33] text-xs font-bold px-3 flex-1"
                                        onClick={() => setEnrollDialog(event)}
                                        disabled={isFull}
                                    >
                                        Register <ArrowRight className="w-3 h-3 ml-1" />
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

            {/* Detailed Review Dialog */}
            <Dialog open={!!enrollDialog} onOpenChange={() => setEnrollDialog(null)}>
                <DialogContent className="sm:max-w-xl rounded-3xl p-0 overflow-hidden">
                    <div className="h-32 bg-[#004d40] p-6 text-white flex flex-col justify-end">
                        <Badge className="w-fit bg-emerald-300/20 text-emerald-100 border-none mb-2">Registration Review</Badge>
                        <h2 className="text-2xl font-bold">{enrollDialog?.name}</h2>
                    </div>
                    
                    <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-slate-50 p-3 rounded-2xl">
                                <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Execution Mode</p>
                                <p className="text-sm font-semibold flex items-center gap-1.5 mt-1">
                                    {enrollDialog && modeIcons[enrollDialog.mode]} {enrollDialog?.mode}
                                </p>
                            </div>
                            <div className="bg-slate-50 p-3 rounded-2xl">
                                <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Presentation Type</p>
                                <p className="text-sm font-semibold flex items-center gap-1.5 mt-1">
                                    {enrollDialog?.type}
                                </p>
                            </div>
                        </div>

                        <div>
                            <h4 className="flex items-center gap-2 text-sm font-bold text-slate-900 mb-2">
                                <AlertCircle className="w-4 h-4 text-[#004d40]" /> Rules & Guidelines
                            </h4>
                            <div className="bg-emerald-50/30 border border-emerald-100/50 p-4 rounded-2xl text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">
                                {enrollDialog?.rules}
                            </div>
                        </div>

                        <div className="space-y-3">
                            <h4 className="text-sm font-bold text-slate-900">Key Deadlines</h4>
                            <div className="grid grid-cols-1 gap-2">
                                <div className="flex items-center justify-between p-3 border border-slate-100 rounded-xl text-xs">
                                    <span className="text-slate-500">Abstract Submission</span>
                                    <span className="font-bold text-red-500">
                                        {enrollDialog?.abstractDeadline ? new Date(enrollDialog.abstractDeadline).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : 'Join Now'}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between p-3 border border-slate-100 rounded-xl text-xs">
                                    <span className="text-slate-500">Presentation Upload</span>
                                    <span className="font-bold">
                                        {enrollDialog?.presentationDeadline ? new Date(enrollDialog.presentationDeadline).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : 'TBA'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="p-6 pt-0 flex gap-3">
                        <Button variant="outline" onClick={() => setEnrollDialog(null)} className="flex-1 rounded-2xl h-11 border-slate-200">
                            Back
                        </Button>
                        <Button 
                            onClick={() => enrollDialog && handleEnroll(enrollDialog)} 
                            disabled={enrolling} 
                            className="flex-[2] rounded-2xl h-11 bg-[#004d40] hover:bg-[#003d33]"
                        >
                            {enrolling ? "Registering..." : "Confirm Registration"}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
