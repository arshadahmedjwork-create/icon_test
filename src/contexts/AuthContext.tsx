
import { createContext, useContext, useState, ReactNode, useEffect, useCallback } from "react";
import { getMemberByEmail, comparePassword } from "@/services/supabaseService";
import { supabase } from "@/lib/supabaseClient";

// Role mapping
type BackendRole = 'ADMIN' | 'CORE_SCIENTIFIC_TEAM' | 'STAFF_COORDINATOR' | 'JUDGE' | 'VOLUNTEER';
type FrontendRole = 'admin' | 'core_team' | 'staff' | 'student' | 'judge' | 'volunteer';

const roleMap: Record<BackendRole, FrontendRole> = {
    ADMIN: 'admin',
    CORE_SCIENTIFIC_TEAM: 'core_team',
    STAFF_COORDINATOR: 'staff',
    JUDGE: 'judge',
    VOLUNTEER: 'volunteer',
};

const reverseRoleMap: Record<FrontendRole, BackendRole | 'STUDENT'> = {
    admin: 'ADMIN',
    core_team: 'CORE_SCIENTIFIC_TEAM',
    staff: 'STAFF_COORDINATOR',
    judge: 'JUDGE',
    volunteer: 'VOLUNTEER',
    student: 'STUDENT',
};

export interface AuthUser {
    id: string;
    email: string;
    name?: string;
    role: FrontendRole;
    college?: string;
    midasId?: string;
    // Student-specific
    participantName?: string;
    mobile?: string;
    phone?: string;
    course?: string;
    year?: string;
    profileStatus?: string;
    paymentStatus?: string;
    approvalStatus?: string;
    // Password change flag
    mustChangePassword?: boolean;
}

interface AuthContextType {
    user: AuthUser | null;
    token: string | null;
    isLoading: boolean;
    login: (email: string, password: string, role: FrontendRole) => Promise<string>;
    studentLogin: (email: string, mobile: string) => Promise<void>;
    studentRegister: (data: { participantName: string; email: string; mobile: string; college: string; year: string }) => Promise<void>;
    memberRegister: (email: string, password: string, role: FrontendRole) => Promise<void>;
    logout: () => void;
    refreshUser: () => Promise<void>;
    clearMustChangePassword: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Restore session on mount
    useEffect(() => {
        const storedToken = localStorage.getItem("midas_token");
        const storedUser = localStorage.getItem("midas_user");
        if (storedToken && storedUser) {
            setToken(storedToken);
            setUser(JSON.parse(storedUser));
        }
        setIsLoading(false);
    }, []);

    const persistSession = (token: string, user: AuthUser) => {
        setToken(token);
        setUser(user);
        localStorage.setItem("midas_token", token);
        localStorage.setItem("midas_user", JSON.stringify(user));
    };

    // Member login — queries 'members' table directly + bcryptjs comparison
    const login = async (email: string, password: string, role: FrontendRole) => {
        const member = await getMemberByEmail(email);
        if (!member) {
            throw new Error("Invalid email or password");
        }

        const isValid = await comparePassword(password, member.password);
        if (!isValid) {
            throw new Error("Invalid email or password");
        }

        // Determine the actual frontend role based on the database
        const actualFrontendRole = roleMap[member.role as BackendRole] || role;

        // Create a simple session token (timestamp-based for frontend-only)
        const sessionToken = btoa(JSON.stringify({ id: member.id, role: member.role, ts: Date.now() }));

        const authUser: AuthUser = {
            id: member.id,
            email: member.email,
            name: member.name,
            role: actualFrontendRole,
            college: member.staffCoordinatorCollege,
            mustChangePassword: member.mustChangePassword ?? false,
        };
        persistSession(sessionToken, authUser);

        // Return the actual role so the UI knows where to navigate
        return actualFrontendRole;
    };

