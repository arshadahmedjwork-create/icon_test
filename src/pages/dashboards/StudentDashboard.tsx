
import { useState } from "react";
import { Link, useLocation, useNavigate, Routes, Route, Navigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Stethoscope, LogOut, Menu, X, LayoutDashboard,
  Calendar, FileText, CreditCard, Award, ChevronLeft
} from "lucide-react";

// Sub-pages
import StudentOverviewPage from "./student-modules/StudentOverviewPage";
import StudentEventsPage from "./student-modules/StudentEventsPage";
import StudentSubmissionsPage from "./student-modules/StudentSubmissionsPage";
import StudentPaymentsPage from "./student-modules/StudentPaymentsPage";
import StudentCertificatesPage from "./student-modules/StudentCertificatesPage";

const navItems = [
  { label: "Overview", href: "/dashboard/student", icon: <LayoutDashboard className="w-4 h-4" /> },
  { label: "My Events", href: "/dashboard/student/events", icon: <Calendar className="w-4 h-4" /> },
  { label: "Submissions", href: "/dashboard/student/submissions", icon: <FileText className="w-4 h-4" /> },
  { label: "Payments", href: "/dashboard/student/payments", icon: <CreditCard className="w-4 h-4" /> },
  { label: "Certificates", href: "/dashboard/student/certificates", icon: <Award className="w-4 h-4" /> },
];

export default function StudentDashboard() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (!user) return <Navigate to="/member-login" />;

  const handleSignOut = () => {
    logout();
    navigate("/");
  };

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* ─── DARK SIDEBAR ─── */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 bg-[#0f172a] text-white flex flex-col transition-transform duration-300 lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Brand */}
        <div className="flex items-center gap-3 h-16 px-5 border-b border-white/10 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#004d40] to-[#2e7d32] flex items-center justify-center">
            <Stethoscope className="w-4 h-4 text-white" />
          </div>
          <span className="text-lg font-bold tracking-tight">MIDAS</span>
        </div>

        {/* Role badge */}
        <div className="px-5 py-3">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#004d40]/30 border border-[#004d40]/40 text-xs font-semibold text-emerald-300 uppercase tracking-wider">
            <LayoutDashboard className="w-3 h-3" />
            Student Dashboard
          </div>
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-3 space-y-1 overflow-y-auto mt-2">
          {navItems.map((item) => {
            const isActive = location.pathname === item.href ||
              (item.href !== "/dashboard/student" && location.pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                to={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-[#004d40] text-white shadow-lg shadow-[#004d40]/25"
                    : "text-white/60 hover:bg-white/5 hover:text-white"
                )}
              >
                {item.icon}
                {item.label}
                {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-400" />}
              </Link>
            );
          })}
        </nav>

        {/* User + Sign Out */}
        <div className="p-4 border-t border-white/10 space-y-3">
          <div className="flex items-center gap-3 px-2">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#004d40] to-[#2e7d32] flex items-center justify-center text-xs font-bold">
              {user.name?.charAt(0)?.toUpperCase() || "S"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{user.name || "Student"}</p>
              <p className="text-xs text-white/40 truncate">{user.email}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-red-400/80 hover:text-red-300 hover:bg-red-500/10"
            onClick={handleSignOut}
          >
            <LogOut className="w-4 h-4 mr-2" /> Sign Out
          </Button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ─── MAIN CONTENT ─── */}
      <div className="flex-1 lg:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-20 h-14 flex items-center gap-3 px-4 border-b border-slate-200 bg-white/80 backdrop-blur-md">
          <button className="lg:hidden text-slate-600" onClick={() => setSidebarOpen(true)}>
            <Menu className="w-5 h-5" />
          </button>
          <Button variant="ghost" size="sm" className="hidden lg:inline-flex text-slate-500" onClick={() => navigate("/")}>
            <ChevronLeft className="w-4 h-4 mr-1" /> Home
          </Button>
          <div className="flex-1" />
          <span className="text-xs text-slate-400 font-medium">MIDAS Student Portal</span>
        </header>

        {/* Page content */}
        <main className="p-4 md:p-6 lg:p-8">
          <Routes>
            <Route path="/" element={<StudentOverviewPage />} />
            <Route path="/events" element={<StudentEventsPage />} />
            <Route path="/submissions" element={<StudentSubmissionsPage />} />
            <Route path="/payments" element={<StudentPaymentsPage />} />
            <Route path="/certificates" element={<StudentCertificatesPage />} />
            <Route path="*" element={<Navigate to="/dashboard/student" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
