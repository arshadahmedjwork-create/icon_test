import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { GraduationCap, School, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useProgram } from "@/contexts/ProgramContext";
import { getCollegesList, updateEventStudent } from "@/services/supabaseService";
import { toast } from "sonner";

export default function CompleteProfileModal() {
    const { user, refreshUser } = useAuth();
    const { currentProgram } = useProgram();
    const [college, setCollege] = useState("");
    const [year, setYear] = useState("");
    const [colleges, setColleges] = useState<{ value: string; label: string }[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoadingColleges, setIsLoadingColleges] = useState(true);

    const isIcon = currentProgram === "ICON";
    const delegateType = user?.delegateType || (isIcon ? "PG" : "UG");

    useEffect(() => {
        const loadColleges = async () => {
            try {
                const list = await getCollegesList();
                setColleges(list);
            } catch (err) {
                console.error("Failed to load colleges:", err);
            } finally {
                setIsLoadingColleges(false);
            }
        };
        loadColleges();
    }, []);

    // If clinician, they don't have a college/year in the traditional sense.
    // We can auto-set or pre-fill.
    useEffect(() => {
        if (delegateType === "Clinician") {
            setCollege("Private Practice");
            setYear("N/A");
        }
    }, [delegateType]);

    if (!user) return null;

    // Determine available year options based on program & delegate type
    const getYearOptions = () => {
        if (isIcon) {
            if (delegateType === "PG") {
                return ["1st Year MDS", "2nd Year MDS", "3rd Year MDS"];
            }
            return ["N/A"];
        }
        return ["1st Year", "2nd Year", "3rd Year", "4th Year", "Intern"];
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!college) {
            toast.error("Please select a college");
            return;
        }
        if (!year) {
            toast.error("Please select your year");
            return;
        }

        setIsSubmitting(true);
        try {
            await updateEventStudent(user.id, {
                college,
                year,
            });
            await refreshUser();
            toast.success("Profile updated successfully!");
        } catch (err: any) {
            console.error("Failed to update profile details:", err);
            toast.error(err.message || "Failed to update profile details. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <Card className="w-full max-w-md shadow-2xl border-primary/20">
                <CardHeader className="text-center space-y-3">
                    <div className="mx-auto w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center">
                        <School className="w-7 h-7 text-primary" />
                    </div>
                    <CardTitle className="text-xl">Complete Your Profile</CardTitle>
                    <CardDescription>
                        Please provide your college and year details to access your dashboard.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {delegateType !== "Clinician" && (
                            <>
                                <div className="space-y-2">
                                    <Label htmlFor="college">College</Label>
                                    <Select value={college} onValueChange={setCollege} disabled={isLoadingColleges}>
                                        <SelectTrigger id="college" className="h-12 rounded-xl">
                                            <SelectValue placeholder={isLoadingColleges ? "Loading colleges..." : "Select College"} />
                                        </SelectTrigger>
                                        <SelectContent className="max-h-[250px]">
                                            {colleges.map((col) => (
                                                <SelectItem key={col.value} value={col.label}>
                                                    {col.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="year">Year of Study</Label>
                                    <Select value={year} onValueChange={setYear}>
                                        <SelectTrigger id="year" className="h-12 rounded-xl">
                                            <SelectValue placeholder="Select Year" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {getYearOptions().map((yr) => (
                                                <SelectItem key={yr} value={yr}>
                                                    {yr}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </>
                        )}

                        {delegateType === "Clinician" && (
                            <div className="bg-slate-50 p-4 rounded-xl text-sm text-slate-600 space-y-2">
                                <p><strong>Delegate Type:</strong> Clinician</p>
                                <p>We will automatically set your college as <strong>Private Practice</strong> and Year as <strong>N/A</strong>.</p>
                            </div>
                        )}

                        <Button type="submit" className="w-full h-12 rounded-xl" disabled={isSubmitting || isLoadingColleges}>
                            {isSubmitting ? (
                                <div className="flex items-center gap-2">
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span>Updating...</span>
                                </div>
                            ) : (
                                "Save and Continue"
                            )}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
