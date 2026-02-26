
import { Navigate, useLocation } from "react-router-dom";
import { useAuth, AuthUser } from "@/contexts/AuthContext";

type AllowedRole = AuthUser['role'];

interface ProtectedRouteProps {
    children: React.ReactNode;
    allowedRoles?: AllowedRole[];
}

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
    const { user, isLoading } = useAuth();
    const location = useLocation();

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    if (allowedRoles && !allowedRoles.includes(user.role)) {
        // Redirect to the user's own dashboard
        const dashboardPaths: Record<AllowedRole, string> = {
            admin: '/dashboard/admin',
            core_team: '/dashboard/core-team',
            staff: '/dashboard/staff',
            student: '/dashboard/student',
            judge: '/dashboard/judge',
            volunteer: '/dashboard/volunteer',
        };
        return <Navigate to={dashboardPaths[user.role] || '/login'} replace />;
    }

    return <>{children}</>;
}
