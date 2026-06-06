import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Lock, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { comparePassword, updateMemberPassword, updateStudentPassword } from "@/services/supabaseService";
import { useToast } from "@/hooks/use-toast";

export default function ChangePasswordModal() {
    const { user, clearMustChangePassword } = useAuth();
    const { toast } = useToast();
    const [oldPassword, setOldPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showOld, setShowOld] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (newPassword.length < 6) {
            setError("Password must be at least 6 characters");
            return;
        }
        if (newPassword !== confirmPassword) {
            setError("Passwords do not match");
            return;
        }

        if (!user) return;

        setIsSubmitting(true);
        try {
            const isStudent = user.role === 'student';
            const table = isStudent ? 'event_students' : 'members';

            // Verify old password by fetching record and comparing
            const { supabase } = await import("@/lib/supabaseClient");
            const { data: record } = await supabase
                .from(table)
                .select('password')
                .eq('id', user.id)
                .single();

            if (!record) {
                setError("User account not found");
                return;
            }

            const isValid = await comparePassword(oldPassword, record.password);
            if (!isValid) {
                setError("Current password is incorrect");
                return;
            }

            // Update password
            if (isStudent) {
                await updateStudentPassword(user.id, newPassword);
            } else {
                await updateMemberPassword(user.id, newPassword);
            }

            // Clear the flag in context
            clearMustChangePassword();

            toast({
                title: "Password Changed",
                description: "Your password has been updated successfully.",
            });
        } catch (err: any) {
            setError(err.message || "Failed to change password");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <Card className="w-full max-w-md shadow-2xl border-primary/20">
                <CardHeader className="text-center space-y-3">
                    <div className="mx-auto w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center">
                        <ShieldCheck className="w-7 h-7 text-primary" />
                    </div>
                    <CardTitle className="text-xl">Change Your Password</CardTitle>
                    <CardDescription>
                        You're using a temporary password. Please create a new password to continue.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="old-password">Current (Temporary) Password</Label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input
                                    id="old-password"
                                    type={showOld ? "text" : "password"}
                                    value={oldPassword}
                                    onChange={(e) => setOldPassword(e.target.value)}
                                    className="pl-10 pr-10"
                                    placeholder="Enter temporary password"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowOld(!showOld)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                >
                                    {showOld ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="new-password">New Password</Label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input
                                    id="new-password"
                                    type={showNew ? "text" : "password"}
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className="pl-10 pr-10"
                                    placeholder="Min 6 characters"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowNew(!showNew)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                >
                                    {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="confirm-password">Confirm New Password</Label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input
                                    id="confirm-password"
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="pl-10"
                                    placeholder="Repeat new password"
                                    required
                                />
                            </div>
                        </div>

                        {error && (
                            <p className="text-sm text-red-500 font-medium">{error}</p>
                        )}

                        <Button type="submit" className="w-full" disabled={isSubmitting}>
                            {isSubmitting ? "Updating..." : "Set New Password"}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
