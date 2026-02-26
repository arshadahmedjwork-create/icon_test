import DashboardLayout from "@/components/layout/DashboardLayout";
import { QrCode, Monitor, Users } from "lucide-react";
import { Routes, Route, Navigate } from "react-router-dom";
import AttendanceSheet from "../volunteer/AttendanceSheet";

const navItems = [
  { label: "Attendance", href: "/dashboard/volunteer/attendance", icon: <QrCode className="w-4 h-4" /> },
];

export default function VolunteerDashboard() {
  return (
    <DashboardLayout roleName="Volunteer" roleColor="bg-accent/20 text-accent-foreground" navItems={navItems}>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard/volunteer/attendance" replace />} />
        <Route path="/attendance" element={<AttendanceSheet />} />
        <Route path="*" element={<Navigate to="/dashboard/volunteer" replace />} />
      </Routes>
    </DashboardLayout>
  );
}
