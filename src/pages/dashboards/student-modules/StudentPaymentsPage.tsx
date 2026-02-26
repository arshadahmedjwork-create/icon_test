
import { useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
    CreditCard, CheckCircle2, Clock, AlertTriangle,
    Wallet, Receipt, Loader2
} from "lucide-react";

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

const mockPayments: PaymentItem[] = [
    { id: "pay-1", eventName: "Paper Presentation — Prosthodontics", eventType: "PAPER", amount: 500, status: "PAID", transactionId: "TXN_29384756", paymentDate: "2026-02-15T12:00:00Z" },
    { id: "pay-2", eventName: "Workshop — Digital Dentistry", eventType: "WORKSHOP", amount: 1000, status: "PENDING", transactionId: null, paymentDate: null },
    { id: "pay-3", eventName: "Poster Presentation — Endodontics", eventType: "POSTER", amount: 300, status: "PAID", transactionId: "TXN_19283746", paymentDate: "2026-02-12T09:30:00Z" },
];

export default function StudentPaymentsPage() {
    const [payments, setPayments] = useState(mockPayments);
    const [paying, setPaying] = useState<string | null>(null);

    const totalPaid = payments.filter(p => p.status === "PAID").reduce((s, p) => s + p.amount, 0);
    const totalPending = payments.filter(p => p.status === "PENDING").reduce((s, p) => s + p.amount, 0);

    const handlePayNow = (payment: PaymentItem) => {
        const razorpayKey = import.meta.env.VITE_RAZORPAY_LIVE_KEY;
        if (!razorpayKey) {
            toast.error("Payment configuration error. Please contact admin.");
            return;
        }

        const options = {
            key: razorpayKey,
            amount: payment.amount * 100, // Convert to paise
            currency: "INR",
            name: "MIDAS Scientific Event",
            description: payment.eventName,
            handler: function (response: any) {
                setPayments(prev => prev.map(p => p.id === payment.id ? {
                    ...p, status: "PAID" as const, transactionId: response.razorpay_payment_id, paymentDate: new Date().toISOString()
                } : p));
                setPaying(null);
                toast.success(`Payment of ₹${payment.amount} successful!`);
            },
            theme: { color: "#004d40" },
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
            <div>
                <h1 className="text-2xl font-bold text-slate-900">Payments</h1>
                <p className="text-sm text-slate-500 mt-1">Track all your event registration payments.</p>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
                            <Receipt className="w-5 h-5 text-slate-500" />
                        </div>
                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Transactions</span>
                    </div>
                    <p className="text-3xl font-black text-slate-900">{payments.length}</p>
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
                            {payments.map((p) => {
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
                                                <Button
                                                    size="sm"
                                                    className="h-8 rounded-lg bg-[#004d40] hover:bg-[#003d33] text-xs font-bold"
                                                    onClick={() => handlePayNow(p)}
                                                    disabled={paying === p.id}
                                                >
                                                    {paying === p.id ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <CreditCard className="w-3 h-3 mr-1" />}
                                                    {paying === p.id ? "Processing..." : "Pay Now"}
                                                </Button>
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
                    {payments.map((p) => {
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
                                        <Button size="sm" className="h-8 rounded-lg bg-[#004d40] hover:bg-[#003d33] text-xs"
                                            onClick={() => handlePayNow(p)} disabled={paying === p.id}>
                                            {paying === p.id ? "Processing..." : "Pay Now"}
                                        </Button>
                                    )}
                                </div>
                                {p.transactionId && <p className="text-xs text-slate-400 font-mono">TXN: {p.transactionId}</p>}
                            </div>
                        );
                    })}
                </div>
            </div>

            {payments.length === 0 && (
                <div className="text-center py-16 text-slate-400">
                    <CreditCard className="w-12 h-12 mx-auto mb-3 text-slate-200" />
                    <p className="font-medium">No payments yet</p>
                    <p className="text-sm mt-1">Payments will appear here after you enroll in events.</p>
                </div>
            )}
        </div>
    );
}
