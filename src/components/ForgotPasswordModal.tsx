import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Loader2, CheckCircle2 } from "lucide-react";
import { resetUserPassword, resetStudentPassword } from "@/services/supabaseService";
import emailjs from "@emailjs/browser";
import { useToast } from "@/hooks/use-toast";

interface ForgotPasswordModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function ForgotPasswordModal({ isOpen, onClose }: ForgotPasswordModalProps) {
    const [email, setEmail] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const { toast } = useToast();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email) {
            toast({ title: "Email required", description: "Please enter your email address.", variant: "destructive" });
            return;
        }

        setIsLoading(true);

        try {
            // 1. Try resetting member password, if not found try student password
            let tempPassword = "";
            let userType = "Member";

            try {
                tempPassword = await resetUserPassword(email);
            } catch (memberErr: any) {
                if (memberErr.message.includes("No account found")) {
                    tempPassword = await resetStudentPassword(email);
                    userType = "Student";
                } else {
                    throw memberErr;
                }
            }

            // 2. Send email via EmailJS using the same welcome template
            try {
                await emailjs.send(
                    import.meta.env.VITE_EMAILJS_SERVICE_ID,
                    import.meta.env.VITE_EMAILJS_TEMPLATE_ID,
                    {
                        to_email: email,
                        student_email: email,
                        to_name: `${userType} (Password Reset)`,
                        student_name: `${userType} (Password Reset)`,
                        user_name: `${userType} (Password Reset)`,
                        role: `${userType} Password Reset`,
                        temp_password: tempPassword,
                        login_url: window.location.origin + "/member-login",
                    },
                    import.meta.env.VITE_EMAILJS_PUBLIC_KEY
                );

                setIsSuccess(true);
            } catch (emailError) {
                console.error("Email send failed:", emailError);
                toast({
                    title: "Password Reset Data Created",
                    description: `Failed to send email. Ensure EmailJS is configured. Temp password is: ${tempPassword}`,
                    variant: "destructive",
                });
            }
        } catch (error: any) {
            console.error(error);
            toast({
                title: "Reset Failed",
                description: error.message || "Could not process your request.",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleClose = () => {
        setEmail("");
        setIsSuccess(false);
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                        {isSuccess ? <CheckCircle2 className="w-6 h-6 text-green-500" /> : "Forgot Password?"}
                    </DialogTitle>
                    <DialogDescription className="text-base pt-2">
                        {isSuccess
                            ? "We've sent a temporary password to your email. You will be prompted to create a new one when you log in."
                            : "Enter the email address associated with your account and we'll send you a temporary password."}
                    </DialogDescription>
                </DialogHeader>

                {!isSuccess ? (
                    <form onSubmit={handleSubmit} className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="reset-email">Email Address</Label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input
                                    id="reset-email"
                                    type="email"
                                    placeholder="Enter your email"
                                    className="pl-10"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    disabled={isLoading}
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-4">
                            <Button type="button" variant="ghost" onClick={handleClose} disabled={isLoading}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isLoading} className="bg-[#004d40] hover:bg-[#003d33] text-white">
                                {isLoading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Processing...
                                    </>
                                ) : (
                                    "Send Reset Email"
                                )}
                            </Button>
                        </div>
                    </form>
                ) : (
                    <div className="pt-6 flex justify-end">
                        <Button onClick={handleClose} className="bg-[#004d40] hover:bg-[#003d33] text-white">
                            Back to Login
                        </Button>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
