import { supabase } from '../lib/supabaseClient';
// import { Database } from '../types/supabase'; // We might need to generate types, but for now we'll use 'any' or manual types
import { User, Judge, EventConfig, Deadline, Registration, Abstract, Session, Evaluation, Certificate, EvaluationCriteria } from '../types';
import bcrypt from 'bcryptjs';
import { sendAccountCreationEmail } from './emailService';

// Helper to handle Supabase responses
const handleResponse = async <T>(promise: Promise<{ data: T | null; error: any }>): Promise<T> => {
    const { data, error } = await promise;
    if (error) {
        console.error('Supabase Error:', error);
        throw error;
    }
    if (!data) {
        throw new Error('No data returned');
    }
    return data;
};

// --- USERS (members table) ---
export const getUsers = async (): Promise<User[]> => {
    const { data, error } = await supabase
        .from('members')
        .select('*');
    if (error) throw error;
    return (data || []).map(mapMemberToUser);
};

export const getUserById = async (id: string): Promise<User | null> => {
    const { data, error } = await supabase
        .from('members')
        .select('*')
        .eq('id', id)
        .single();
    if (error) return null;
    return mapMemberToUser(data);
};

// Mapper function — members table uses camelCase columns (created by Prisma)
const mapMemberToUser = (member: any): User => ({
    id: member.id,
    name: member.name || member.email || '',
    email: member.email || '',
    role: (member.role || 'admin').toLowerCase().replace('_', ' '),
    college: member.staffCoordinatorCollege || '',
    isActive: member.isActive ?? true,
    createdAt: member.createdAt,
});

export const addUser = async (user: User) => {
    const { error } = await supabase.from('members').insert({
        id: user.id,
        name: user.name,
        email: user.email,
        password: '$2b$10$placeholder', // placeholder
        role: user.role?.toUpperCase() || 'VOLUNTEER',
        isActive: user.isActive ?? true,
        staffCoordinatorCollege: user.college || null,
    });
    if (error) throw error;
};

export const updateUser = async (id: string, updates: Partial<User>) => {
    const dbUpdates: any = {};
    if (updates.name) dbUpdates.name = updates.name;
    if (updates.email) dbUpdates.email = updates.email;
    if (updates.role) dbUpdates.role = updates.role;
    if (updates.college) dbUpdates.staffCoordinatorCollege = updates.college;
    if (updates.isActive !== undefined) dbUpdates.isActive = updates.isActive;

    const { error } = await supabase.from('members').update(dbUpdates).eq('id', id);
    if (error) throw error;
};

export const deleteUser = async (id: string) => {
    const { error } = await supabase.from('members').delete().eq('id', id);
    if (error) throw error;
};

// --- AUTH HELPERS (frontend-only, using members table + bcryptjs) ---

export const getMemberByEmail = async (email: string) => {
    const { data, error } = await supabase
        .from('members')
        .select('*')
        .eq('email', email)
        .single();
    if (error) return null;
    return data;
};

export const createMember = async (data: {
    name: string;
    email: string;
    password: string;  // plain text — will be hashed
    role: string;
    staffCoordinatorCollege?: string;
}) => {
    const hashedPassword = await bcrypt.hash(data.password, 10);
    const { data: member, error } = await supabase
        .from('members')
        .insert({
            name: data.name,
            email: data.email,
            password: hashedPassword,
            role: data.role,
            isActive: true,
            mustChangePassword: true,
            staffCoordinatorCollege: data.staffCoordinatorCollege || null,
        })
        .select()
        .single();
    if (error) throw error;
    return member;
};

export const updateMemberPassword = async (id: string, newPassword: string) => {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const { error } = await supabase
        .from('members')
        .update({ password: hashedPassword, mustChangePassword: false })
        .eq('id', id);
    if (error) throw error;
};

export const comparePassword = async (plain: string, hash: string): Promise<boolean> => {
    return bcrypt.compare(plain, hash);
};

export const resetUserPassword = async (email: string): Promise<string> => {
    const member = await getMemberByEmail(email);
    if (!member) {
        throw new Error("No account found with this email address.");
    }

    // Generate a temporary 10-character password
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let tempPassword = '';
    for (let i = 0; i < 10; i++) tempPassword += chars.charAt(Math.floor(Math.random() * chars.length));

    // Hash and update
    const hashedPassword = await bcrypt.hash(tempPassword, 10);
    const { error } = await supabase
        .from('members')
        .update({ password: hashedPassword, mustChangePassword: true })
        .eq('id', member.id);

    if (error) throw error;

    return tempPassword;
};

