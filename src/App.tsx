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
import CertificateVerification from "./pages/CertificateVerification";
import NotFound from "./pages/NotFound";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ProgramProvider } from "@/contexts/ProgramContext";
import ChangePasswordModal from "./components/ChangePasswordModal";
import CompleteProfileModal from "./components/CompleteProfileModal";
import ProtectedRoute from "./components/ProtectedRoute";

const AuthModalWrapper = () => {
  const { user, completeProfileDismissed } = useAuth();
  if (user?.mustChangePassword) {
    return <ChangePasswordModal />;
  }
  
  if (user && user.role === 'student' && !completeProfileDismissed) {
    const isClinician = user.delegateType === 'Clinician';
    const isMissingCollege = !user.college || user.college.trim() === "" || (!isClinician && user.college.trim() === "N/A");
    const isMissingYear = !user.year || user.year.trim() === "" || (!isClinician && user.year.trim() === "N/A");
    if (isMissingCollege || isMissingYear) {
      return <CompleteProfileModal />;
    }
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
          <ProgramProvider>
            <AuthModalWrapper />
            <Routes>
              <Route path="/" element={<Navigate to="/member-login" replace />} />
              <Route path="/login" element={<Navigate to="/member-login" replace />} />
              <Route path="/member-login" element={<MemberLoginPage />} />
              <Route path="/student-registration" element={<StudentRegistrationPage />} />
              <Route path="/certificate/verify/:certificateId" element={<CertificateVerification />} />
              <Route path="/dashboard/admin/*" element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <AdminDashboard />
                </ProtectedRoute>
              } />
              <Route path="/dashboard/core-team/*" element={
                <ProtectedRoute allowedRoles={["core_team"]}>
                  <CoreTeamDashboard />
                </ProtectedRoute>
              } />
              <Route path="/dashboard/staff/*" element={
                <ProtectedRoute allowedRoles={["staff"]}>
                  <StaffDashboard />
                </ProtectedRoute>
              } />
              <Route path="/dashboard/student/*" element={
                <ProtectedRoute allowedRoles={["student"]}>
                  <StudentDashboard />
                </ProtectedRoute>
              } />
              <Route path="/dashboard/student-event/*" element={
                <ProtectedRoute allowedRoles={["student"]}>
                  <StudentEventDashboard />
                </ProtectedRoute>
              } />
              <Route path="/dashboard/judge/*" element={
                <ProtectedRoute allowedRoles={["judge"]}>
                  <JudgeDashboard />
                </ProtectedRoute>
              } />
              <Route path="/dashboard/volunteer/*" element={
                <ProtectedRoute allowedRoles={["volunteer"]}>
                  <VolunteerDashboard />
                </ProtectedRoute>
              } />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </ProgramProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
