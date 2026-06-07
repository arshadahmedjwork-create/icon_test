
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
    CreditCard, CheckCircle2, Clock, AlertTriangle,
    Wallet, Receipt, Loader2
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getStudentPayments } from "@/services/supabaseService";

interface PaymentItem {
    id: string;
    eventName: string;
    eventType: string;
    amount: number;
    status: "PENDING" | "PAID" | "FAILED";
    transactionId: string | null;
    paymentDate: string | null;
}

const statusConfig = {
    PENDING: { label: "Unpaid", icon: Clock, color: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500" },
    PAID: { label: "Paid", icon: CheckCircle2, color: "bg-green-50 text-green-700 border-green-200", dot: "bg-green-500" },
    FAILED: { label: "Failed", icon: AlertTriangle, color: "bg-red-50 text-red-700 border-red-200", dot: "bg-red-500" },
};

export default function StudentPaymentsPage() {
    const { user, refreshUser } = useAuth();
    const [payments, setPayments] = useState<PaymentItem[]>([]);
    const [paying, setPaying] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Load razorpay script
        if (typeof window !== "undefined" && !(window as any).Razorpay) {
            const script = document.createElement("script");
            script.src = "https://checkout.razorpay.com/v1/checkout.js";
            script.async = true;
            document.body.appendChild(script);
        }

        if (user?.id) {
            loadPayments();
        }
    }, [user?.id]);

    const loadPayments = async () => {
        try {
            setIsLoading(true);
            const data = await getStudentPayments(user!.id);
            // Map Supabase payments table to UI PaymentItem array.
            // Note: Since 'payments' table just logs transactions, we default the event name/type.
            const mapped: PaymentItem[] = data.map((p: any) => ({
                id: p.id,
                eventName: p.amount === 1030 ? "Delegate Registration Fee" : "Event Registration Fee",
                eventType: p.amount === 1030 ? "REGISTRATION" : "EVENT",
                amount: p.amount,
                status: p.status,
                transactionId: p.transactionId || p.paymentGatewayId || p.id,
                paymentDate: p.created_at || p.paymentDate,
            }));

            // If the user's registration is approved but they haven't paid the base fee, 
            // ensure there's a PENDING payment showing.
            if (user?.approvalStatus === "APPROVED" && mapped.length === 0) {
                mapped.push({
                    id: "pending_reg",
                    eventName: "Delegate Registration Fee",
                    eventType: "REGISTRATION",
                    amount: 1030,
                    status: "PENDING",
                    transactionId: null,
                    paymentDate: null
                });
            }

            setPayments(mapped);
        } catch (error) {
            console.error("Failed to load payments", error);
            toast.error("Could not load payment history.");
        } finally {
            setIsLoading(false);
        }
    };

    const displayPayments = [...payments];
    // Dynamically inject the pending registration fee if they are approved but haven't paid it yet
    if (user?.approvalStatus === "APPROVED" && user?.paymentStatus !== "PAID") {
        if (!displayPayments.some(p => p.eventType === "REGISTRATION" && p.status === "PENDING")) {
            displayPayments.unshift({
                id: "pending_reg",
                eventName: "Delegate Registration Fee",
                eventType: "REGISTRATION",
                amount: 1030,
                status: "PENDING",
                transactionId: null,
                paymentDate: null
            });
        }
    }

    const totalPaid = displayPayments.filter(p => p.status === "PAID").reduce((s, p) => s + p.amount, 0);
    const totalPending = displayPayments.filter(p => p.status === "PENDING").reduce((s, p) => s + p.amount, 0);

    const handlePayNow = (payment: PaymentItem, isTest: boolean = false) => {
        const razorpayKey = import.meta.env.VITE_RAZORPAY_LIVE_KEY;
        if (!razorpayKey) {
            toast.error("Payment configuration error. Please contact admin.");
            return;
        }

        const options = {
            key: razorpayKey,
            amount: isTest ? 100 : payment.amount * 100, // Convert to paise
            currency: "INR",
            name: "MIDAS Scientific Event",
            description: isTest ? `TEST - ${payment.eventName}` : payment.eventName,
            handler: function (response: any) {
                setPayments(prev => prev.map(p => p.id === payment.id ? {
                    ...p, status: "PAID" as const, transactionId: response.razorpay_payment_id, paymentDate: new Date().toISOString()
                } : p));

                // Add to actual supabase payments table immediately if it was the generated one
                if (payment.id === "pending_reg") {
                    import("@/lib/supabaseClient").then(({ supabase }) => {
                        supabase.from("payments").insert({
                            eventStudentId: user?.id,
                            amount: payment.amount,
                            currency: "INR",
                            status: "PAID",
                            paymentGatewayId: response.razorpay_payment_id,
                            transactionId: response.razorpay_payment_id,
                        }).then(() => {
                            // Also update the student record to PAID
                            supabase.from("event_students").update({
                                paymentStatus: "PAID",
                                paymentId: response.razorpay_payment_id
                            }).eq("id", user?.id).then(() => {
                                refreshUser(); // Reload context
                            });
                        });
                    });
                } else {
                    import("@/lib/supabaseClient").then(({ supabase }) => {
                        supabase.from("payments").insert({
                            eventStudentId: user?.id,
                            amount: payment.amount,
                            currency: "INR",
                            status: "PAID",
                            paymentGatewayId: response.razorpay_payment_id,
                            transactionId: response.razorpay_payment_id,
                        }).then(() => {
                            refreshUser(); // Reload context
                        });
                    });
                }

                setPaying(null);
                toast.success(`Payment of ₹${payment.amount} successful!`);
            },
            theme: { color: isTest ? "#d97706" : "#004d40" },
            modal: {
                ondismiss: function () {
                    setPaying(null);
                    toast.info("Payment cancelled.");
                },
            },
        };

        setPaying(payment.id);
        const rzp = new (window as any).Razorpay(options);
        rzp.on("payment.failed", function (response: any) {
            setPaying(null);
            toast.error("Payment failed: " + (response.error?.description || "Unknown error"));
        });
        rzp.open();
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Payments</h1>
                    <p className="text-sm text-slate-500 mt-1">Track all your registration and event payments.</p>
                </div>

                {/* Header Ad Box */}
                <div className="flex-grow bg-red-600 border border-red-700 rounded-2xl overflow-hidden shadow-sm flex items-center justify-center h-[110px]">
                    <img src="/silver.png" alt="Silver Sponsor" className="w-full h-full object-contain p-1" />
                </div>
            </div>

            {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                    <Loader2 className="w-10 h-10 animate-spin mb-4 text-[#004d40]" />
                    <p className="font-medium">Loading payments...</p>
                </div>
            ) : displayPayments.length === 0 ? (
                <div className="text-center py-16 text-slate-400">
                    <CreditCard className="w-12 h-12 mx-auto mb-3 text-slate-200" />
                    <p className="font-medium">No payments yet</p>
                    <p className="text-sm mt-1">Your payment details will appear here once approved by the staff.</p>
                </div>
            ) : (
                <>
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
                                    <Receipt className="w-5 h-5 text-slate-500" />
                                </div>
                                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Transactions</span>
                            </div>
                            <p className="text-3xl font-black text-slate-900">{displayPayments.length}</p>
                        </div>
                        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
                                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                                </div>
                                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Paid</span>
                            </div>
                            <p className="text-3xl font-black text-green-700">₹{totalPaid.toLocaleString()}</p>
                        </div>
                        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                                    <Wallet className="w-5 h-5 text-amber-600" />
                                </div>
                                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Pending</span>
                            </div>
                            <p className="text-3xl font-black text-amber-700">₹{totalPending.toLocaleString()}</p>
                        </div>
                    </div>

                    {/* Payments Table */}
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                        {/* Desktop Table */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-slate-100">
                                        <th className="text-left px-5 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider">Event</th>
                                        <th className="text-left px-5 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider">Type</th>
                                        <th className="text-left px-5 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider">Amount</th>
                                        <th className="text-left px-5 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider">Status</th>
                                        <th className="text-left px-5 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider">Transaction ID</th>
                                        <th className="text-left px-5 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider">Date</th>
                                        <th className="text-right px-5 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {displayPayments.map((p) => {
                                        const cfg = statusConfig[p.status];
                                        return (
                                            <tr key={p.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                                                <td className="px-5 py-4 font-medium text-slate-800 max-w-[200px] truncate">{p.eventName}</td>
                                                <td className="px-5 py-4 text-slate-500">{p.eventType}</td>
                                                <td className="px-5 py-4 font-bold text-slate-900">₹{p.amount}</td>
                                                <td className="px-5 py-4">
                                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${cfg.color}`}>
                                                        <div className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                                                        {cfg.label}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-4 text-xs font-mono text-slate-500">{p.transactionId || "—"}</td>
                                                <td className="px-5 py-4 text-slate-500">
                                                    {p.paymentDate ? new Date(p.paymentDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                                                </td>
                                                <td className="px-5 py-4 text-right">
                                                    {p.status === "PENDING" && (
                                                        <div className="flex gap-2 justify-end">
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                className="h-8 rounded-lg border-amber-300 text-amber-700 hover:bg-amber-100 font-bold border-dashed text-xs"
                                                                onClick={() => handlePayNow(p, true)}
                                                                disabled={paying === p.id}
                                                            >
                                                                Test
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                className="h-8 rounded-lg bg-[#004d40] hover:bg-[#003d33] text-xs font-bold"
                                                                onClick={() => handlePayNow(p, false)}
                                                                disabled={paying === p.id}
                                                            >
                                                                {paying === p.id ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <CreditCard className="w-3 h-3 mr-1" />}
                                                                {paying === p.id ? "Processing..." : "Pay Now"}
                                                            </Button>
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile Cards */}
                        <div className="md:hidden divide-y divide-slate-100">
                            {displayPayments.map((p) => {
                                const cfg = statusConfig[p.status];
                                return (
                                    <div key={p.id} className="p-4 space-y-3">
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <h4 className="font-bold text-sm text-slate-800">{p.eventName}</h4>
                                                <p className="text-xs text-slate-400 mt-0.5">{p.eventType}</p>
                                            </div>
                                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold border ${cfg.color}`}>
                                                <div className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                                                {cfg.label}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="font-bold text-slate-900">₹{p.amount}</span>
                                            {p.status === "PENDING" && (
                                                <div className="flex gap-2">
                                                    <Button size="sm" variant="outline" className="h-8 rounded-lg border-amber-300 text-amber-700 hover:bg-amber-100 font-bold border-dashed text-xs"
                                                        onClick={() => handlePayNow(p, true)} disabled={paying === p.id}>
                                                        Test
                                                    </Button>
                                                    <Button size="sm" className="h-8 rounded-lg bg-[#004d40] hover:bg-[#003d33] text-xs"
                                                        onClick={() => handlePayNow(p, false)} disabled={paying === p.id}>
                                                        {paying === p.id ? "Processing..." : "Pay"}
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                        {p.transactionId && <p className="text-xs text-slate-400 font-mono">TXN: {p.transactionId}</p>}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