    // Student login — queries 'event_students' table
    const studentLogin = async (email: string, password: string) => {
        const { data: student, error } = await supabase
            .from('event_students')
            .select('*')
            .eq('email', email)
            .limit(1)
            .maybeSingle();

        if (error || !student || !student.password) {
            throw new Error("Invalid email or password");
        }

        const isValid = await comparePassword(password, student.password);
        if (!isValid) {
            throw new Error("Invalid email or password");
        }

        const sessionToken = btoa(JSON.stringify({ id: student.id, role: 'STUDENT', ts: Date.now() }));

        const authUser: AuthUser = {
            id: student.id,
            name: student.participantName, // using standard name prop
            email: student.email,
            role: 'student',
            participantName: student.participantName,
            mobile: student.mobile,
            phone: student.mobile, // mapping mobile to phone for compatibility
            college: student.college,
            course: student.course,
            year: student.year,
            midasId: student.midasId,
            profileStatus: student.profileStatus,
            paymentStatus: student.paymentStatus,
            approvalStatus: student.approvalStatus,
        };
        persistSession(sessionToken, authUser);
    };

    // Student registration
    const studentRegister = async (data: { participantName: string; email: string; mobile: string; college: string; year: string }) => {
        const { data: student, error } = await supabase
            .from('event_students')
            .insert({
                participantName: data.participantName,
                email: data.email,
                mobile: data.mobile,
                college: data.college,
                year: data.year,
            })
            .select()
            .single();

        if (error) throw new Error(error.message);

        // Auto-login after registration
        const sessionToken = btoa(JSON.stringify({ id: student.id, role: 'STUDENT', ts: Date.now() }));

        const authUser: AuthUser = {
            id: student.id,
            email: student.email,
            role: 'student',
            participantName: student.participantName,
            mobile: student.mobile,
        };
        persistSession(sessionToken, authUser);
    };

    // Member registration (self-signup)
    const memberRegister = async (email: string, password: string, role: FrontendRole) => {
        const bcrypt = (await import('bcryptjs')).default;
        const hashedPassword = await bcrypt.hash(password, 10);
        const backendRole = reverseRoleMap[role];

        const { data: member, error } = await supabase
            .from('members')
            .insert({
                email,
                password: hashedPassword,
                role: backendRole,
                isActive: true,
                mustChangePassword: false,
            })
            .select()
            .single();

        if (error) throw new Error(error.message);

        const sessionToken = btoa(JSON.stringify({ id: member.id, role: member.role, ts: Date.now() }));

        const authUser: AuthUser = {
            id: member.id,
            email: member.email,
            role: roleMap[member.role as BackendRole] || role,
        };
        persistSession(sessionToken, authUser);
    };

    // Refresh user data
    const refreshUser = useCallback(async () => {
        if (!token) return;
        try {
            const stored = localStorage.getItem("midas_user");
            if (!stored) return;
            const currentUser = JSON.parse(stored);

            if (currentUser.role === 'student') {
                const { data: student } = await supabase
                    .from('event_students')
                    .select('*')
                    .eq('id', currentUser.id)
                    .single();
                if (student) {
                    const updated: AuthUser = {
                        ...currentUser,
                        name: student.participantName,
                        participantName: student.participantName,
                        mobile: student.mobile,
                        phone: student.mobile,
                        college: student.college,
                        course: student.course,
                        year: student.year,
                        midasId: student.midasId,
                        profileStatus: student.profileStatus,
                        paymentStatus: student.paymentStatus,
                        approvalStatus: student.approvalStatus,
                    };
                    setUser(updated);
                    localStorage.setItem("midas_user", JSON.stringify(updated));
                }
            } else {
                const member = await getMemberByEmail(currentUser.email);
                if (member) {
                    const actualFrontendRole = roleMap[member.role as BackendRole] || currentUser.role;
                    const updated: AuthUser = {
                        ...currentUser,
                        name: member.name,
                        role: actualFrontendRole,
                        college: member.staffCoordinatorCollege,
                        mustChangePassword: member.mustChangePassword ?? false,
                    };
                    persistSession(token, updated);
                }
            }
        } catch {
            // If refresh fails, keep existing data
        }
    }, [token]);

    const clearMustChangePassword = () => {
        if (user) {
            const updated = { ...user, mustChangePassword: false };
            setUser(updated);
            localStorage.setItem("midas_user", JSON.stringify(updated));
        }
    };

    const logout = () => {
        setUser(null);
        setToken(null);
        localStorage.removeItem("midas_token");
        localStorage.removeItem("midas_user");
    };

    return (
        <AuthContext.Provider value={{
            user, token, isLoading,
            login, studentLogin, studentRegister, memberRegister,
            logout, refreshUser, clearMustChangePassword
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}
