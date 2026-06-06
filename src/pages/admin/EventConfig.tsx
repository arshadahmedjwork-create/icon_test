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
    updateDeadline,
    getCollegesList,
    saveCollegesList
} from "@/services/supabaseService";
import { EventConfig, Deadline } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Save, GraduationCap, Settings, ListPlus, ShieldCheck } from "lucide-react";

export default function AdminEventConfig() {
    const [config, setConfig] = useState<EventConfig | null>(null);
    const [deadlines, setDeadlines] = useState<Deadline[]>([]);
    const [colleges, setColleges] = useState<{ value: string, label: string }[]>([]);
    const { toast } = useToast();

    useEffect(() => {
        const load = async () => {
            const c = await getEventConfig();
            setConfig(c);
            const d = await getDeadlines();
            setDeadlines(d);
            const cols = await getCollegesList();
            setColleges(cols);
        };
        load();
    }, []);

    const handleSave = async () => {
        if (config) {
            try {
                await updateEventConfig(config);
                await saveCollegesList(colleges);
                toast({ title: "Configuration Saved", description: "Master Settings & Colleges dropdown updated successfully." });
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

    const addCollege = () => {
        const newCollege = { value: "new_dental_college", label: "New Dental College" };
        setColleges([...colleges, newCollege]);
    };

    const updateCollege = (index: number, label: string) => {
        const newColleges = [...colleges];
        const value = label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
        newColleges[index] = { value, label };
        setColleges(newColleges);
    };

    const removeCollege = (index: number) => {
        setColleges(colleges.filter((_, i) => i !== index));
    };

    if (!config) return <div className="text-center p-10 font-sans">Loading Master Settings...</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-slate-900 text-white p-6 rounded-2xl shadow-lg border border-slate-800">
                <div className="space-y-1">
                    <h2 className="text-3xl font-black font-display tracking-tight flex items-center gap-2">
                        <Settings className="w-8 h-8 text-red-500 animate-spin-slow shrink-0" /> Master Settings
                    </h2>
                    <p className="text-slate-400 text-sm">Configure event variables, deadlines, dynamic college dropdown options, capacities, and grading rubrics.</p>
                </div>
                <Button onClick={handleSave} className="bg-red-600 hover:bg-red-700 text-white font-bold h-12 px-6 rounded-xl shadow-md transition-all duration-200">
                    <Save className="w-5 h-5 mr-2" /> Save Settings
                </Button>
            </div>

            <Tabs defaultValue="colleges" className="space-y-6">
                <TabsList className="bg-muted p-1 rounded-xl w-full grid grid-cols-5 h-auto">
                    <TabsTrigger value="colleges" className="rounded-lg py-2.5 font-bold">Colleges List</TabsTrigger>
                    <TabsTrigger value="subjects" className="rounded-lg py-2.5 font-bold">Subjects</TabsTrigger>
                    <TabsTrigger value="criteria" className="rounded-lg py-2.5 font-bold">Grading Criteria</TabsTrigger>
                    <TabsTrigger value="capacity" className="rounded-lg py-2.5 font-bold">Capacity & Rules</TabsTrigger>
                    <TabsTrigger value="deadlines" className="rounded-lg py-2.5 font-bold">Deadlines</TabsTrigger>
                </TabsList>

                {/* 1. Colleges List Selector */}
                <TabsContent value="colleges">
                    <Card className="border-slate-200 shadow-sm rounded-2xl overflow-hidden">
                        <CardHeader className="border-b bg-slate-50">
                            <CardTitle className="flex items-center gap-2 font-display text-xl font-bold text-slate-800">
                                <GraduationCap className="w-6 h-6 text-red-600 shrink-0" /> Institution Dropdown Configuration
                            </CardTitle>
                            <CardDescription>
                                Add, update, or remove dental colleges and hospitals. These institutions populate the dropdown selections across student and judge registration sheets.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-6 space-y-6">
                            <div className="grid md:grid-cols-2 gap-4">
                                {colleges.map((col, index) => (
                                    <div key={index} className="flex gap-2 items-center bg-slate-50/50 p-3 rounded-xl border border-slate-100 shadow-sm hover:shadow transition-shadow">
                                        <div className="flex-1 space-y-1">
                                            <Input
                                                value={col.label}
                                                onChange={(e) => updateCollege(index, e.target.value)}
                                                className="bg-white font-semibold text-slate-800 rounded-lg"
                                                placeholder="Dental College Name"
                                            />
                                            <span className="text-[10px] text-muted-foreground font-mono block px-1">
                                                Internal DB ID: <span className="bg-slate-200/60 text-slate-700 px-1 py-0.5 rounded">{col.value}</span>
                                            </span>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => removeCollege(index)}
                                            className="hover:bg-red-50 hover:text-red-600 transition-colors shrink-0 rounded-lg"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                            <Button variant="outline" size="lg" onClick={addCollege} className="mt-4 border-dashed border-red-200 text-red-700 hover:text-red-800 hover:bg-red-50/30 font-bold rounded-xl h-12 px-6">
                                <Plus className="w-5 h-5 mr-2" /> Add Dental Institution
                            </Button>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* 2. Scientific Subjects */}
                <TabsContent value="subjects">
                    <Card className="border-slate-200 shadow-sm rounded-2xl overflow-hidden">
                        <CardHeader className="border-b bg-slate-50">
                            <CardTitle className="flex items-center gap-2 font-display text-xl font-bold text-slate-800">
                                <ListPlus className="w-6 h-6 text-red-600 shrink-0" /> Scientific Subjects / Domains
                            </CardTitle>
                            <CardDescription>Configure subjects available for delegate presentation tracks.</CardDescription>
                        </CardHeader>
                        <CardContent className="p-6 space-y-4">
                            <div className="grid md:grid-cols-2 gap-3">
                                {config.subjects.map((subject, index) => (
                                    <div key={index} className="flex gap-2">
                                        <Input
                                            value={subject}
                                            onChange={(e) => updateSubject(index, e.target.value)}
                                            className="bg-white font-semibold rounded-lg"
                                        />
                                        <Button variant="ghost" size="icon" onClick={() => removeSubject(index)} className="hover:bg-red-50 hover:text-red-600 rounded-lg">
                                            <Trash2 className="w-4 h-4 text-destructive" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                            <Button variant="outline" size="lg" onClick={addSubject} className="mt-4 border-dashed border-red-200 text-red-700 hover:text-red-800 hover:bg-red-50/30 font-bold rounded-xl h-12 px-6">
                                <Plus className="w-5 h-5 mr-2" /> Add Subject
                            </Button>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* 3. Grading rubrics */}
                <TabsContent value="criteria">
                    <Card className="border-slate-200 shadow-sm rounded-2xl overflow-hidden">
                        <CardHeader className="border-b bg-slate-50">
                            <CardTitle className="flex items-center gap-2 font-display text-xl font-bold text-slate-800">
                                <ShieldCheck className="w-6 h-6 text-red-600 shrink-0" /> Scoring Rubric
                            </CardTitle>
                            <CardDescription>Define global criteria names, maximum marks, and weightages.</CardDescription>
                        </CardHeader>
                        <CardContent className="p-6 space-y-4">
                            <div className="space-y-4">
                                {config.criterias.map((criteria, index) => (
                                    <div key={criteria.id} className="grid grid-cols-12 gap-4 items-end border-b pb-4 last:border-0 last:pb-0">
                                        <div className="col-span-12 md:col-span-6">
                                            <Label className="font-semibold text-slate-700">Standard Name</Label>
                                            <Input
                                                value={criteria.name}
                                                onChange={(e) => updateCriteriaName(index, e.target.value)}
                                                className="bg-white rounded-lg mt-1"
                                            />
                                        </div>
                                        <div className="col-span-6 md:col-span-3">
                                            <Label className="font-semibold text-slate-700">Max Score</Label>
                                            <Input
                                                type="number"
                                                value={criteria.maxScore}
                                                onChange={(e) => updateCriteriaScore(index, "maxScore", parseInt(e.target.value) || 0)}
                                                className="bg-white rounded-lg mt-1"
                                            />
                                        </div>
                                        <div className="col-span-6 md:col-span-3">
                                            <Label className="font-semibold text-slate-700">Weightage (%)</Label>
                                            <Input
                                                type="number"
                                                value={criteria.weightage}
                                                onChange={(e) => updateCriteriaScore(index, "weightage", parseInt(e.target.value) || 0)}
                                                className="bg-white rounded-lg mt-1"
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* 4. Session Capacity Rules */}
                <TabsContent value="capacity">
                    <Card className="border-slate-200 shadow-sm rounded-2xl overflow-hidden">
                        <CardHeader className="border-b bg-slate-50">
                            <CardTitle className="font-display text-xl font-bold text-slate-800">Session Capacity Rules</CardTitle>
                            <CardDescription>Configure dynamic caps of delegates per session for scheduling rules.</CardDescription>
                        </CardHeader>
                        <CardContent className="p-6 space-y-6">
                            <div className="grid sm:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label className="font-semibold text-slate-700">Paper Presentation (Online)</Label>
                                    <Input
                                        type="number"
                                        value={config.capacities?.paperOnline ?? 0}
                                        onChange={(e) => setConfig({
                                            ...config,
                                            capacities: { ...config.capacities, paperOnline: parseInt(e.target.value) || 0 }
                                        })}
                                        className="bg-white rounded-lg"
                                    />
                                    <p className="text-xs text-muted-foreground">Students per session limit</p>
                                </div>
                                <div className="space-y-2">
                                    <Label className="font-semibold text-slate-700">Paper Presentation (Offline)</Label>
                                    <Input
                                        type="number"
                                        value={config.capacities?.paperOffline ?? 0}
                                        onChange={(e) => setConfig({
                                            ...config,
                                            capacities: { ...config.capacities, paperOffline: parseInt(e.target.value) || 0 }
                                        })}
                                        className="bg-white rounded-lg"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="font-semibold text-slate-700">Poster Presentation (Online)</Label>
                                    <Input
                                        type="number"
                                        value={config.capacities?.posterOnline ?? 0}
                                        onChange={(e) => setConfig({
                                            ...config,
                                            capacities: { ...config.capacities, posterOnline: parseInt(e.target.value) || 0 }
                                        })}
                                        className="bg-white rounded-lg"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="font-semibold text-slate-700">Poster Presentation (Offline)</Label>
                                    <Input
                                        type="number"
                                        value={config.capacities?.posterOffline ?? 0}
                                        onChange={(e) => setConfig({
                                            ...config,
                                            capacities: { ...config.capacities, posterOffline: parseInt(e.target.value) || 0 }
                                        })}
                                        className="bg-white rounded-lg"
                                    />
                                </div>
                            </div>
                            <div className="border-t pt-6 mt-6 space-y-4">
                                <h3 className="text-base font-semibold text-slate-800">Online Scheduling Options</h3>
                                <div className="flex items-center space-x-2">
                                    <input
                                        type="checkbox"
                                        id="enableOnlineScheduling"
                                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary accent-red-600 cursor-pointer"
                                        checked={localStorage.getItem("enable_online_scheduling") === "true"}
                                        onChange={(e) => {
                                            localStorage.setItem("enable_online_scheduling", e.target.checked ? "true" : "false");
                                            toast({
                                                title: "Online Scheduling Updated",
                                                description: `Online presentation mode scheduling has been ${e.target.checked ? 'enabled' : 'disabled'}.`
                                            });
                                            setConfig({ ...config });
                                        }}
                                    />
                                    <Label htmlFor="enableOnlineScheduling" className="cursor-pointer font-normal text-sm text-slate-700">
                                        Enable Online Presentation Mode Scheduling
                                    </Label>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* 5. Event Deadlines */}
                <TabsContent value="deadlines">
                    <Card className="border-slate-200 shadow-sm rounded-2xl overflow-hidden">
                        <CardHeader className="border-b bg-slate-50">
                            <CardTitle className="font-display text-xl font-bold text-slate-800">Event Deadlines</CardTitle>
                            <CardDescription>Set critical calendar constraints for delegate submissions.</CardDescription>
                        </CardHeader>
                        <CardContent className="p-6 space-y-4">
                            <div className="space-y-4">
                                {deadlines.map((deadline) => (
                                    <div key={deadline.id} className="grid grid-cols-1 md:grid-cols-3 gap-4 border-b pb-4 last:border-0 last:pb-0">
                                        <div className="md:col-span-2">
                                            <Label className="text-base font-semibold text-slate-800">{deadline.name}</Label>
                                            <p className="text-sm text-muted-foreground">{deadline.description}</p>
                                        </div>
                                        <div>
                                            <Input
                                                type="datetime-local"
                                                value={deadline.date}
                                                onChange={(e) => handleDeadlineUpdate(deadline.id, e.target.value)}
                                                className="bg-white rounded-lg mt-1"
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
