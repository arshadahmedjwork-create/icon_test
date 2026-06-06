import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getAbstracts, getDeadlines, updateAbstract, uploadPresentationFile } from "@/services/supabaseService";
import { Abstract, Deadline, Student } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Upload, CheckCircle2, AlertCircle, Clock, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function PresentationUpload() {
    const { user } = useAuth();
    const { toast } = useToast();
    const [abstracts, setAbstracts] = useState<Abstract[]>([]);
    const [deadline, setDeadline] = useState<Deadline | null>(null);
    const [isPastDeadline, setIsPastDeadline] = useState(false);
    const [uploading, setUploading] = useState<string | null>(null);

    useEffect(() => {
        const loadData = async () => {
            if (user) {
                const [allAbstracts, deadlines] = await Promise.all([
                    getAbstracts(),
                    getDeadlines()
                ]);

                const myAbstracts = allAbstracts.filter(a => a.studentId === user.id && a.status === "approved");
                setAbstracts(myAbstracts);

                const presentationDeadline = deadlines.find(d => d.name === "Presentation Upload");
                setDeadline(presentationDeadline || null);

                if (presentationDeadline) {
                    const now = new Date();
                    const deadlineDate = new Date(presentationDeadline.date);
                    setIsPastDeadline(now > deadlineDate);
                }
            }
        };
        loadData();
    }, [user]);

    const handleFileUpload = async (abstractId: string) => {
        if (isPastDeadline) {
            toast({
                title: "Deadline Passed",
                description: "The presentation upload deadline has expired.",
                variant: "destructive"
            });
            return;
        }

        const fileInput = document.getElementById(`file-${abstractId}`) as HTMLInputElement;
        const file = fileInput?.files?.[0];

        if (!file) {
            toast({ title: "No file selected", description: "Please choose a file to upload.", variant: "destructive" });
            return;
        }

        setUploading(abstractId);

        try {
            const uploadedUrl = await uploadPresentationFile(abstractId, file);
            if (!uploadedUrl) throw new Error("Upload failed");

            await updateAbstract(abstractId, { presentationUrl: uploadedUrl });

            // Refresh list (or update locally preferably)
            const updatedAbstracts = abstracts.map(a =>
                a.id === abstractId ? { ...a, presentationUrl: uploadedUrl } : a
            );
            setAbstracts(updatedAbstracts);

            toast({
                title: "Upload Successful",
                description: "Your presentation has been uploaded successfully."
            });
        } catch (error) {
            console.error(error);
            toast({ title: "Error", description: "Failed to upload presentation.", variant: "destructive" });
        } finally {
            setUploading(null);
        }
    };

    if (abstracts.length === 0) {
        return (
            <div className="max-w-3xl mx-auto mt-10">
                <Alert className="bg-yellow-50 border-yellow-200">
                    <AlertCircle className="h-4 w-4 text-yellow-600" />
                    <AlertTitle className="text-yellow-800">No Approved Abstracts</AlertTitle>
                    <AlertDescription className="text-yellow-700">
                        You need to have an approved abstract before uploading your presentation.
                    </AlertDescription>
                </Alert>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="font-display text-2xl font-bold mb-1">Presentation Upload</h1>
                <p className="text-sm text-muted-foreground">
                    Upload your final presentation files before the deadline.
                </p>
            </div>

            {deadline && (
                <Alert className={isPastDeadline ? "bg-red-50 border-red-200" : "bg-blue-50 border-blue-200"}>
                    <Clock className={`h-4 w-4 ${isPastDeadline ? "text-red-600" : "text-blue-600"}`} />
                    <AlertTitle className={isPastDeadline ? "text-red-800" : "text-blue-800"}>
                        {isPastDeadline ? "Deadline Expired" : "Deadline"}
                    </AlertTitle>
                    <AlertDescription className={isPastDeadline ? "text-red-700" : "text-blue-700"}>
                        {deadline.description}: {new Date(deadline.date).toLocaleString()}
                        {isPastDeadline && " - Uploads are no longer accepted."}
                    </AlertDescription>
                </Alert>
            )}

            <div className="grid gap-6">
                {abstracts.map(abstract => {
                    const hasUploaded = !!abstract.presentationUrl;
                    const isUploading = uploading === abstract.id;

                    return (
                        <Card key={abstract.id} className={hasUploaded ? "border-green-200 bg-green-50/30" : ""}>
                            <CardHeader>
                                <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                        <CardTitle className="text-lg">{abstract.title}</CardTitle>
                                        <CardDescription>
                                            {abstract.subject} • {abstract.type} • {abstract.mode}
                                        </CardDescription>
                                    </div>
                                    {hasUploaded && (
                                        <Badge variant="default" className="bg-green-600">
                                            <CheckCircle2 className="w-3 h-3 mr-1" /> Uploaded
                                        </Badge>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {hasUploaded ? (
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 p-3 rounded-md border border-green-200">
                                            <FileText className="w-4 h-4" />
                                            <span className="font-medium">Presentation uploaded successfully</span>
                                        </div>
                                        <Button
                                            variant="outline"
                                            className="w-full"
                                            onClick={() => window.open(abstract.presentationUrl, "_blank")}
                                        >
                                            View Uploaded File
                                        </Button>
                                        {!isPastDeadline && (
                                            <Button
                                                variant="secondary"
                                                className="w-full"
                                                onClick={() => handleFileUpload(abstract.id)}
                                                disabled={isUploading}
                                            >
                                                <Upload className="w-4 h-4 mr-2" />
                                                Re-upload Presentation
                                            </Button>
                                        )}
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        <div className="border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center text-center">
                                            <Upload className="h-10 w-10 text-muted-foreground mb-3" />
                                            <Label className="text-base font-medium mb-1">
                                                {abstract.type.includes("Paper") ? "Upload PowerPoint (PPT/PPTX)" : "Upload Poster (PDF)"}
                                            </Label>
                                            <p className="text-xs text-muted-foreground mb-4">
                                                Max file size: 50MB
                                            </p>
                                            <Input
                                                type="file"
                                                className="hidden"
                                                id={`file-${abstract.id}`}
                                                accept={abstract.type.includes("Paper") ? ".ppt,.pptx" : ".pdf"}
                                                onChange={() => handleFileUpload(abstract.id)}
                                                disabled={isPastDeadline}
                                            />
                                            <Button
                                                onClick={() => document.getElementById(`file-${abstract.id}`)?.click()}
                                                disabled={isPastDeadline || isUploading}
                                            >
                                                {isUploading ? (
                                                    <>
                                                        <Clock className="w-4 h-4 mr-2 animate-spin" />
                                                        Uploading...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Upload className="w-4 h-4 mr-2" />
                                                        Choose File
                                                    </>
                                                )}
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}