// --- DASHBOARD STATS ---
export const getDashboardStats = async () => {
    const [studentsRes, sessionsRes, submissionsRes, paymentsRes] = await Promise.all([
        supabase.from('event_students').select('id', { count: 'exact', head: true }),
        supabase.from('sessions').select('id', { count: 'exact', head: true }),
        supabase.from('submissions').select('id', { count: 'exact', head: true }).eq('status', 'SUBMITTED'),
        supabase.from('payments').select('amount', { count: 'exact' }).eq('status', 'PAID'),
    ]);

    const totalStudents = studentsRes.count || 0;
    const totalSessions = sessionsRes.count || 0;
    const pendingAbstracts = submissionsRes.count || 0;
    const totalRevenue = (paymentsRes.data || []).reduce((sum: number, p: any) => sum + (p.amount || 0), 0);

    // Recent registrations
    const { data: recentRegistrations } = await supabase
        .from('event_students')
        .select('id, participantName, email, college, registeredAt, paymentStatus, approvalStatus')
        .order('registeredAt', { ascending: false })
        .limit(10);

    return {
        totalStudents,
        totalSessions,
        pendingAbstracts,
        totalRevenue,
        recentRegistrations: recentRegistrations || [],
    };
};

// --- EVENT STUDENTS (student registrations) ---
export const getEventStudents = async () => {
    const { data, error } = await supabase
        .from('event_students')
        .select('*')
        .order('registeredAt', { ascending: false });
    if (error) throw error;
    return data || [];
};

export const getEventStudentCount = async (): Promise<number> => {
    const { count, error } = await supabase
        .from('event_students')
        .select('id', { count: 'exact', head: true });
    if (error) return 0;
    return count || 0;
};

export const updateEventStudent = async (id: string, updates: Record<string, any>) => {
    const { error } = await supabase
        .from('event_students')
        .update(updates)
        .eq('id', id);
    if (error) throw error;
};
// --- JUDGES ---
export const getJudges = async (): Promise<Judge[]> => {
    // Query judges table and join with members for email
    const { data, error } = await supabase
        .from('judges')
        .select('*, members!memberId(email)');
    if (error) {
        // Fallback: try without join if FK naming differs
        const { data: fallbackData, error: fbError } = await supabase
            .from('judges')
            .select('*');
        if (fbError) throw fbError;
        return (fallbackData || []).map((j: any) => ({
            id: j.id,
            name: j.fullName || j.full_name || '',
            specialization: j.specialization || '',
            type: (j.isAcademic ?? j.is_academic) ? 'Academic' : 'Non-Academic',
            affiliation: j.college || '',
            email: '',
            contact: '',
            status: 'Available',
            timeSlots: j.time_slots || [],
        })) as Judge[];
    }
    return (data || []).map((j: any) => ({
        id: j.id,
        name: j.fullName || j.full_name || '',
        specialization: j.specialization || '',
        type: (j.isAcademic ?? j.is_academic) ? 'Academic' : 'Non-Academic',
        affiliation: j.college || '',
        email: j.members?.email || '',
        contact: '',
        status: 'Available',
        timeSlots: j.time_slots || [],
    })) as Judge[];
};


export const addJudge = async (judge: Omit<Judge, 'id'>) => {
    // Generate a random 8-character password
    const tempPassword = Math.random().toString(36).slice(-8);
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    // Step 1: Create a member record with role JUDGE
    const { data: memberData, error: memberError } = await supabase
        .from('members')
        .insert({
            email: judge.email,
            password: hashedPassword,
            name: judge.name,
            role: 'JUDGE',
            isActive: true,
            updatedAt: new Date().toISOString(),
        })
        .select('id')
        .single();
    if (memberError) throw memberError;

    // Step 2: Create the judge profile linked to the member
    const { error: judgeError } = await supabase
        .from('judges')
        .insert({
            memberId: memberData.id,
            fullName: judge.name,
            isAcademic: judge.type === 'Academic',
            college: judge.affiliation || null,
            specialization: judge.specialization || null,
            time_slots: judge.timeSlots || [],
        });
    if (judgeError) {
        // Rollback: delete the member if judge creation fails
        await supabase.from('members').delete().eq('id', memberData.id);
        throw judgeError;
    }

    // Step 3: Send email with credentials
    try {
        await sendAccountCreationEmail({
            user_name: judge.name,
            user_email: judge.email,
            temp_password: tempPassword,
            login_url: window.location.origin + "/member-login"
        });
    } catch (emailError) {
        console.error("Failed to send judge account creation email:", emailError);
        // We don't throw here because the judge was successfully created, but we could log it or alert the admin.
    }
};

