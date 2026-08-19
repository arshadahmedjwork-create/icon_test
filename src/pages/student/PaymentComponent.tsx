import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toast } from "sonner";
import { CheckCircle, CreditCard, Loader2, ShieldCheck } from "lucide-react";
import { Student } from "@/types";
import { generateMidasId, generateQRCodeUrl, sendPaymentSuccessEmail } from "@/services/emailService";
import { getLatestMidasId, recordUndertakingAcceptance } from "@/services/supabaseService";
import { useProgram } from "@/contexts/ProgramContext";
import DeclarationUndertakingStep from "@/components/legal/DeclarationUndertakingStep";

declare global {
    interface Window {
        Razorpay: any;
    }
}

export function PaymentComponent({ onPaymentComplete }: { onPaymentComplete: (user: Student) => void }) {
    const { user } = useAuth();
    const { currentProgram } = useProgram();
    const [isProcessing, setIsProcessing] = useState(false);
    const [showDeclarationModal, setShowDeclarationModal] = useState(false);

    const isIcon = currentProgram === 'ICON';
    const themeColor = isIcon ? "#b91c1c" : "#004d40";

    const handleOpenDeclaration = () => {
        setShowDeclarationModal(true);
    };

    const handleProceedToPayment = async (acceptanceData: {
        declarationAccepted: boolean;
        termsAccepted: boolean;
        refundPolicyAccepted: boolean;
        termsVersion: string;
        refundPolicyVersion: string;
    }) => {
        if (!user) return;
        setIsProcessing(true);

        const processSuccess = async (paymentId: string) => {
            try {
                // 1. Generate Program MIDAS ID and QR Code
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
                        paymentId: paymentId,
                        midasId: midasId,
                        qrCodeUrl: qrCodeUrl,
                        declarationAccepted: acceptanceData.declarationAccepted,
                        termsAccepted: acceptanceData.termsAccepted,
                        refundPolicyAccepted: acceptanceData.refundPolicyAccepted,
                        termsVersion: acceptanceData.termsVersion,
                        refundPolicyVersion: acceptanceData.refundPolicyVersion,
                        acceptedAt: new Date().toISOString(),
                    })
                    .eq("id", user.id)
                    .select()
                    .single();

                if (studentError) throw studentError;

                // 3. Record payment in payments table
                await supabase.from("payments").insert({
                    eventStudentId: user.id,
                    amount: 1,
                    currency: "INR",
                    status: "PAID",
                    paymentGatewayId: paymentId,
                    transactionId: paymentId,
                    program: currentProgram,
                });

                // 4. Record Audit log
                await recordUndertakingAcceptance({
                    eventStudentId: user.id,
                    idCardNumber: (user as any).idCardNumber || (user as any).mobile || user.id,
                    declarationAccepted: true,
                    termsAccepted: true,
                    refundPolicyAccepted: true,
                    termsVersion: acceptanceData.termsVersion,
                    refundPolicyVersion: acceptanceData.refundPolicyVersion,
                    paymentReference: paymentId,
                });

                // 5. Send Payment Confirmation Email
                try {
                    await sendPaymentSuccessEmail({
                        student_name: participantName,
                        student_email: user.email,
                        midas_id: midasId,
                        id_card_number: (user as any).idCardNumber || "N/A",
                        payment_reference: paymentId,
                        amount_paid: "₹1.00",
                        payment_date: new Date().toLocaleDateString("en-IN"),
                        college_name: collegeName,
                        event_type: isIcon ? "Professional Delegate" : "UG Delegate",
                        qr_code_url: qrCodeUrl,
                    });
                } catch (emailErr) {
                    console.error("Email sending error:", emailErr);
                }

                toast.success(`Payment Successful! Your ${isIcon ? 'ICON' : 'MIDAS'} ID is ${midasId}`);
                setShowDeclarationModal(false);
                onPaymentComplete({
                    ...(updatedStudent || user as Student),
                    midasId: midasId,
                    registrationStatus: "completed",
                    paymentStatus: "completed",
                });

            } catch (error) {
                console.error("Payment Error:", error);
                toast.error("Payment received but update failed. Contact admin with payment ID: " + paymentId);
            } finally {
                setIsProcessing(false);
            }
        };

        const razorpayKey = import.meta.env.VITE_RAZORPAY_LIVE_KEY;
        if (!razorpayKey) {
            toast.error("Payment configuration error. Please contact admin.");
            setIsProcessing(false);
            return;
        }

        const options = {
            key: razorpayKey,
            amount: 100, // ₹1 in paise
            currency: "INR",
            name: isIcon ? "Madras ICON" : "MIDAS Scientific Event",
            description: isIcon ? "Professional Registration Fee" : "Registration Fee — Conference Kit, Lunch, Certificate",
            handler: async function (response: any) {
                await processSuccess(response.razorpay_payment_id);
            },
            prefill: {
                name: user.name || user.participantName || "",
                email: user.email,
                contact: user.mobile || "",
            },
            theme: { color: themeColor },
            modal: {
                ondismiss: function () {
                    setIsProcessing(false);
                    toast.info("Payment cancelled.");
                },
            },
        };

        const rzp = new window.Razorpay(options);
        rzp.on("payment.failed", function (response: any) {
            setIsProcessing(false);
            toast.error("Payment failed: " + (response.error?.description || "Unknown error"));
        });
        rzp.open();
    };

    const nameParts = (user?.name || "").split(" ");
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || "";

    const userFormData = {
        firstName,
        lastName,
        email: user?.email || "",
        mobile: user?.mobile || user?.phone || "",
        idCardNumber: (user as any)?.idCardNumber || (user as any)?.mobile || "N/A",
        gender: (user as any)?.gender || "Not specified",
        college: user?.college || "",
        year: user?.year || "N/A",
        dciNumber: (user as any)?.dciNumber || "",
        delegateType: (user as any)?.delegateType || (isIcon ? "PG" : "UG"),
    };

    return (
        <>
            <Card className="max-w-md mx-auto mt-8 border-green-200 bg-green-50/50">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <CheckCircle className="text-green-600 h-6 w-6" />
                        Registration Verification
                    </CardTitle>
                    <CardDescription className="text-green-700">
                        Please complete your fee payment to receive your {isIcon ? 'ICON' : 'MIDAS'} ID.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="bg-white p-4 rounded-lg border">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-sm text-muted-foreground">Registration Fee</span>
                            <span className="font-semibold">₹1.00</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">Includes</span>
                            <span>Conference Kit, Lunch, Certificate</span>
                        </div>
                    </div>

                    <div className="flex flex-col gap-2">
                        <Button
                            onClick={handleOpenDeclaration}
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
                                    <CreditCard className="mr-2 h-4 w-4" /> Review & Pay ₹1.00
                                </>
                            )}
                        </Button>
                    </div>

                    <p className="text-xs text-center text-muted-foreground">
                        Requires legal undertaking confirmation before payment.
                    </p>
                </CardContent>
            </Card>

            <Dialog open={showDeclarationModal} onOpenChange={setShowDeclarationModal}>
                <DialogContent className="sm:max-w-3xl rounded-3xl p-4 max-h-[90vh] overflow-y-auto">
                    <DeclarationUndertakingStep
                        formData={userFormData}
                        passportPhotoPreviewUrl={(user as any)?.passportPhotoUrl}
                        isIcon={isIcon}
                        themeColor={themeColor}
                        onEditRegistration={() => setShowDeclarationModal(false)}
                        onProceedToPayment={handleProceedToPayment}
                        isProcessing={isProcessing}
                    />
                </DialogContent>
            </Dialog>
        </>
    );
}
