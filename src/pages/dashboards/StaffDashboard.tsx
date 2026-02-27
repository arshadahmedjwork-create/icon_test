import DashboardLayout from "@/components/layout/DashboardLayout";
import { ClipboardCheck, FileText, LayoutDashboard, UserSquare2, CheckCircle } from "lucide-react";
import { Routes, Route, Navigate } from "react-router-dom";
import StaffOverview from "../staff/Overview";
import RegistrationApprovals from "../staff/RegistrationApprovals";
import AbstractScrutiny from "../staff/AbstractScrutiny";
import ApprovedAbstracts from "../staff/ApprovedAbstracts";
import AllStudents from "../staff/AllStudents";

const navItems = [
  { label: "Overview", href: "/dashboard/staff", icon: <LayoutDashboard className="w-4 h-4" /> },
  { label: "Registrations", href: "/dashboard/staff/registrations", icon: <ClipboardCheck className="w-4 h-4" /> },
  { label: "Abstracts", href: "/dashboard/staff/abstracts", icon: <FileText className="w-4 h-4" /> },
  { label: "Approved Abstracts", href: "/dashboard/staff/approved-abstracts", icon: <CheckCircle className="w-4 h-4" /> },
  { label: "All Students", href: "/dashboard/staff/students", icon: <UserSquare2 className="w-4 h-4" /> },
];

export default function StaffDashboard() {
  return (
    <DashboardLayout roleName="Staff Coordinator" roleColor="bg-primary/15 text-primary" navItems={navItems}>
      <Routes>
        <Route path="/" element={<StaffOverview />} />
        <Route path="/registrations" element={<RegistrationApprovals />} />
        <Route path="/abstracts" element={<AbstractScrutiny />} />
        <Route path="/approved-abstracts" element={<ApprovedAbstracts />} />
        <Route path="/students" element={<AllStudents />} />
        <Route path="*" element={<Navigate to="/dashboard/staff" replace />} />
      </Routes>
    </DashboardLayout>
  );
}