export const updateJudge = async (id: string, updates: Partial<Judge>) => {
    const dbUpdates: any = {};
    if (updates.name !== undefined) dbUpdates.fullName = updates.name;
    if (updates.specialization !== undefined) dbUpdates.specialization = updates.specialization;
    if (updates.type !== undefined) dbUpdates.isAcademic = updates.type === 'Academic';
    if (updates.affiliation !== undefined) dbUpdates.college = updates.affiliation;
    if (updates.timeSlots !== undefined) dbUpdates.time_slots = updates.timeSlots;

    const { error } = await supabase.from('judges').update(dbUpdates).eq('id', id);
    if (error) throw error;
};

export const deleteJudge = async (id: string) => {
    // Get the memberId first so we can delete both records
    const { data: judge, error: fetchError } = await supabase
        .from('judges')
        .select('memberId')
        .eq('id', id)
        .single();

    // Delete judge profile
    const { error } = await supabase.from('judges').delete().eq('id', id);
    if (error) throw error;

    // Delete the associated member record
    if (judge?.memberId) {
        await supabase.from('members').delete().eq('id', judge.memberId);
    }
};

// --- CONFIG ---
export const getEventConfig = async (): Promise<EventConfig | null> => {
    const { data, error } = await supabase.from('event_config').select('*').single();
    if (error) return null;

    // Fetch criteria
    const { data: criteria, error: critError } = await supabase.from('evaluation_criteria').select('*');
    if (critError) throw critError;

    return {
        ...data,
        criterias: criteria
    } as any as EventConfig;
};

export const updateEventConfig = async (config: EventConfig) => {
    // Upsert config
    const { error } = await supabase.from('event_config').upsert({
        id: 1,
        subjects: config.subjects,
        presentation_types: config.presentationTypes,
        modes: config.modes,
        capacities: config.capacities
    });
    if (error) throw error;

    // We also need to update criteria, which is a separate table.
    // This is tricky if criteria IDs change. For now, assume simple updates if IDs match.
    // Or delete all and re-insert? Re-inserting is safer for synchronization but loses history if linked.
    // Let's assume we just update properties for existing IDs.
    // For this mock-to-real port, let's keep it simple: assume criteria are static or managed separately.
};

// --- DEADLINES ---
export const getDeadlines = async (): Promise<Deadline[]> => {
    const { data, error } = await supabase.from('deadlines').select('*');
    if (error) throw error;
    return data;
};

export const updateDeadline = async (id: string, date: string) => {
    const { error } = await supabase.from('deadlines').update({ date }).eq('id', id);
    if (error) throw error;
};

// --- REGISTRATIONS ---
export const getRegistrations = async (): Promise<Registration[]> => {
    const { data, error } = await supabase.from('registrations').select('*');
    if (error) throw error;
    return data.map((r: any) => ({
        id: r.id,
        studentId: r.student_id,
        college: r.college,
        submissionDate: r.submission_date,
        status: r.status,
        approvalDate: r.approval_date,
        rejectionReason: r.rejection_reason
    }));
};

export const updateRegistrationStatus = async (id: string, status: "approved" | "rejected") => {
    const { error } = await supabase.from('registrations').update({ status }).eq('id', id);
    if (error) throw error;
};

// --- ABSTRACTS ---
export const getAbstracts = async (): Promise<Abstract[]> => {
    const { data, error } = await supabase.from('abstracts').select('*');
    if (error) throw error;
    return data.map((a: any) => ({
        ...a,
        studentId: a.student_id,
        submittedAt: a.submitted_at,
        fileUrl: a.file_url,
        presentationUrl: a.presentation_url,
        mentorName: a.mentor_name,
        coAuthors: a.co_authors,
        // map other snake_case to camelCase
    })) as Abstract[];
};

export const addAbstract = async (abstract: Omit<Abstract, 'id' | 'submittedAt' | 'status'>) => {
    // Map camelCase to snake_case for DB
    const dbAbstract = {
        student_id: abstract.studentId,
        title: abstract.title,
        subject: abstract.subject,
        college: abstract.college,
        type: abstract.type,
        mode: abstract.mode,
        file_url: abstract.fileUrl,
        presentation_url: abstract.presentationUrl,
        mentor_name: abstract.mentorName,
        co_authors: abstract.coAuthors,
        feedback: abstract.feedback
    };
    const { error } = await supabase.from('abstracts').insert(dbAbstract);
    if (error) throw error;
};

