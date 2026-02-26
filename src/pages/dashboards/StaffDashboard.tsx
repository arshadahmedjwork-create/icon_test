import DashboardLayout from "@/components/layout/DashboardLayout";
import { ClipboardCheck, FileText, Users, LayoutDashboard } from "lucide-react";
import { Routes, Route, Navigate } from "react-router-dom";
import StaffOverview from "../staff/Overview";
import RegistrationApprovals from "../staff/RegistrationApprovals";
import AbstractScrutiny from "../staff/AbstractScrutiny";

const navItems = [
  { label: "Overview", href: "/dashboard/staff", icon: <LayoutDashboard className="w-4 h-4" /> },
  { label: "Registrations", href: "/dashboard/staff/registrations", icon: <Users className="w-4 h-4" /> },
  { label: "Abstracts", href: "/dashboard/staff/abstracts", icon: <FileText className="w-4 h-4" /> },
];

export default function StaffDashboard() {
  return (
    <DashboardLayout roleName="Staff Coordinator" roleColor="bg-primary/15 text-primary" navItems={navItems}>
      <Routes>
        <Route path="/" element={<StaffOverview />} />
        <Route path="/registrations" element={<RegistrationApprovals />} />
        <Route path="/abstracts" element={<AbstractScrutiny />} />
        <Route path="*" element={<Navigate to="/dashboard/staff" replace />} />
      </Routes>
    </DashboardLayout>
  );
}
