import DashboardLayout from "@/components/layout/DashboardLayout";
import { Calendar, Users, Monitor, Database, Trophy, FileText } from "lucide-react";
import { Routes, Route, Navigate } from "react-router-dom";
import CoreTeamOverview from "../core-team/Overview";
import SessionManagement from "../core-team/SessionManagement";
import CoreTeamSessionView from "../core-team/CoreTeamSessionView";
import JudgeDatabase from "../core-team/JudgeDatabase";
import AdminRegistrations from "../admin/Registrations";
import AbstractApproval from "../core-team/AbstractApproval";

const navItems = [
  { label: "Overview", href: "/dashboard/core-team", icon: <Monitor className="w-4 h-4" /> },
  { label: "Registrations", href: "/dashboard/core-team/registrations", icon: <Users className="w-4 h-4" /> },
  { label: "Abstract Approval", href: "/dashboard/core-team/abstracts", icon: <FileText className="w-4 h-4" /> },
  { label: "Sessions", href: "/dashboard/core-team/sessions", icon: <Calendar className="w-4 h-4" /> },
  { label: "Results", href: "/dashboard/core-team/results", icon: <Trophy className="w-4 h-4" /> },
  { label: "Judge Database", href: "/dashboard/core-team/judge-db", icon: <Database className="w-4 h-4" /> },
];

export default function CoreTeamDashboard() {
  return (
    <DashboardLayout roleName="Core Team" roleColor="bg-accent/20 text-accent-foreground" navItems={navItems}>
      <Routes>
        <Route path="/" element={<CoreTeamOverview />} />
        <Route path="/registrations" element={<AdminRegistrations />} />
        <Route path="/abstracts" element={<AbstractApproval />} />
        <Route path="/sessions" element={<SessionManagement />} />
        <Route path="/results" element={<CoreTeamSessionView />} />
        <Route path="/judge-db" element={<JudgeDatabase />} />
        <Route path="*" element={<Navigate to="/dashboard/core-team" replace />} />
      </Routes>
    </DashboardLayout>
  );
}