export const updateAbstractStatus = async (id: string, status: Abstract["status"], feedback?: string) => {
    const { error } = await supabase.from('abstracts').update({ status, feedback }).eq('id', id);
    if (error) throw error;
};

export const updateAbstract = async (id: string, updates: Partial<Abstract>) => {
    const dbUpdates: any = {};
    if (updates.title) dbUpdates.title = updates.title;
    if (updates.subject) dbUpdates.subject = updates.subject;
    if (updates.type) dbUpdates.type = updates.type;
    if (updates.mode) dbUpdates.mode = updates.mode;
    if (updates.fileUrl) dbUpdates.file_url = updates.fileUrl;
    if (updates.presentationUrl) dbUpdates.presentation_url = updates.presentationUrl;
    if (updates.mentorName) dbUpdates.mentor_name = updates.mentorName;
    if (updates.coAuthors) dbUpdates.co_authors = updates.coAuthors;
    if (updates.status) dbUpdates.status = updates.status;
    if (updates.feedback) dbUpdates.feedback = updates.feedback;

    const { error } = await supabase.from('abstracts').update(dbUpdates).eq('id', id);
    if (error) throw error;
};

// --- SESSIONS ---
export const getSessions = async (): Promise<Session[]> => {
    const { data, error } = await supabase.from('sessions').select('*');
    if (error) throw error;
    return data as any as Session[];
};

export const addSession = async (session: Omit<Session, "id">) => {
    const { error } = await supabase.from('sessions').insert(session);
    if (error) throw error;
};

export const updateSession = async (id: string, updates: Partial<Session>) => {
    const { error } = await supabase.from('sessions').update(updates).eq('id', id);
    if (error) throw error;
};

export const deleteSession = async (id: string) => {
    const { error } = await supabase.from('sessions').delete().eq('id', id);
    if (error) throw error;
};

// --- EVALUATIONS ---
export const getEvaluations = async (): Promise<Evaluation[]> => {
    const { data, error } = await supabase.from('evaluations').select('*');
    if (error) throw error;
    return data.map((e: any) => ({
        id: e.id,
        sessionId: e.session_id,
        judgeId: e.judge_id,
        studentId: e.student_id,
        scores: e.scores,
        totalScore: e.total_score,
        feedback: e.feedback,
        submittedAt: e.submitted_at
    }));
};

export const addEvaluation = async (evaluation: Omit<Evaluation, "id" | "submittedAt">) => {
    const dbEval = {
        session_id: evaluation.sessionId,
        judge_id: evaluation.judgeId,
        student_id: evaluation.studentId,
        scores: evaluation.scores,
        total_score: evaluation.totalScore,
        feedback: evaluation.feedback
    };
    const { error } = await supabase.from('evaluations').insert(dbEval);
    if (error) throw error;
};

// --- CERTIFICATES ---
export const getCertificates = async (): Promise<Certificate[]> => {
    const { data, error } = await supabase.from('certificates').select('*');
    if (error) throw error;
    return data.map((c: any) => ({
        id: c.id,
        userId: c.user_id,
        sessionId: c.session_id,
        type: c.type,
        rank: c.rank,
        generatedAt: c.generated_at,
        emailSent: c.email_sent,
        downloadUrl: c.download_url
    }));
};

export const addCertificate = async (cert: Certificate) => {
    const dbCert = {
        id: cert.id,
        user_id: cert.userId,
        session_id: cert.sessionId,
        type: cert.type,
        rank: cert.rank,
        generated_at: cert.generatedAt,
        email_sent: cert.emailSent,
        download_url: cert.downloadUrl
    };
    const { error } = await supabase.from('certificates').insert(dbCert);
    if (error) throw error;
};

