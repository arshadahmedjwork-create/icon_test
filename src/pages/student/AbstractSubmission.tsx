import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { useAuth } from "@/contexts/AuthContext";
import { addAbstract, getEventConfig } from "@/services/supabaseService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, Upload } from "lucide-react";
import { Abstract, EventConfig } from "@/types";

interface AbstractData {
    title: string;
    subject: string;
    type: string;
    mode: string;
    mentorName: string;
    coAuthors: string; // Comma separated for form
    coAuthorMidasIds: string; // Comma separated for form
    fileUrl: string; // Mock
}

export default function AbstractSubmission({ onComplete }: { onComplete: () => void }) {
    const { user } = useAuth();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [config, setConfig] = useState<EventConfig | null>(null);

    useEffect(() => {
        const loadConfig = async () => {
            const c = await getEventConfig();
            setConfig(c);
        };
        loadConfig();
    }, []);

    const { register, handleSubmit, formState: { errors }, setValue, watch } = useForm<AbstractData>();
    const selectedType = watch("type");

    const onSubmit = async (data: AbstractData) => {
        if (!user) return;
        setIsSubmitting(true);

        try {
            const newAbstract: Omit<Abstract, "id" | "submittedAt" | "status"> = {
                studentId: user.id,
                title: data.title,
                subject: data.subject,
                college: user.college || "Unknown College", // Auto-fill college
                type: data.type,
                mode: data.mode,
                mentorName: data.mentorName,
                coAuthors: data.coAuthors ? data.coAuthors.split(",").map(s => s.trim()) : [],
                coAuthorMidasIds: data.coAuthorMidasIds ? data.coAuthorMidasIds.split(",").map(s => s.trim()) : [],
                fileUrl: "https://mock-s3-bucket/abstract.pdf", // Mock URL - In real app, upload first then get URL
                feedback: ""
            } as any;

            await addAbstract(newAbstract);
            toast.success("Abstract submitted successfully! Waiting for scientific committee review.");
            onComplete();
        } catch (error) {
            console.error(error);
            toast.error("Failed to submit abstract.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Card className="max-w-3xl mx-auto shadow-none border-0 sm:border sm:shadow-sm">
            <CardHeader>
                <CardTitle>Submit Scientific Abstract</CardTitle>
                <CardDescription>
                    Submit your research for evaluation. Ensure you follow the guidelines.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                    <div className="space-y-2">
                        <Label htmlFor="title">Title of Presentation</Label>
                        <Input id="title" {...register("title", { required: "Title is required", minLength: { value: 10, message: "Title too short" } })} placeholder="e.g. Comparative Analysis of..." />
                        {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="subject">Subject / Specialty</Label>
                            <Select onValueChange={(val) => setValue("subject", val)}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select specialty" />
                                </SelectTrigger>
                                <SelectContent>
                                    {config?.subjects.map(subj => (
                                        <SelectItem key={subj} value={subj}>{subj}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="type">Presentation Type</Label>
                            <Select onValueChange={(val) => setValue("type", val)}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                                <SelectContent>
                                    {config?.presentationTypes.map(t => (
                                        <SelectItem key={t} value={t}>{t}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="mode">Mode of Presentation</Label>
                            <Select onValueChange={(val) => setValue("mode", val)}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Online / Offline" />
                                </SelectTrigger>
                                <SelectContent>
                                    {config?.modes.map(m => (
                                        <SelectItem key={m} value={m}>{m}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="mentorName">Guide / Mentor Name</Label>
                            <Input id="mentorName" {...register("mentorName")} placeholder="Dr. Name (Optional)" />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="coAuthors">Co-Authors Names (if any)</Label>
                        <Input
                            id="coAuthors"
                            {...register("coAuthors", {
                                validate: (value) => {
                                    if (!value) return true;
                                    const count = value.split(",").filter(s => s.trim().length > 0).length;
                                    const type = watch("type");
                                    if (type === "Poster Presentation" && count > 0) return "Co-authors not allowed for Poster Presentation";
                                    if (type === "Paper Presentation" && count > 2) return "Max 2 co-authors allowed for Paper Presentation";
                                    return true;
                                }
                            })}
                            placeholder="Separate multiple names by comma"
                        />
                        <p className="text-xs text-muted-foreground">Max 2 co-authors for Paper, 0 for Poster.</p>
                        {errors.coAuthors && <p className="text-xs text-destructive">{errors.coAuthors.message}</p>}
                    </div>

                    {selectedType === "Paper Presentation" && (
                        <div className="space-y-2">
                            <Label htmlFor="coAuthorMidasIds">Co-Authors MIDAS IDs (if any)</Label>
                            <Input
                                id="coAuthorMidasIds"
                                {...register("coAuthorMidasIds", {
                                    validate: (value) => {
                                        if (!value) return true;
                                        const count = value.split(",").filter(s => s.trim().length > 0).length;
                                        if (count > 2) return "Max 2 co-authors allowed";
                                        return true;
                                    }
                                })}
                                placeholder="E.g. MIDAS-2026-0001, MIDAS-2026-0002"
                            />
                            <p className="text-xs text-muted-foreground">Must be valid MIDAS IDs of registered students.</p>
                            {errors.coAuthorMidasIds && <p className="text-xs text-destructive">{errors.coAuthorMidasIds.message}</p>}
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="abstractFile">Abstract Document (PDF)</Label>
                        <div className="border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-muted/50 transition-colors">
                            <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                            <span className="text-sm font-medium">Click to upload or drag and drop</span>
                            <span className="text-xs text-muted-foreground mt-1">PDF only, max 500 words (Converted to PDF)</span>
                            <Input type="file" className="hidden" id="abstractFile" accept=".pdf" />
                        </div>
                    </div>

                    <Button type="submit" className="w-full" disabled={isSubmitting}>
                        {isSubmitting ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading & Submitting...
                            </>
                        ) : (
                            "Submit Abstract"
                        )}
                    </Button>
                </form>
            </CardContent>
        </Card >
    );
}
