import DashboardLayout from "@/components/layout/DashboardLayout";
import { ClipboardList, Calendar, CheckSquare } from "lucide-react";
import { Routes, Route, Navigate } from "react-router-dom";
import EvaluationList from "../judge/EvaluationList";
import SessionEvaluation from "../judge/SessionEvaluation";
import ScoreboardPage from "../judge/ScoreboardPage";

const navItems = [
  { label: "My Sessions", href: "/dashboard/judge", icon: <Calendar className="w-4 h-4" /> },
];

export default function JudgeDashboard() {
  return (
    <DashboardLayout roleName="Judge" roleColor="bg-primary/15 text-primary" navItems={navItems}>
      <Routes>
        <Route path="/" element={<EvaluationList />} />
        <Route path="/session/:sessionId" element={<SessionEvaluation />} />
        <Route path="/session/:sessionId/scoreboard" element={<ScoreboardPage />} />
        <Route path="*" element={<Navigate to="/dashboard/judge" replace />} />
      </Routes>
    </DashboardLayout>
  );
}
