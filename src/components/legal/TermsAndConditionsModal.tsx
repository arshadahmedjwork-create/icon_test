import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileText, ShieldCheck } from "lucide-react";

interface TermsAndConditionsModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export default function TermsAndConditionsModal({ open, onOpenChange }: TermsAndConditionsModalProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-3xl rounded-3xl max-h-[85vh] flex flex-col p-6">
                <DialogHeader className="border-b pb-4">
                    <DialogTitle className="text-xl font-bold flex items-center gap-2 text-slate-900">
                        <FileText className="w-5 h-5 text-emerald-700" />
                        MIDAS TERMS & CONDITIONS
                    </DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto pr-2 my-4 space-y-5 text-sm text-slate-700 leading-relaxed font-sans">
                    <section className="space-y-1.5">
                        <h4 className="font-bold text-slate-900 text-base">1. Registration Information</h4>
                        <p>
                            The participant is responsible for ensuring that all information submitted during registration is complete, accurate, current, and genuine. MIDAS may use the submitted information for registration processing, participant identification, communication, verification, event administration, and related purposes.
                        </p>
                    </section>

                    <section className="space-y-1.5">
                        <h4 className="font-bold text-slate-900 text-base">2. Accuracy of Information</h4>
                        <p>
                            The participant confirms that all personal, identification, academic/professional, contact, and other information submitted during registration is accurate. Any false, misleading, incomplete, forged, or inaccurate information may result in cancellation or rejection of registration.
                        </p>
                    </section>

                    <section className="space-y-1.5">
                        <h4 className="font-bold text-slate-900 text-base">3. Identification</h4>
                        <p>
                            The participant must provide a valid ID Card Number and other identification details requested during registration. MIDAS may verify the submitted information where necessary.
                        </p>
                    </section>

                    <section className="space-y-1.5">
                        <h4 className="font-bold text-slate-900 text-base">4. Photograph</h4>
                        <p>
                            The participant must provide a recent, clear, passport-size photograph. The photograph must belong to the participant and must not contain misleading, inappropriate, or unrelated content.
                        </p>
                    </section>

                    <section className="space-y-1.5">
                        <h4 className="font-bold text-slate-900 text-base">5. Payment</h4>
                        <p>
                            Registration is considered complete only after successful payment and confirmation through the MIDAS registration system. The participant is responsible for ensuring that the payment is successfully completed.
                        </p>
                    </section>

                    <section className="space-y-1.5 bg-amber-50 p-4 rounded-xl border border-amber-200">
                        <h4 className="font-bold text-amber-900 text-base">6. Non-Refundable Registration</h4>
                        <p className="text-amber-800 font-medium">
                            All registration/payment amounts are non-refundable unless MIDAS expressly announces otherwise. Participants should carefully review all registration information before making payment.
                        </p>
                    </section>

                    <section className="space-y-1.5">
                        <h4 className="font-bold text-slate-900 text-base">7. Cancellation / Rejection</h4>
                        <p>
                            MIDAS reserves the right to reject or cancel a registration if:
                        </p>
                        <ul className="list-disc pl-5 space-y-1 text-slate-600">
                            <li>False information is submitted.</li>
                            <li>Invalid or fraudulent documents are submitted.</li>
                            <li>Duplicate or suspicious registrations are detected.</li>
                            <li>Registration requirements are not fulfilled.</li>
                            <li>The participant violates applicable MIDAS rules or requirements.</li>
                        </ul>
                        <p className="text-xs text-slate-500 italic mt-1">
                            Such cancellation does not automatically create an entitlement to a refund.
                        </p>
                    </section>

                    <section className="space-y-1.5">
                        <h4 className="font-bold text-slate-900 text-base">8. Communication</h4>
                        <p>
                            Participants are responsible for providing a valid email address and contact information. Important registration and payment-related communication may be sent to the registered email address.
                        </p>
                    </section>

                    <section className="space-y-1.5">
                        <h4 className="font-bold text-slate-900 text-base">9. Data Usage</h4>
                        <p>
                            Information submitted during registration may be stored and processed for legitimate MIDAS registration, administration, communication, verification, and event-related purposes.
                        </p>
                    </section>

                    <section className="space-y-1.5">
                        <h4 className="font-bold text-slate-900 text-base">10. Acceptance</h4>
                        <p>
                            By submitting the registration and accepting these Terms & Conditions, the participant confirms that they have read, understood, and agreed to these terms.
                        </p>
                    </section>
                </div>

                <DialogFooter className="border-t pt-3 flex justify-between items-center sm:justify-end">
                    <Button onClick={() => onOpenChange(false)} className="rounded-xl font-bold bg-[#004d40] hover:bg-[#003d33]">
                        <ShieldCheck className="w-4 h-4 mr-2" /> Close & I Understand
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
