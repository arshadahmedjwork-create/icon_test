import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import MemberLoginPage from "./pages/MemberLoginPage";
import StudentRegistrationPage from "./pages/StudentRegistrationPage";
import AdminDashboard from "./pages/dashboards/AdminDashboard";
import CoreTeamDashboard from "./pages/dashboards/CoreTeamDashboard";
import StaffDashboard from "./pages/dashboards/StaffDashboard";
import StudentDashboard from "./pages/dashboards/StudentDashboard";
import StudentEventDashboard from "./pages/dashboards/StudentEventDashboard";
import JudgeDashboard from "./pages/dashboards/JudgeDashboard";
import VolunteerDashboard from "./pages/dashboards/VolunteerDashboard";
import NotFound from "./pages/NotFound";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import ChangePasswordModal from "./components/ChangePasswordModal";

const AuthModalWrapper = () => {
  const { user } = useAuth();
  if (user?.mustChangePassword) {
    return <ChangePasswordModal />;
  }
  return null;
};

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AuthModalWrapper />
          <Routes>
            <Route path="/" element={<Navigate to="/member-login" replace />} />
            <Route path="/login" element={<Navigate to="/member-login" replace />} />
            <Route path="/member-login" element={<MemberLoginPage />} />
            <Route path="/student-registration" element={<StudentRegistrationPage />} />
            <Route path="/dashboard/admin/*" element={<AdminDashboard />} />
            <Route path="/dashboard/core-team/*" element={<CoreTeamDashboard />} />
            <Route path="/dashboard/staff/*" element={<StaffDashboard />} />
            <Route path="/dashboard/student/*" element={<StudentDashboard />} />
            <Route path="/dashboard/student-event/*" element={<StudentEventDashboard />} />
            <Route path="/dashboard/judge/*" element={<JudgeDashboard />} />
            <Route path="/dashboard/volunteer/*" element={<VolunteerDashboard />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
