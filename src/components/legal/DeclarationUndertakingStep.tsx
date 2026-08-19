import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AlertTriangle, Edit3, ShieldCheck, FileText, CreditCard, Loader2, UserCheck, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import TermsAndConditionsModal from "./TermsAndConditionsModal";
import RefundPolicyModal from "./RefundPolicyModal";

interface DeclarationUndertakingStepProps {
    formData: {
        firstName: string;
        lastName: string;
        email: string;
        mobile: string;
        idCardNumber: string;
        gender: string;
        college: string;
        otherCollege?: string;
        year: string;
        course?: string;
        // ICON fields
        dciNumber?: string;
        speciality?: string;
        qualification?: string;
        delegateType?: string;
    };
    passportPhotoPreviewUrl?: string | null;
    bonafideFileName?: string | null;
    dciCertFileName?: string | null;
    isIcon?: boolean;
    themeColor?: string;
    onEditRegistration: () => void;
    onProceedToPayment: (acceptanceData: {
        declarationAccepted: boolean;
        termsAccepted: boolean;
        refundPolicyAccepted: boolean;
        termsVersion: string;
        refundPolicyVersion: string;
    }) => void;
    isProcessing?: boolean;
}

export default function DeclarationUndertakingStep({
    formData,
    passportPhotoPreviewUrl,
    bonafideFileName,
    dciCertFileName,
    isIcon = false,
    themeColor = "#004d40",
    onEditRegistration,
    onProceedToPayment,
    isProcessing = false,
}: DeclarationUndertakingStepProps) {
    const [check1, setCheck1] = useState(false);
    const [check2, setCheck2] = useState(false);
    const [check3, setCheck3] = useState(false);

    const [openTermsModal, setOpenTermsModal] = useState(false);
    const [openRefundModal, setOpenRefundModal] = useState(false);

    const allChecked = check1 && check2 && check3;

    const handlePaymentClick = () => {
        if (!allChecked) {
            toast.error("Please accept all mandatory declarations, Terms & Conditions, and Refund Policy before proceeding to payment.");
            return;
        }
        onProceedToPayment({
            declarationAccepted: true,
            termsAccepted: true,
            refundPolicyAccepted: true,
            termsVersion: "1.0",
            refundPolicyVersion: "1.0",
        });
    };

    const fullName = `${formData.firstName.trim()} ${formData.lastName.trim()}`;
    const collegeDisplay = formData.college === "Other" ? formData.otherCollege : formData.college;

    return (
        <div className="space-y-6 max-w-3xl mx-auto font-sans">
            {/* Header / Progress Card */}
            <Card className="border-slate-200 shadow-md rounded-3xl overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white p-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center border border-white/20">
                                <ShieldCheck className="w-6 h-6 text-emerald-400" />
                            </div>
                            <div>
                                <CardTitle className="text-xl font-bold tracking-tight">
                                    Student Declaration & Undertaking
                                </CardTitle>
                                <CardDescription className="text-slate-300 text-xs mt-0.5">
                                    Step 2 of 4 — Review details and accept terms before payment
                                </CardDescription>
                            </div>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-6 space-y-6">

                    {/* Pre-Payment Review Section */}
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                            <h4 className="font-bold text-slate-900 text-base flex items-center gap-2">
                                <UserCheck className="w-4 h-4 text-slate-600" /> Review Your Registration
                            </h4>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={onEditRegistration}
                                className="h-8 rounded-xl text-xs font-semibold border-slate-300 text-slate-700 hover:bg-slate-100"
                            >
                                <Edit3 className="w-3.5 h-3.5 mr-1 text-slate-500" /> Edit Registration
                            </Button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                            <div>
                                <span className="text-slate-400 font-semibold uppercase tracking-wider block">Full Name</span>
                                <span className="font-bold text-slate-800 text-sm">{fullName}</span>
                            </div>
                            <div>
                                <span className="text-slate-400 font-semibold uppercase tracking-wider block">ID Card Number</span>
                                <span className="font-mono font-bold text-slate-900 text-sm bg-slate-200/60 px-2 py-0.5 rounded-md inline-block">
                                    {formData.idCardNumber || "—"}
                                </span>
                            </div>
                            <div>
                                <span className="text-slate-400 font-semibold uppercase tracking-wider block">Gender</span>
                                <span className="font-semibold text-slate-800">{formData.gender || "—"}</span>
                            </div>
                            <div>
                                <span className="text-slate-400 font-semibold uppercase tracking-wider block">Email Address</span>
                                <span className="font-semibold text-slate-800">{formData.email}</span>
                            </div>
                            <div>
                                <span className="text-slate-400 font-semibold uppercase tracking-wider block">Mobile Number</span>
                                <span className="font-semibold text-slate-800">{formData.mobile}</span>
                            </div>
                            <div>
                                <span className="text-slate-400 font-semibold uppercase tracking-wider block">College / Institution</span>
                                <span className="font-semibold text-slate-800">{collegeDisplay || "—"}</span>
                            </div>
                            {!isIcon ? (
                                <div>
                                    <span className="text-slate-400 font-semibold uppercase tracking-wider block">Year of Study</span>
                                    <span className="font-semibold text-slate-800">{formData.year || "—"}</span>
                                </div>
                            ) : (
                                <div>
                                    <span className="text-slate-400 font-semibold uppercase tracking-wider block">DCI Number</span>
                                    <span className="font-mono font-bold text-slate-800">{formData.dciNumber || "—"}</span>
                                </div>
                            )}
                        </div>

                        {/* Photo Preview Thumbnail */}
                        {passportPhotoPreviewUrl && (
                            <div className="border-t border-slate-200 pt-3 flex items-center gap-4">
                                <div className="w-16 h-16 rounded-xl overflow-hidden border border-slate-300 bg-white shrink-0 shadow-sm">
                                    <img src={passportPhotoPreviewUrl} alt="Passport Preview" className="w-full h-full object-cover" />
                                </div>
                                <div className="text-xs">
                                    <span className="font-bold text-slate-800 block flex items-center gap-1">
                                        <ImageIcon className="w-3.5 h-3.5 text-slate-500" /> Passport Size Photograph
                                    </span>
                                    <span className="text-emerald-700 font-medium">✓ Uploaded & verified</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Non-Refundable Warning Banner */}
                    <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 flex items-start gap-3 shadow-sm">
                        <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                            <h5 className="font-bold text-amber-900 text-sm">
                                Important: Registration payments are non-refundable.
                            </h5>
                            <p className="text-xs text-amber-800 leading-relaxed font-medium">
                                Please carefully verify all details above before proceeding to payment. Information submitted cannot be altered after payment confirmation.
                            </p>
                        </div>
                    </div>

                    {/* Declaration Text Box */}
                    <div className="space-y-3">
                        <h4 className="font-bold text-slate-900 text-base uppercase tracking-wider">
                            STUDENT DECLARATION & UNDERTAKING
                        </h4>
                        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 max-h-60 overflow-y-auto space-y-3 text-xs text-slate-700 leading-relaxed font-sans shadow-inner">
                            <p>
                                I hereby declare and undertake that all the information and documents/details provided by me during the {isIcon ? "Madras ICON" : "MIDAS"} registration process are true, accurate, complete, and genuine to the best of my knowledge and belief.
                            </p>
                            <p>
                                I understand that the information submitted by me will be used for registration, verification, identification, communication, event administration, and other legitimate purposes associated with {isIcon ? "Madras ICON" : "MIDAS"}.
                            </p>
                            <p>
                                I confirm that the ID Card Number, personal details, gender, photograph, contact details, academic/professional information, and any other information submitted by me belong to me and are accurate.
                            </p>
                            <p>
                                I understand that providing false, misleading, incomplete, forged, or incorrect information may result in rejection or cancellation of my registration, without any liability on the part of {isIcon ? "Madras ICON" : "MIDAS"}.
                            </p>
                            <p>
                                I agree to provide genuine and valid information and documents whenever requested by the {isIcon ? "Madras ICON" : "MIDAS"} administration.
                            </p>
                            <p>
                                I understand that I am responsible for reviewing all the information entered during registration before making payment.
                            </p>
                            <p className="font-bold text-slate-900 bg-amber-100/70 p-2 rounded-lg border border-amber-200">
                                I further understand and agree that the registration/payment amount paid for {isIcon ? "Madras ICON" : "MIDAS"} is <span className="text-red-700 underline font-extrabold">non-refundable</span>, except where {isIcon ? "Madras ICON" : "MIDAS"} expressly determines otherwise in writing.
                            </p>
                            <p>
                                By proceeding with payment, I confirm that I have read, understood, and voluntarily accepted the above declaration, the Terms & Conditions, and the Refund Policy.
                            </p>
                        </div>
                    </div>

                    {/* Mandatory Acceptance Checkboxes */}
                    <div className="space-y-4 pt-2 border-t border-slate-200">
                        <h4 className="font-bold text-slate-900 text-sm">
                            Mandatory Acknowledgements *
                        </h4>

                        {/* Checkbox 1 */}
                        <div className="flex items-start space-x-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200 hover:border-slate-300 transition-colors">
                            <Checkbox
                                id="check1"
                                checked={check1}
                                onCheckedChange={(checked) => setCheck1(!!checked)}
                                className="mt-0.5 h-5 w-5 rounded-md border-slate-400 data-[state=checked]:bg-[#004d40]"
                            />
                            <label htmlFor="check1" className="text-xs font-semibold text-slate-800 leading-snug cursor-pointer select-none">
                                I confirm that all information and documents submitted by me are true, accurate, complete, and genuine.
                            </label>
                        </div>

                        {/* Checkbox 2 */}
                        <div className="flex items-start space-x-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200 hover:border-slate-300 transition-colors">
                            <Checkbox
                                id="check2"
                                checked={check2}
                                onCheckedChange={(checked) => setCheck2(!!checked)}
                                className="mt-0.5 h-5 w-5 rounded-md border-slate-400 data-[state=checked]:bg-[#004d40]"
                            />
                            <div className="text-xs leading-snug">
                                <label htmlFor="check2" className="font-semibold text-slate-800 cursor-pointer select-none">
                                    I have read and agree to the {isIcon ? "Madras ICON" : "MIDAS"}{" "}
                                </label>
                                <button
                                    type="button"
                                    onClick={() => setOpenTermsModal(true)}
                                    className="font-bold text-blue-700 hover:underline inline-flex items-center gap-0.5"
                                >
                                    Terms & Conditions <FileText className="w-3 h-3" />
                                </button>
                            </div>
                        </div>

                        {/* Checkbox 3 */}
                        <div className="flex items-start space-x-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200 hover:border-slate-300 transition-colors">
                            <Checkbox
                                id="check3"
                                checked={check3}
                                onCheckedChange={(checked) => setCheck3(!!checked)}
                                className="mt-0.5 h-5 w-5 rounded-md border-slate-400 data-[state=checked]:bg-[#004d40]"
                            />
                            <div className="text-xs leading-snug">
                                <label htmlFor="check3" className="font-semibold text-slate-800 cursor-pointer select-none">
                                    I have read and agree to the {isIcon ? "Madras ICON" : "MIDAS"}{" "}
                                </label>
                                <button
                                    type="button"
                                    onClick={() => setOpenRefundModal(true)}
                                    className="font-bold text-red-700 hover:underline inline-flex items-center gap-0.5"
                                >
                                    Refund Policy <FileText className="w-3 h-3" />
                                </button>
                                <span className="font-semibold text-slate-800"> and understand that the registration/payment amount is non-refundable.</span>
                            </div>
                        </div>
                    </div>

                    {/* Action Button */}
                    <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row gap-3 items-center justify-between">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={onEditRegistration}
                            className="text-slate-600 hover:text-slate-900 text-sm font-semibold w-full sm:w-auto"
                        >
                            Back to Form
                        </Button>

                        <Button
                            type="button"
                            onClick={handlePaymentClick}
                            disabled={isProcessing}
                            className={`w-full sm:w-auto h-14 px-8 text-white rounded-xl shadow-lg transition-all text-base font-bold flex items-center justify-center gap-2 ${
                                !allChecked ? "opacity-60 cursor-not-allowed" : "hover:scale-[1.01] active:scale-[0.99]"
                            }`}
                            style={{ backgroundColor: themeColor }}
                        >
                            {isProcessing ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" /> Preparing Payment...
                                </>
                            ) : (
                                <>
                                    <CreditCard className="w-5 h-5" /> Proceed to Payment
                                </>
                            )}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Terms Modal */}
            <TermsAndConditionsModal
                open={openTermsModal}
                onOpenChange={setOpenTermsModal}
            />

            {/* Refund Policy Modal */}
            <RefundPolicyModal
                open={openRefundModal}
                onOpenChange={setOpenRefundModal}
            />
        </div>
    );
}
