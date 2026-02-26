import { useState, useEffect } from "react";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    getEventConfig,
    updateEventConfig,
    getDeadlines,
    updateDeadline
} from "@/services/supabaseService";
import { EventConfig, EvaluationCriteria, Deadline } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Save } from "lucide-react";

export default function AdminEventConfig() {
    const [config, setConfig] = useState<EventConfig | null>(null);
    const [deadlines, setDeadlines] = useState<Deadline[]>([]);
    const { toast } = useToast();

    useEffect(() => {
        const load = async () => {
            const c = await getEventConfig();
            setConfig(c);
            const d = await getDeadlines();
            setDeadlines(d);
        };
        load();
    }, []);

    const handleSave = async () => {
        if (config) {
            try {
                await updateEventConfig(config);
                toast({ title: "Configuration Saved", description: "Event settings updated successfully." });
            } catch (error) {
                console.error(error);
                toast({ title: "Error", description: "Failed to save configuration.", variant: "destructive" });
            }
        }
    };

    const handleDeadlineUpdate = async (id: string, date: string) => {
        try {
            await updateDeadline(id, date);
            const d = await getDeadlines();
            setDeadlines(d);
            toast({ title: "Deadline Updated", description: "Date saved successfully." });
        } catch (error) {
            console.error(error);
            toast({ title: "Error", description: "Failed to update deadline.", variant: "destructive" });
        }
    };

    const addSubject = () => {
        if (!config) return;
        setConfig({ ...config, subjects: [...config.subjects, "New Subject"] });
    };

    const updateSubject = (index: number, val: string) => {
        if (!config) return;
        const newSubjects = [...config.subjects];
        newSubjects[index] = val;
        setConfig({ ...config, subjects: newSubjects });
    };

    const removeSubject = (index: number) => {
        if (!config) return;
        setConfig({ ...config, subjects: config.subjects.filter((_, i) => i !== index) });
    };


    const updateCriteriaName = (index: number, val: string) => {
        if (!config) return;
        const newCriteria = [...config.criterias];
        newCriteria[index] = { ...newCriteria[index], name: val };
        setConfig({ ...config, criterias: newCriteria });
    };

    const updateCriteriaScore = (index: number, field: "maxScore" | "weightage", val: number) => {
        if (!config) return;
        const newCriteria = [...config.criterias];
        newCriteria[index] = { ...newCriteria[index], [field]: val };
        setConfig({ ...config, criterias: newCriteria });
    };

    if (!config) return <div>Loading...</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold font-display">Event Configuration</h2>
                    <p className="text-muted-foreground">Manage subjects, evaluation criteria, and session rules.</p>
                </div>
                <Button onClick={handleSave}>
                    <Save className="w-4 h-4 mr-2" /> Save Changes
                </Button>
            </div>

            <Tabs defaultValue="subjects" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="subjects">Subjects</TabsTrigger>
                    <TabsTrigger value="criteria">Evaluation Criteria</TabsTrigger>
                    <TabsTrigger value="capacity">Session Capacity</TabsTrigger>
                    <TabsTrigger value="deadlines">Deadlines</TabsTrigger>
                </TabsList>

                <TabsContent value="deadlines">
                    <Card>
                        <CardHeader>
                            <CardTitle>Event Deadlines</CardTitle>
                            <CardDescription>Set critical dates for registration and submissions.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {deadlines.map((deadline) => (
                                    <div key={deadline.id} className="grid grid-cols-1 md:grid-cols-3 gap-4 border-b pb-4 last:border-0 last:pb-0">
                                        <div className="md:col-span-2">
                                            <Label className="text-base font-semibold">{deadline.name}</Label>
                                            <p className="text-sm text-muted-foreground">{deadline.description}</p>
                                        </div>
                                        <div>
                                            <Input
                                                type="datetime-local"
                                                value={deadline.date}
                                                onChange={(e) => handleDeadlineUpdate(deadline.id, e.target.value)}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="subjects">
                    <Card>
                        <CardHeader>
                            <CardTitle>Scientific Subjects</CardTitle>
                            <CardDescription>Add or remove subjects available for presentation.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            {config.subjects.map((subject, index) => (
                                <div key={index} className="flex gap-2">
                                    <Input
                                        value={subject}
                                        onChange={(e) => updateSubject(index, e.target.value)}
                                    />
                                    <Button variant="ghost" size="icon" onClick={() => removeSubject(index)}>
                                        <Trash2 className="w-4 h-4 text-destructive" />
                                    </Button>
                                </div>
                            ))}
                            <Button variant="outline" size="sm" onClick={addSubject} className="mt-2">
                                <Plus className="w-4 h-4 mr-2" /> Add Subject
                            </Button>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="criteria">
                    <Card>
                        <CardHeader>
                            <CardTitle>Scoring Rubric</CardTitle>
                            <CardDescription>Define criteria and weightages for evaluation.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {config.criterias.map((criteria, index) => (
                                    <div key={criteria.id} className="grid grid-cols-12 gap-4 items-end border-b pb-4 last:border-0 last:pb-0">
                                        <div className="col-span-12 md:col-span-5">
                                            <Label>Standard Name</Label>
                                            <Input
                                                value={criteria.name}
                                                onChange={(e) => updateCriteriaName(index, e.target.value)}
                                            />
                                        </div>
                                        <div className="col-span-6 md:col-span-3">
                                            <Label>Max Score</Label>
                                            <Input
                                                type="number"
                                                value={criteria.maxScore}
                                                onChange={(e) => updateCriteriaScore(index, "maxScore", parseInt(e.target.value) || 0)}
                                            />
                                        </div>
                                        <div className="col-span-6 md:col-span-3">
                                            <Label>Weightage (%)</Label>
                                            <Input
                                                type="number"
                                                value={criteria.weightage}
                                                onChange={(e) => updateCriteriaScore(index, "weightage", parseInt(e.target.value) || 0)}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="capacity">
                    <Card>
                        <CardHeader>
                            <CardTitle>Session Capacity Rules</CardTitle>
                            <CardDescription>Set the maximum number of students per session type.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid sm:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label>Paper Presentation (Online)</Label>
                                    <Input
                                        type="number"
                                        value={config.capacities?.paperOnline ?? 0}
                                        onChange={(e) => setConfig({
                                            ...config,
                                            capacities: { ...config.capacities, paperOnline: parseInt(e.target.value) || 0 }
                                        })}
                                    />
                                    <p className="text-xs text-muted-foreground">Students per session</p>
                                </div>
                                <div className="space-y-2">
                                    <Label>Paper Presentation (Offline)</Label>
                                    <Input
                                        type="number"
                                        value={config.capacities?.paperOffline ?? 0}
                                        onChange={(e) => setConfig({
                                            ...config,
                                            capacities: { ...config.capacities, paperOffline: parseInt(e.target.value) || 0 }
                                        })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Poster Presentation (Online)</Label>
                                    <Input
                                        type="number"
                                        value={config.capacities?.posterOnline ?? 0}
                                        onChange={(e) => setConfig({
                                            ...config,
                                            capacities: { ...config.capacities, posterOnline: parseInt(e.target.value) || 0 }
                                        })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Poster Presentation (Offline)</Label>
                                    <Input
                                        type="number"
                                        value={config.capacities?.posterOffline ?? 0}
                                        onChange={(e) => setConfig({
                                            ...config,
                                            capacities: { ...config.capacities, posterOffline: parseInt(e.target.value) || 0 }
                                        })}
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
