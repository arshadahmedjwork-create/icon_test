import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useProgram } from "@/contexts/ProgramContext";
import { getEventConfig, getEventStudents, updateEventStudent } from "@/services/supabaseService";
import { Student, EventConfig } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, Users, AlertCircle, Clock } from "lucide-react";

interface EventOption {
    subject: string;
    type: string;
    mode: string;
    capacity: number;
    enrolled: number;
}

export default function EventSelection() {
    const { user } = useAuth();
    const { currentProgram } = useProgram();
    const { toast } = useToast();
    const [config, setConfig] = useState<EventConfig | null>(null);
    const [eventOptions, setEventOptions] = useState<EventOption[]>([]);
    const [selectedEvent, setSelectedEvent] = useState<{ subject: string; type: string; mode: string } | null>(null);

    useEffect(() => {
        const loadData = async () => {
            if (!user) return;

            const eventConfig = await getEventConfig(currentProgram);
            if (!eventConfig) return;
            setConfig(eventConfig);

            // Check if user already selected an event
            // Note: 'user' from useAuth is from context, which is updated on load.
            // However, we might want to refresh 'user' data to be sure or trust context.
            // Context user is from 'fetchUserProfile' which calls Supabase. So it's fresh enough.
            if ((user as Student)?.selectedEvents && (user as Student).selectedEvents!.length > 0) {
                setSelectedEvent((user as Student).selectedEvents![0]);
            }

            // Generate all possible event combinations
            // This is heavy. In real app, consider caching stats or using a view.
            const allStudents = await getEventStudents(currentProgram);

            const options: EventOption[] = [];
            eventConfig.subjects.forEach(subject => {
                eventConfig.presentationTypes.forEach(type => {
                    eventConfig.modes.forEach(mode => {
                        const capacityKey = `${type.toLowerCase().replace(" ", "")}${mode}` as keyof typeof eventConfig.capacities;
                        const capacity = eventConfig.capacities[capacityKey] || 12;

                        // Count current enrollments
                        const enrolled = allStudents.filter(s => {
                            let selections = s.selectedEvents;
                            if (typeof selections === 'string') {
                                try { selections = JSON.parse(selections); } catch { return false; }
                            }
                            if (!selections || !Array.isArray(selections)) return false;
                            
                            return selections.some(e =>
                                e.subject?.toString().trim().toLowerCase() === subject.trim().toLowerCase() && 
                                e.type?.toString().trim().toLowerCase() === type.trim().toLowerCase() && 
                                e.mode?.toString().trim().toLowerCase() === mode.trim().toLowerCase()
                            );
                        }).length;

                        options.push({ subject, type, mode, capacity, enrolled });
                    });
                });
            });

            setEventOptions(options);
        };

        loadData();
    }, [user, currentProgram]);

    const handleSelectEvent = async (event: EventOption) => {
        if (!user) return;

        const isFull = event.enrolled >= event.capacity;
        if (isFull) {
            toast({ title: "Event Full", description: "This event has reached maximum capacity.", variant: "destructive" });
            return;
        }

        try {
            // Update user record
            await updateEventStudent(user.id, {
                selectedEvents: [{
                    subject: event.subject,
                    type: event.type,
                    mode: event.mode
                }]
            });

            setSelectedEvent({ subject: event.subject, type: event.type, mode: event.mode });
            toast({
                title: "Event Selected",
                description: `You have registered for ${event.subject} - ${event.type} (${event.mode})`
            });

            // Reload to reflect changes
            setTimeout(() => window.location.reload(), 1500);
        } catch (error) {
            console.error(error);
            toast({ title: "Error", description: "Failed to select event", variant: "destructive" });
        }
    };

    if (!config) return <div className="p-8 text-center text-slate-500">Loading events...</div>;

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
            <div>
                <h1 className="font-display text-2xl font-bold mb-1">Event Selection</h1>
                <p className="text-sm text-muted-foreground">
                    Choose one event to participate in. Check availability before selecting.
                </p>
            </div>

            {selectedEvent && (
                <Alert className="bg-green-50 border-green-200">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <AlertTitle className="text-green-800">Event Confirmed</AlertTitle>
                    <AlertDescription className="text-green-700">
                        You are registered for: <strong>{selectedEvent.subject}</strong> - {selectedEvent.type} ({selectedEvent.mode})
                    </AlertDescription>
                </Alert>
            )}

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {eventOptions.map((event, idx) => {
                    const isFull = event.enrolled >= event.capacity;
                    const isSelected = selectedEvent?.subject === event.subject &&
                        selectedEvent?.type === event.type &&
                        selectedEvent?.mode === event.mode;

                    return (
                        <Card key={idx} className={isSelected ? "border-primary border-2" : isFull ? "opacity-60" : ""}>
                            <CardHeader>
                                <div className="flex justify-between items-start">
                                    <CardTitle className="text-lg">{event.subject}</CardTitle>
                                    {isFull ? (
                                        <Badge variant="destructive">Full</Badge>
                                    ) : isSelected ? (
                                        <Badge variant="default" className="bg-green-600">Selected</Badge>
                                    ) : (
                                        <Badge variant="outline">{event.capacity - event.enrolled} slots left</Badge>
                                    )}
                                </div>
                                <CardDescription>
                                    {event.type} • {event.mode}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                                    <Users className="w-4 h-4" />
                                    <span>{event.enrolled} / {event.capacity} enrolled</span>
                                </div>
                                <Button
                                    className="w-full"
                                    disabled={isFull || isSelected || !!selectedEvent}
                                    onClick={() => handleSelectEvent(event)}
                                    variant={isSelected ? "secondary" : "default"}
                                >
                                    {isSelected ? "Currently Selected" : isFull ? "Event Full" : selectedEvent ? "Already Registered" : "Select This Event"}
                                </Button>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}
