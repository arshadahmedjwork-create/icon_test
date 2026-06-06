export type Program = "MIDAS" | "ICON";

export type UserRole = "admin" | "core_team" | "staff" | "student" | "judge" | "volunteer";

export interface User {
    id: string;
    name: string;
    email: string;
    phone?: string;
    password?: string; // For mock auth
    role: UserRole;
    college?: string; // Optional on base User, mandatory on Student
    isActive: boolean;
    createdAt: string;
    course?: string; // Added for Supabase profile mapping
    year?: string; // Added for Supabase profile mapping
    program?: Program;
    // Student specific fields (lifted to User for ease of access in mock)
    registrationStatus?: string | "pending" | "approved" | "rejected" | "completed";
    paymentStatus?: string | "pending" | "completed" | "PAID";
    midasId?: string;
    iconId?: string; // Added for ICON
    idProofUrl?: string;
    selectedEvents?: {
        subject: string;
        type: string;
        mode: string;
    }[];
}

export type JudgeType = "Academic" | "Non-Academic";
export type JudgeStatus = "Available" | "Unavailable";

export interface Judge {
    id: string;
    name: string;
    specialization: string;
    type: JudgeType;
    affiliation: string;
    contact: string;
    email: string;
    college?: string; // For conflict checking (Academic judges)
    status: JudgeStatus;
    timeSlots?: string[]; // Preferred time slots
    program?: Program;
}

export interface EventConfig {
    subjects: string[];
    presentationTypes: string[];
    modes: string[];
    criterias: EvaluationCriteria[];
    capacities: {
        paperOnline: number;
        paperOffline: number;
        posterOnline: number;
        posterOffline: number;
    };
}

export interface EvaluationCriteria {
    id: string;
    name: string;
    maxScore: number;
    weightage: number; // Percentage
}

export interface Event {
    id: string;
    name: string;
    type: string;
    mode: string;
    capacity: number;
    criterias: EvaluationCriteria[];
    rules: string;
    judgeInstructions: string;
    abstractDeadline: string;
    presentationDeadline: string;
    program?: Program;
}

export interface Deadline {
    id: string;
    name: string;
    date: string; // ISO deadline
    description?: string;
    program?: Program;
}

export interface Student extends User {
    rollNo?: string;
    year?: string;
    course?: string;
    college: string; // Mandatory for students
    participantName?: string; // DB field for event_students
    mobile?: string; // DB field for event_students
    registrationStatus: string | "pending" | "approved" | "rejected" | "completed";
    paymentStatus: string | "pending" | "completed" | "PAID";
    approvalStatus?: string | "PENDING" | "APPROVED" | "REJECTED";
    midasId?: string;
    iconId?: string; // Added for ICON
    idProofUrl?: string;
    mustChangePassword?: boolean;
    selectedEvents?: {
        subject: string;
        type: string;
        mode: string;
    }[]; // Events selected by student after payment
    program?: Program;
    
    // ICON Specific Fields
    dciNumber?: string;
    state?: string;
    speciality?: string;
    yearsOfPractice?: number;
    teachingExperience?: string;
    academicPosition?: string;
    qualification?: string;
    delegateType?: 'PG' | 'Clinician' | 'Guest' | 'Faculty';
    bonafideUrl?: string;
    dciCertificateUrl?: string;
}

export interface Registration {
    id: string;
    studentId: string;
    college: string; // Add college for filtering
    submissionDate: string;
    status: "pending" | "approved" | "rejected";
    approvalDate?: string;
    rejectionReason?: string;
    program?: Program;
}

export interface Abstract {
    id: string;
    studentId: string;
    title: string;
    subject: string;
    college: string; // Inherited from Student for faster lookups
    type: string;
    mode: string;
    status: "pending" | "approved" | "rejected" | "revision_requested";
    fileUrl: string;
    presentationUrl?: string; // Final PPT/PDF uploaded before event day
    feedback?: string;
    mentorName?: string;
    coAuthors?: string[];
    submittedAt: string;
    program?: Program;
    keywords?: string[]; // Added for ICON
    hodName?: string; // Added for ICON (PG)
}

export interface Session {
    id: string;
    name: string;
    subject: string;
    type: string;
    mode: string;
    date: string;
    time: string;
    venue: string; // Zoom link or Hall name
    judges: string[]; // Judge IDs
    abstractIds: string[]; // IDs of abstracts scheduled in this session
    eventId?: string; // ID of the linked event configuration (criterias, rules)
    criterias?: EvaluationCriteria[]; // Optional override for this specific session
    attendanceRecords?: string[]; // Student IDs who attended (for certificate eligibility)
    winners?: {
        rank: number;
        studentId: string;
        score: number;
    }[];
    status: "scheduled" | "in_progress" | "evaluation_pending" | "completed";
    currentPresenterId?: string;
    program?: Program;
}

export interface Evaluation {
    id: string;
    sessionId: string;
    judgeId: string;
    studentId: string;
    scores: Record<string, number>; // criteriaId -> score
    totalScore: number;
    feedback?: string;
    submittedAt: string;
    program?: Program;
    isAbsent?: boolean;
}

export interface Certificate {
    id: string;
    userId: string;
    sessionId?: string; // Session where they won (for winners)
    type: "participation" | "winner" | "judge";
    rank?: number; // 1, 2, 3 for winners
    generatedAt: string;
    emailSent: boolean;
    downloadUrl: string;
    program?: Program;
}