// --- RESULTS CALCULATION ---
// IMPORTANT: This logic mimics the mockDatabase logic but runs client-side fetching data.
// In a production app, this should be a Postgres Function or Edge Function.
export const calculateSessionResults = async (sessionId: string) => {
    // 1. Fetch Session
    const { data: session, error: sErr } = await supabase.from('sessions').select('*').eq('id', sessionId).single();
    if (sErr || !session) return null;

    // 2. Fetch Evaluations
    const { data: evaluations, error: eErr } = await supabase.from('evaluations').select('*').eq('session_id', sessionId);
    if (eErr || !evaluations || evaluations.length === 0) return null;

    // 3. Fetch Config (for weightage)
    const eventConfig = await getEventConfig();
    if (!eventConfig) return null;

    // 4. Calculate Scores
    const studentScores: Record<string, { totalWeighted: number, rawTotal: number, count: number }> = {};

    evaluations.forEach((evalData: any) => {
        const studentId = evalData.student_id;
        if (!studentScores[studentId]) {
            studentScores[studentId] = { totalWeighted: 0, rawTotal: 0, count: 0 };
        }
        let weightedSum = 0;
        let rawSum = 0;

        Object.entries(evalData.scores).forEach(([critId, score]) => {
            const criteria = eventConfig.criterias.find(c => c.id === critId);
            if (criteria) {
                weightedSum += ((score as number) / criteria.maxScore) * criteria.weightage;
            }
            rawSum += (score as number);
        });

        studentScores[studentId].totalWeighted += weightedSum;
        studentScores[studentId].rawTotal += rawSum;
        studentScores[studentId].count += 1;
    });

    // 5. Rank & Winners
    const finalScores = Object.entries(studentScores).map(([studentId, data]) => ({
        studentId,
        finalScore: data.totalWeighted / data.count,
        rawTotal: data.rawTotal
    }));
    finalScores.sort((a, b) => b.finalScore - a.finalScore);

    const winners = finalScores.slice(0, 3).map((s, idx) => ({
        rank: idx + 1,
        studentId: s.studentId,
        score: Number(s.finalScore.toFixed(2))
    }));

    // 6. Update Session
    const { error: uErr } = await supabase.from('sessions').update({
        status: 'completed',
        winners: winners
    }).eq('id', sessionId);
    if (uErr) throw uErr;

    // 7. Generate Certificates (Mock logic ported)
    for (const w of winners) {
        await addCertificate({
            id: crypto.randomUUID(),
            userId: w.studentId,
            sessionId: sessionId,
            type: "winner",
            rank: w.rank,
            generatedAt: new Date().toISOString(),
            emailSent: true,
            downloadUrl: `https://midas.com/cert/winner/${sessionId}/${w.studentId}`
        });
    }

    // Participation
    for (const s of finalScores) {
        const isWinner = winners.some(w => w.studentId === s.studentId);
        if (!isWinner) {
            await addCertificate({
                id: crypto.randomUUID(),
                userId: s.studentId,
                sessionId: sessionId,
                type: "participation",
                generatedAt: new Date().toISOString(),
                emailSent: true,
                downloadUrl: `https://midas.com/cert/participation/${sessionId}/${s.studentId}`
            });
        }
    }

    return winners;
};

export const getSessionResults = async (sessionId: string) => {
    const { data, error } = await supabase.from('sessions').select('winners').eq('id', sessionId).single();
    if (error) return [];
    return data.winners || [];
};

export const getSubjectToppers = async () => {
    // This is expensive to do client side if data is large.
    // Fetch all completed sessions
    const { data: sessions, error } = await supabase.from('sessions').select('*').eq('status', 'completed');
    if (error || !sessions) return [];

    const eventConfig = await getEventConfig();
    if (!eventConfig) return [];

    const toppers: any[] = []; // Type properly in real implementation

    eventConfig.subjects.forEach(subject => {
        const subjectSessions = sessions.filter((s: any) => s.subject === subject);
        let topStudent: any = null;

        subjectSessions.forEach((session: any) => {
            const winners = session.winners as any[]; // Cast defaults
            if (winners) {
                const winner = winners.find(w => w.rank === 1);
                if (winner) {
                    if (!topStudent || winner.score > topStudent.score) {
                        topStudent = {
                            studentId: winner.studentId,
                            score: winner.score,
                            sessionName: session.name
                        };
                    }
                }
            }
        });

        if (topStudent) {
            toppers.push({ subject, ...topStudent });
        }
    });

    return toppers;
};

// --- STORAGE ---
export const uploadBonafide = async (userId: string, file: File): Promise<string | null> => {
    try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${userId}_bonafide_${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
            .from('documents')
            .upload(fileName, file, { upsert: true });

        if (uploadError) {
            console.error('Storage upload error:', uploadError);
            return null;
        }

        const { data } = supabase.storage.from('documents').getPublicUrl(fileName);
        return data.publicUrl;
    } catch (e) {
        console.error('Failed to upload bonafide:', e);
        return null;
    }
};
