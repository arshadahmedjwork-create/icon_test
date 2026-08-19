import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertCircle, ShieldAlert } from "lucide-react";

interface RefundPolicyModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export default function RefundPolicyModal({ open, onOpenChange }: RefundPolicyModalProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-3xl rounded-3xl max-h-[85vh] flex flex-col p-6">
                <DialogHeader className="border-b pb-4">
                    <DialogTitle className="text-xl font-bold flex items-center gap-2 text-red-700">
                        <AlertCircle className="w-5 h-5 text-red-700" />
                        MIDAS REFUND POLICY
                    </DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto pr-2 my-4 space-y-5 text-sm text-slate-700 leading-relaxed font-sans">
                    <section className="bg-red-50 p-4 rounded-xl border border-red-200 space-y-1.5">
                        <h4 className="font-bold text-red-900 text-base">1. General Policy</h4>
                        <p className="text-red-800 font-semibold">
                            All registration fees and payments made through the MIDAS registration system are non-refundable. Participants are therefore advised to carefully verify all registration information before completing payment.
                        </p>
                    </section>

                    <section className="space-y-1.5">
                        <h4 className="font-bold text-slate-900 text-base">2. Incorrect Information</h4>
                        <p>
                            If a participant enters incorrect, incomplete, or inaccurate information during registration and subsequently completes payment, the payment will not be refundable on that basis. Participants must review their registration details before proceeding to payment.
                        </p>
                    </section>

                    <section className="space-y-1.5">
                        <h4 className="font-bold text-slate-900 text-base">3. Duplicate Registration</h4>
                        <p>
                            Payments made for duplicate registrations are non-refundable unless MIDAS expressly approves an exception.
                        </p>
                    </section>

                    <section className="space-y-1.5">
                        <h4 className="font-bold text-slate-900 text-base">4. Change of Mind</h4>
                        <p>
                            Refunds will not be provided if a participant changes their mind or no longer wishes to participate after completing payment.
                        </p>
                    </section>

                    <section className="space-y-1.5">
                        <h4 className="font-bold text-slate-900 text-base">5. Registration Rejection</h4>
                        <p>
                            If registration is rejected because of incorrect, false, incomplete, invalid, or unverifiable information provided by the participant, the registration fee will generally remain non-refundable.
                        </p>
                    </section>

                    <section className="space-y-1.5">
                        <h4 className="font-bold text-slate-900 text-base">6. Technical Payment Issues</h4>
                        <p>
                            If a payment is deducted from the participant's bank/card/account but the MIDAS system does not receive confirmation of the transaction, the transaction may be verified with the payment gateway/bank. Where the payment gateway confirms a failed transaction and the amount is subsequently reversed, the reversal will be handled according to the payment gateway/bank's applicable processing timelines. This does not constitute a general refund entitlement.
                        </p>
                    </section>

                    <section className="space-y-1.5">
                        <h4 className="font-bold text-slate-900 text-base">7. Exceptional Circumstances</h4>
                        <p>
                            Any exception to this Refund Policy will be entirely at the discretion of MIDAS and must be expressly approved by the authorized MIDAS administration.
                        </p>
                    </section>

                    <section className="space-y-1.5">
                        <h4 className="font-bold text-slate-900 text-base">8. Acceptance</h4>
                        <p>
                            By completing payment, the participant confirms that they have read, understood, and accepted this Refund Policy and agree that the registration payment is non-refundable unless MIDAS expressly determines otherwise.
                        </p>
                    </section>
                </div>

                <DialogFooter className="border-t pt-3 flex justify-between items-center sm:justify-end">
                    <Button onClick={() => onOpenChange(false)} className="rounded-xl font-bold bg-red-700 hover:bg-red-800 text-white">
                        <ShieldAlert className="w-4 h-4 mr-2" /> Close & I Understand
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
