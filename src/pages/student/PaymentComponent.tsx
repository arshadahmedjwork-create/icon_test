import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { CheckCircle, CreditCard, Loader2 } from "lucide-react";
import { Student } from "@/types";
import { generateMidasId, generateQRCodeUrl, sendRegistrationEmail } from "@/services/emailService";
import { getLatestMidasId } from "@/services/supabaseService";
import { useProgram } from "@/contexts/ProgramContext";


declare global {
    interface Window {
        Razorpay: any;
    }
}

export function PaymentComponent({ onPaymentComplete }: { onPaymentComplete: (user: Student) => void }) {
    const { user } = useAuth();
    const { currentProgram } = useProgram();
    const [isProcessing, setIsProcessing] = useState(false);
    
    const isIcon = currentProgram === 'ICON';

    const handlePayment = async () => {
        if (!user) return;

        const razorpayKey = import.meta.env.VITE_RAZORPAY_LIVE_KEY;
        if (!razorpayKey) {
            toast.error("Payment configuration error. Please contact admin.");
            return;
        }

        const options = {
            key: razorpayKey,
            amount: 103000, // ₹1030 in paise
            currency: "INR",
            name: isIcon ? "Madras ICON" : "MIDAS Scientific Event",
            description: isIcon ? "Professional Registration Fee" : "Registration Fee — Conference Kit, Lunch, Certificate",
            handler: async function (response: any) {
                setIsProcessing(true);
                try {
                    // 1. Generate Program ID and QR Code now that payment is successful
                    const latestId = await getLatestMidasId(currentProgram);
                    const midasId = generateMidasId(latestId || 0, currentProgram);
                    const collegeName = user.college || "Dental College";
                    const participantName = user.name || user.participantName || "Delegate";
                    const qrCodeUrl = generateQRCodeUrl(midasId, participantName, collegeName, 300, currentProgram);

                    console.log(`Payment successful. Assigning ${isIcon ? 'ICON' : 'MIDAS'} ID:`, midasId);

                    // 2. Update student payment status AND assign MIDAS ID in Supabase
                    const { error: studentError, data: updatedStudent } = await supabase
                        .from("event_students")
                        .update({
                            paymentStatus: "PAID",
                            paymentId: response.razorpay_payment_id,
                            midasId: midasId,
                            qrCodeUrl: qrCodeUrl,
                        })
                        .eq("id", user.id)
                        .select()
                        .single();


                    if (studentError) throw studentError;

                    // Record payment in payments table
                    await supabase.from("payments").insert({
                        eventStudentId: user.id,
                        amount: 1030,
                        currency: "INR",
                        status: "PAID",
                        paymentGatewayId: response.razorpay_payment_id,
                        transactionId: response.razorpay_payment_id,
                    });

                    // Registration email is not sent after payment to avoid duplicate emails
                    toast.success(`Payment Successful! Your ${isIcon ? 'ICON' : 'MIDAS'} ID is ` + midasId);
                    onPaymentComplete({
                        ...(updatedStudent || user as Student),
                        registrationStatus: "completed",
                        paymentStatus: "completed",
                    });

                } catch (error) {
                    console.error("Payment Error:", error);
                    toast.error("Payment received but update failed. Contact admin with payment ID: " + response.razorpay_payment_id);
                } finally {
                    setIsProcessing(false);
                }
            },
            prefill: {
                name: user.name || user.participantName || "",
                email: user.email,
                contact: user.mobile || "",
            },
            theme: { color: isIcon ? "#b91c1c" : "#004d40" },
            modal: {
                ondismiss: function () {
                    toast.info("Payment cancelled.");
                },
            },
        };

        const rzp = new window.Razorpay(options);
        rzp.on("payment.failed", function (response: any) {
            toast.error("Payment failed: " + (response.error?.description || "Unknown error"));
        });
        rzp.open();
    };

    return (
        <Card className="max-w-md mx-auto mt-8 border-green-200 bg-green-50/50">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="text-green-600 h-6 w-6" />
                    Registration Approved
                </CardTitle>
                <CardDescription className="text-green-700">
                    Your application has been verified by the staff coordinator.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="bg-white p-4 rounded-lg border">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-sm text-muted-foreground">Registration Fee</span>
                        <span className="font-semibold">₹1,030.00</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Includes</span>
                        <span>Conference Kit, Lunch, Certificate</span>
                    </div>
                </div>

                <Button
                    onClick={handlePayment}
                    className="w-full bg-green-600 hover:bg-green-700 font-bold"
                    size="lg"
                    disabled={isProcessing}
                >
                    {isProcessing ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...
                        </>
                    ) : (
                        <>
                            <CreditCard className="mr-2 h-4 w-4" /> Pay ₹1,030
                        </>
                    )}
                </Button>
                <p className="text-xs text-center text-muted-foreground">
                    Secure payment via Razorpay
                </p>
            </CardContent>
        </Card>
    );
}
