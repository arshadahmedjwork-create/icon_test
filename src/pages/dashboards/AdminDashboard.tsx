import DashboardLayout from "@/components/layout/DashboardLayout";
import { BarChart3, Users, Settings, FileText, Award, Database, Bell } from "lucide-react";
import { Routes, Route, Navigate } from "react-router-dom";
import AdminOverview from "../admin/Overview";
import AdminJudges from "../admin/Judges";
import AdminEventMaster from "../admin/EventMaster";
import AdminUsers from "../admin/Users";
import AdminRegistrations from "../admin/Registrations";
import Reports from "../admin/Reports";
import AuditLog from "../admin/AuditLog";
import AdminResults from "../admin/AdminResults";

const navItems = [
  { label: "Overview", href: "/dashboard/admin", icon: <BarChart3 className="w-4 h-4" /> },
  { label: "Registrations", href: "/dashboard/admin/registrations", icon: <Users className="w-4 h-4" /> },
  { label: "User Management", href: "/dashboard/admin/users", icon: <Settings className="w-4 h-4" /> },
  { label: "Judge Master", href: "/dashboard/admin/judges", icon: <Database className="w-4 h-4" /> },
  { label: "Event Config", href: "/dashboard/admin/events", icon: <Settings className="w-4 h-4" /> },
  { label: "Reports", href: "/dashboard/admin/reports", icon: <FileText className="w-4 h-4" /> },
  { label: "Results", href: "/dashboard/admin/results", icon: <Award className="w-4 h-4" /> },
  { label: "Audit Log", href: "/dashboard/admin/audit", icon: <Bell className="w-4 h-4" /> },
];

export default function AdminDashboard() {
  return (
    <DashboardLayout roleName="Admin" roleColor="bg-primary/15 text-primary" navItems={navItems}>
      <Routes>
        <Route path="/" element={<AdminOverview />} />
        <Route path="/registrations" element={<AdminRegistrations />} />
        <Route path="/users" element={<AdminUsers />} />
        <Route path="/judges" element={<AdminJudges />} />
        <Route path="/events" element={<AdminEventMaster />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/results" element={<AdminResults />} />
        <Route path="/audit" element={<AuditLog />} />
        <Route path="*" element={<Navigate to="/dashboard/admin" replace />} />
      </Routes>
    </DashboardLayout>
  );
}
