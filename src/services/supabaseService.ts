import { supabase } from '../lib/supabaseClient';
// import { Database } from '../types/supabase'; // We might need to generate types, but for now we'll use 'any' or manual types
import { User, Judge, EventConfig, Event, Deadline, Registration, Abstract, Session, Evaluation, Certificate, EvaluationCriteria } from '../types';
import bcrypt from 'bcryptjs';
import { sendAccountCreationEmail, generateMidasId, generateQRCodeUrl } from './emailService';
import { logAction } from './adminAuditService';
import { triggerCertificateDistribution } from './certificateEmailWorker';

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
export const getUsers = async (program?: string): Promise<User[]> => {
    let query = supabase.from('members').select('*');
    if (program) query = query.eq('program', program);
    const { data, error } = await query;
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
    program: member.program,
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

    await logAction('CREATE_MEMBER', 'members', user.id, { email: user.email, role: user.role });
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

    await logAction('UPDATE_MEMBER', 'members', id, dbUpdates);
};

export const deleteUser = async (id: string) => {
    const { error } = await supabase.from('members').delete().eq('id', id);
    if (error) throw error;

    await logAction('DELETE_MEMBER', 'members', id);
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
    program?: string;
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
            program: data.program || null,
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

export const updateStudentPassword = async (id: string, newPassword: string) => {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const { error } = await supabase
        .from('event_students')
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

export const resetStudentPassword = async (email: string): Promise<string> => {
    const { data: student, error: fetchError } = await supabase
        .from('event_students')
        .select('*')
        .eq('email', email)
        .limit(1)
        .maybeSingle();

    if (fetchError || !student) {
        throw new Error("No student account found with this email address.");
    }

    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let tempPassword = '';
    for (let i = 0; i < 10; i++) tempPassword += chars.charAt(Math.floor(Math.random() * chars.length));

    const hashedPassword = await bcrypt.hash(tempPassword, 10);
    const { error: updateError } = await supabase
        .from('event_students')
        .update({ password: hashedPassword, mustChangePassword: true })
        .eq('id', student.id);

    if (updateError) throw updateError;

    return tempPassword;
};

export const getStudentPayments = async (studentId: string) => {
    const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('eventStudentId', studentId);
    if (error) throw error;
    return data;
};

export const getStudentDashboardStats = async (studentId: string) => {
    // 1. Fetch student for selected events
    const { data: student } = await supabase
        .from('event_students')
        .select('selectedEvents')
        .eq('id', studentId)
        .single();

    // 2. Count submissions
    const { count: abstractsSubmitted } = await supabase
        .from('submissions')
        .select('id', { count: 'exact', head: true })
        .eq('eventStudentId', studentId);

    // 3. Count payments
    const { count: paymentsMade } = await supabase
        .from('payments')
        .select('id', { count: 'exact', head: true })
        .eq('eventStudentId', studentId)
        .eq('status', 'PAID');

    // 4. Count certificates
    const { count: certificatesCount } = await supabase
        .from('certificates')
        .select('id', { count: 'exact', head: true })
        .eq('eventStudentId', studentId);

    return {
        eventsEnrolled: student?.selectedEvents?.length || 0,
        abstractsSubmitted: abstractsSubmitted || 0,
        paymentsMade: paymentsMade || 0,
        certificates: certificatesCount || 0
    };
};

// --- DASHBOARD STATS ---
export const getDashboardStats = async (program?: string) => {
    let studentQuery = supabase.from('event_students').select('id', { count: 'exact', head: true });
    let sessionQuery = supabase.from('sessions').select('id', { count: 'exact', head: true });
    let submissionQuery = supabase.from('submissions').select('id', { count: 'exact', head: true }).eq('status', 'SUBMITTED');
    let paymentQuery = supabase.from('payments').select('amount', { count: 'exact' }).eq('status', 'PAID');

    if (program) {
        studentQuery = studentQuery.eq('program', program);
        sessionQuery = sessionQuery.eq('program', program);
        submissionQuery = submissionQuery.eq('program', program);
        paymentQuery = paymentQuery.eq('program', program);
    }

    const [studentsRes, sessionsRes, submissionsRes, paymentsRes] = await Promise.all([
        studentQuery,
        sessionQuery,
        submissionQuery,
        paymentQuery,
    ]);

    const totalStudents = studentsRes.count || 0;
    const totalSessions = sessionsRes.count || 0;
    const pendingAbstracts = submissionsRes.count || 0;
    const totalRevenue = (paymentsRes.data || []).reduce((sum: number, p: any) => sum + (p.amount || 0), 0);

    // Recent registrations
    let recentQuery = supabase
        .from('event_students')
        .select('id, participantName, email, college, registeredAt, paymentStatus, approvalStatus, program')
        .order('registeredAt', { ascending: false })
        .limit(10);
    
    if (program) recentQuery = recentQuery.eq('program', program);

    const { data: recentRegistrations } = await recentQuery;

    return {
        totalStudents,
        totalSessions,
        pendingAbstracts,
        totalRevenue,
        recentRegistrations: recentRegistrations || [],
    };
};

// --- EVENT STUDENTS (student registrations) ---
export const getEventStudents = async (program?: string) => {
    let query = supabase.from('event_students').select('*');
    if (program) query = query.eq('program', program);
    const { data, error } = await query.order('id', { ascending: false });
    if (error) throw error;
    return (data || []).map((s: any) => ({
        ...s,
        name: s.participantName || s.name,
        phone: s.mobile || s.phone
    }));
};

export const getEventStudentCount = async (): Promise<number> => {
    const { count, error } = await supabase
        .from('event_students')
        .select('id', { count: 'exact', head: true });
    if (error) return 0;
    return count || 0;
};

export const getAssignedMidasIdCount = async (): Promise<number> => {
    const { count, error } = await supabase
        .from('event_students')
        .select('id', { count: 'exact', head: true })
        .not('midasId', 'is', null);
    if (error) return 0;
    return count || 0;
};

export const getLatestMidasId = async (program: string = 'MIDAS'): Promise<string | null> => {
    const { data, error } = await supabase
        .from('event_students')
        .select('midasId')
        .eq('program', program)
        .not('midasId', 'is', null);
    if (error || !data || data.length === 0) return null;
    
    let maxSeq = -1;
    let maxId: string | null = null;
    
    for (const row of data) {
        const idStr = row.midasId;
        if (!idStr) continue;
        const parts = idStr.split('-');
        if (parts.length === 3) {
            const seq = parseInt(parts[2], 10);
            if (!isNaN(seq) && seq > maxSeq) {
                maxSeq = seq;
                maxId = idStr;
            }
        }
    }
    
    return maxId;
};

export const updateEventStudent = async (id: string, updates: Record<string, any>) => {

    const { error } = await supabase
        .from('event_students')
        .update(updates)
        .eq('id', id);
    if (error) throw error;

    await logAction('UPDATE_STUDENT', 'event_students', id, updates);
};

export const deleteEventStudent = async (id: string) => {
    const { error } = await supabase
        .from('event_students')
        .delete()
        .eq('id', id);
    if (error) throw error;

    await logAction('DELETE_STUDENT', 'event_students', id);
};

export const addEventStudent = async (studentData: {
    participantName: string;
    email: string;
    mobile: string;
    college: string;
    course?: string;
    year?: string;
    program: string;
    delegateType?: string;
    dciNumber?: string;
    speciality?: string;
    state?: string;
    qualification?: string;
    yearsOfPractice?: number;
    academicPosition?: string;
    teachingExperience?: string;
    registrationId?: string;
}) => {
    // 1. Generate a random temporary password
    const tempPassword = Math.random().toString(36).slice(-8);
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    // 2. Generate MIDAS/ICON ID
    const latestId = await getLatestMidasId(studentData.program);
    const midasId = generateMidasId(latestId || 0, studentData.program);
    const qrCodeUrl = generateQRCodeUrl(midasId, studentData.participantName, studentData.college, 300, studentData.program);

    // 3. Insert into event_students
    const payload: any = {
        participantName: studentData.participantName,
        email: studentData.email,
        mobile: studentData.mobile,
        college: studentData.college,
        course: studentData.course || null,
        year: studentData.year || 'N/A',
        program: studentData.program,
        paymentStatus: "PAID",
        approvalStatus: "APPROVED",
        midasId: midasId,
        qrCodeData: qrCodeUrl,
        password: hashedPassword,
        mustChangePassword: true,
        registrationId: studentData.registrationId || null,
        delegateType: studentData.delegateType || null,
        dciNumber: studentData.dciNumber || null,
        speciality: studentData.speciality || null,
        state: studentData.state || null,
        qualification: studentData.qualification || null,
        yearsOfPractice: studentData.yearsOfPractice || null,
        academicPosition: studentData.academicPosition || null,
        teachingExperience: studentData.teachingExperience || null,
        registeredAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };

    const { data: student, error } = await supabase
        .from('event_students')
        .insert(payload)
        .select()
        .single();

    if (error) throw error;

    // 4. Create a payment record
    const { error: payError } = await supabase
        .from('payments')
        .insert({
            eventStudentId: student.id,
            amount: 1030,
            currency: 'INR',
            status: 'PAID',
            paymentGatewayId: `manual_${Date.now()}`,
            transactionId: `manual_${Date.now()}`,
        });

    if (payError) console.error("Manual registration payment record failed:", payError);

    await logAction('CREATE_STUDENT', 'event_students', student.id, { email: student.email });

    return { student, tempPassword };
};

export const bulkAddEventStudents = async (studentsData: {
    participantName: string;
    email: string;
    mobile: string;
    college: string;
    year: string;
    program: string;
    delegateType?: string;
    registrationId?: string;
}[]) => {
    if (studentsData.length === 0) return { success: true, count: 0 };

    const program = studentsData[0].program;
    const latestId = await getLatestMidasId(program);
    
    let baseSeq = 0;
    if (latestId) {
        const parts = latestId.split('-');
        if (parts.length === 3) {
            const seq = parseInt(parts[2], 10);
            if (!isNaN(seq)) {
                baseSeq = seq;
            }
        }
    }

    const payloads = await Promise.all(studentsData.map(async (student, index) => {
        const tempPassword = student.mobile || Math.random().toString(36).slice(-8);
        const hashedPassword = await bcrypt.hash(tempPassword, 10);

        const studentSeq = baseSeq + index;
        const midasId = generateMidasId(studentSeq, program);
        const qrCodeUrl = generateQRCodeUrl(midasId, student.participantName, student.college, 300, program);

        return {
            participantName: student.participantName,
            email: student.email,
            mobile: student.mobile,
            college: student.college,
            year: student.year || 'N/A',
            program: program,
            paymentStatus: "PAID",
            approvalStatus: "APPROVED",
            midasId: midasId,
            qrCodeData: qrCodeUrl,
            password: hashedPassword,
            mustChangePassword: true,
            registrationId: student.registrationId || null,
            delegateType: student.delegateType || (program === 'ICON' ? 'PG' : 'UG'),
            registeredAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
    }));

    const { data: insertedStudents, error: insertError } = await supabase
        .from('event_students')
        .insert(payloads)
        .select('id, email');

    if (insertError) throw insertError;

    if (insertedStudents && insertedStudents.length > 0) {
        const paymentPayloads = insertedStudents.map((student: any) => ({
            eventStudentId: student.id,
            amount: 1030,
            currency: 'INR',
            status: 'PAID',
            paymentGatewayId: `manual_bulk_${Date.now()}`,
            transactionId: `manual_bulk_${Date.now()}`,
        }));

        const { error: payError } = await supabase
            .from('payments')
            .insert(paymentPayloads);

        if (payError) {
            console.error("Bulk payment registration failed:", payError);
        }

        for (const s of insertedStudents) {
            await logAction('CREATE_STUDENT', 'event_students', s.id, { email: s.email, note: 'BULK_UPLOAD' });
        }
    }

    return { success: true, count: insertedStudents?.length || 0 };
};

// --- JUDGES ---
export const getJudges = async (program?: string): Promise<Judge[]> => {
    let query = supabase.from('judges').select('*, members!memberId(email, phone)');
    if (program) query = query.eq('program', program);
    
    const { data, error } = await query;
    if (error) {
        // Fallback: try without join if FK naming differs
        let fallbackQuery = supabase.from('judges').select('*');
        if (program) fallbackQuery = fallbackQuery.eq('program', program);
        const { data: fallbackData, error: fbError } = await fallbackQuery;
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
            program: j.program
        })) as Judge[];
    }
    return (data || []).map((j: any) => ({
        id: j.id,
        name: j.fullName || j.full_name || '',
        specialization: j.specialization || '',
        type: (j.isAcademic ?? j.is_academic) ? 'Academic' : 'Non-Academic',
        affiliation: j.college || '',
        email: j.members?.email || '',
        contact: j.members?.phone || j.phone || '',
        status: 'Available',
        timeSlots: j.time_slots || [],
        program: j.program
    })) as Judge[];
};


export const addJudge = async (judge: Omit<Judge, 'id'>) => {
    // Generate a random 8-character password
    const tempPassword = Math.random().toString(36).slice(-8);
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    const normalizedProgram = (judge.program ? judge.program.toUpperCase() : 'MIDAS') as 'MIDAS' | 'ICON';

    // Step 1: Create a member record with role JUDGE
    const { data: memberData, error: memberError } = await supabase
        .from('members')
        .insert({
            email: judge.email,
            password: hashedPassword,
            name: judge.name,
            phone: judge.contact || null,
            role: 'JUDGE',
            isActive: true,
            program: normalizedProgram,
            mustChangePassword: true,
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
            program: normalizedProgram
        });
    if (judgeError) {
        // Rollback: delete the member if judge creation fails
        await supabase.from('members').delete().eq('id', memberData.id);
        throw judgeError;
    }

    await logAction('CREATE_JUDGE', 'judges', memberData.id, { email: judge.email, name: judge.name });

    // Step 3: Send email with credentials
    try {
        await sendAccountCreationEmail({
            user_name: judge.name,
            user_email: judge.email,
            temp_password: tempPassword,
            login_url: window.location.origin + "/member-login",
            role: "judge"
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

    if (Object.keys(dbUpdates).length > 0) {
        const { error } = await supabase.from('judges').update(dbUpdates).eq('id', id);
        if (error) throw error;
    }

    if (updates.contact !== undefined || updates.name !== undefined || updates.email !== undefined) {
        const { data: judgeData } = await supabase.from('judges').select('memberId').eq('id', id).single();
        if (judgeData?.memberId) {
            const memberUpdates: any = {};
            if (updates.contact !== undefined) memberUpdates.phone = updates.contact;
            if (updates.name !== undefined) memberUpdates.name = updates.name;
            if (updates.email !== undefined) memberUpdates.email = updates.email;
            
            if (Object.keys(memberUpdates).length > 0) {
                await supabase.from('members').update(memberUpdates).eq('id', judgeData.memberId);
            }
        }
    }

    await logAction('UPDATE_JUDGE', 'judges', id, updates);
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

    await logAction('DELETE_JUDGE', 'judges', id);
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

export const getCollegesList = async (): Promise<{ value: string, label: string }[]> => {
    const collegesMap = new Map<string, string>();

    // Default baseline colleges list
    const defaults = [
        { value: "saveetha_dental_college_and_hospitals", label: "Saveetha Dental College And Hospitals" },
        { value: "srm_dental_college", label: "SRM Dental College" },
        { value: "srm_kattankulathur_dental_college_and_hospital", label: "SRM Kattankulathur Dental College and Hospital" },
        { value: "sri_ramachandra_dental_college", label: "Sri Ramachandra Dental College" },
        { value: "government_dental_college_and_hospital", label: "Government Dental College and Hospital" },
        { value: "sree_balaji_dental_college_and_hospital", label: "Sree Balaji Dental College & Hospital" },
        { value: "sri_venkateswara_dental_college_and_hospital", label: "Sri Venkateswara Dental College & Hospital" },
        { value: "ragas_dental_college_and_hospital", label: "Ragas Dental College and Hospital" },
        { value: "thai_moogambigai_dental_college_and_hospital", label: "Thai Moogambigai Dental College and Hospital" },
        { value: "meenakshi_ammal_dental_college_and_hospital", label: "Meenakshi Ammal Dental College and Hospital" },
        { value: "tagore_dental_college_and_hospital", label: "Tagore Dental College & Hospital" },
        { value: "sathyabama_university_dental_college_and_hospital", label: "Sathyabama University Dental College and Hospital" },
        { value: "madha_dental_college_and_hospital", label: "Madha Dental College & Hospital" },
        { value: "dr_mgr_educational_and_research_institute_dental_college", label: "Dr. M.G.R. Educational and Research Institute Dental College" },
        { value: "chettinad_dental_college_and_research_institute", label: "Chettinad Dental College and Research Institute" },
        { value: "vinayaka_mission_dental_college", label: "Vinayaka Mission Dental College" },
        { value: "bharath_institute_of_higher_education_and_research_dental_college", label: "Bharath Institute of Higher Education and Research Dental College" },
        { value: "vels_dental_college_and_hospital", label: "Vels Dental College and Hospital" },
        { value: "adhiparasakthi_dental_college_and_hospital", label: "Adhiparasakthi Dental College and Hospital" },
        { value: "penang_international_dental_college", label: "Penang International Dental College" },
        { value: "annai_theresa_dental_college_and_hospital", label: "Annai Theresa Dental College and Hospital" },
        { value: "KLE_VK_Institute_of_Dental_Sciences_Belagavi", label: "KLE VK Institute of Dental Sciences, Belagavi" },
        { value: "SDM_College_of_Dental_Sciences_Dharwad", label: "SDM College of Dental Sciences, Dharwad" },
        { value: "Government_Dental_College_Bangalore", label: "Government Dental College, Bangalore" },
        { value: "Bapuji_Dental_College_Davangere", label: "Bapuji Dental College, Davangere" },
        { value: "Manipal_College_of_Dental_Sciences", label: "Manipal College of Dental Sciences" }
    ];

    defaults.forEach(c => collegesMap.set(c.label.trim().toLowerCase(), c.label.trim()));

    // 1. Config colleges
    try {
        const config = await getEventConfig();
        if (config?.capacities && (config.capacities as any).colleges) {
            const configCols = (config.capacities as any).colleges;
            configCols.forEach((c: any) => {
                const label = typeof c === 'string' ? c : c.label || c.value;
                if (label) collegesMap.set(label.trim().toLowerCase(), label.trim());
            });
        }
    } catch (e) {
        console.error("Failed to load colleges from database config", e);
    }

    // 2. Query distinct colleges from event_students & members tables to include all colleges stored in DB
    try {
        const [studentsRes, membersRes] = await Promise.all([
            supabase.from('event_students').select('college'),
            supabase.from('members').select('staffCoordinatorCollege')
        ]);

        if (studentsRes.data) {
            studentsRes.data.forEach(s => {
                if (s.college && s.college.trim()) {
                    collegesMap.set(s.college.trim().toLowerCase(), s.college.trim());
                }
            });
        }
        if (membersRes.data) {
            membersRes.data.forEach(m => {
                if (m.staffCoordinatorCollege && m.staffCoordinatorCollege.trim()) {
                    collegesMap.set(m.staffCoordinatorCollege.trim().toLowerCase(), m.staffCoordinatorCollege.trim());
                }
            });
        }
    } catch (e) {
        console.error("Failed to load colleges from event_students or members", e);
    }

    return Array.from(collegesMap.values()).sort().map(name => ({
        value: name,
        label: name
    }));
};

export const saveCollegesList = async (colleges: { value: string, label: string }[]) => {
    const config = await getEventConfig();
    if (config) {
        config.capacities = {
            ...config.capacities,
            colleges: colleges as any
        };
        await updateEventConfig(config);
    }
};

// --- EVENT MASTER (Dynamic Events) ---

export const getEvents = async (program?: string): Promise<Event[]> => {
    let query = supabase.from('event_master').select('*');
    if (program) query = query.eq('program', program);
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    return data.map((e: any) => ({
        id: e.id,
        name: e.name,
        type: e.type,
        mode: e.mode === "ONLINE" ? "Online" : e.mode === "OFFLINE" ? "Offline" : e.mode,
        capacity: e.capacity,
        criterias: e.assessment_criteria,
        rules: e.rules,
        judgeInstructions: e.judge_instructions,
        abstractDeadline: e.abstract_deadline,
        presentationDeadline: e.presentation_deadline,
        program: e.program
    }));
};

export const addEvent = async (event: Omit<Event, "id">) => {
    const dbEvent = {
        name: event.name,
        type: event.type,
        mode: event.mode ? event.mode.toUpperCase() : undefined,
        capacity: event.capacity,
        assessment_criteria: event.criterias,
        rules: event.rules,
        judge_instructions: event.judgeInstructions,
        abstract_deadline: event.abstractDeadline,
        presentation_deadline: event.presentationDeadline,
        program: event.program
    };
    const { error } = await supabase.from('event_master').insert(dbEvent);
    if (error) throw error;
    await logAction('CREATE_EVENT', 'event_master', null, { name: event.name });
};

export const updateEvent = async (id: string, updates: Partial<Event>) => {
    const dbUpdates: any = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.type !== undefined) dbUpdates.type = updates.type;
    if (updates.mode !== undefined) dbUpdates.mode = updates.mode.toUpperCase();
    if (updates.capacity !== undefined) dbUpdates.capacity = updates.capacity;
    if (updates.criterias !== undefined) dbUpdates.assessment_criteria = updates.criterias;
    if (updates.rules !== undefined) dbUpdates.rules = updates.rules;
    if (updates.judgeInstructions !== undefined) dbUpdates.judge_instructions = updates.judgeInstructions;
    if (updates.abstractDeadline !== undefined) dbUpdates.abstract_deadline = updates.abstractDeadline;
    if (updates.presentationDeadline !== undefined) dbUpdates.presentation_deadline = updates.presentationDeadline;

    const { error } = await supabase.from('event_master').update(dbUpdates).eq('id', id);
    if (error) throw error;
    await logAction('UPDATE_EVENT', 'event_master', id, dbUpdates);
};

export const deleteEvent = async (id: string) => {
    const { error } = await supabase.from('event_master').delete().eq('id', id);
    if (error) throw error;

    await logAction('DELETE_EVENT', 'event_master', id);
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

    await logAction('UPDATE_DEADLINE', 'deadlines', id, { date });
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

    await logAction('UPDATE_REGISTRATION_STATUS', 'registrations', id, { status });
};

// --- ABSTRACTS ---
export const getAbstracts = async (program?: string): Promise<Abstract[]> => {
    let query = supabase.from('submissions').select('*');
    if (program) query = query.eq('program', program);
    const { data, error } = await query;
    if (error) throw error;

    // Ensure we return full public URLs even if they were stored as relative paths
    const resolveUrl = (url: string | null) => {
        if (!url) return "";
        if (url.startsWith('http')) return url;
        const { data } = supabase.storage.from('abstracts').getPublicUrl(url);
        return data.publicUrl;
    };

    return data.map((s: any) => ({
        id: s.id,
        studentId: s.eventStudentId || s.studentId, 
        title: s.title,
        subject: s.subject,
        college: "Unknown", 
        type: s.eventType === "PAPER" ? "Paper" : "Poster",
        mode: s.eventMode,
        status: s.status === "DRAFT" ? "pending" : s.status === "SUBMITTED" ? "submitted" : s.status === "STAFF_APPROVED" ? "staff_approved" : s.status === "APPROVED" ? "approved" : s.status === "REJECTED" ? "rejected" : s.status === "revision_requested" || s.status === "REVISION_REQUESTED" ? "revision_requested" : s.status,
        fileUrl: resolveUrl(s.abstractFileUrl),
        presentationUrl: resolveUrl(s.presentationUrl),
        feedback: s.remarks,
        mentorName: "N/A", 
        coAuthors: [], 
        submittedAt: s.submissionDate,
        program: s.program
    })) as Abstract[];
};

export const addAbstract = async (abstract: Omit<Abstract, 'id' | 'submittedAt' | 'status'>) => {
    const dbData = {
        eventStudentId: abstract.studentId,
        title: abstract.title,
        subject: abstract.subject,
        eventType: abstract.type.includes("Paper") ? "PAPER" : "POSTER",
        eventMode: abstract.mode.toUpperCase(),
        abstractFileUrl: abstract.fileUrl,
        presentationUrl: abstract.presentationUrl,
        remarks: abstract.feedback,
        status: "SUBMITTED"
    };
    const { error } = await supabase.from('submissions').insert(dbData);
    if (error) throw error;
};

export const updateAbstractStatus = async (id: string, status: Abstract["status"], feedback?: string) => {
    // Map abstract status back to DB SubmissionStatus enum
    const dbStatus = status === "staff_approved" ? "STAFF_APPROVED" : status === "approved" ? "APPROVED" : status === "rejected" ? "REJECTED" : status === "revision_requested" ? "revision_requested" : status === "pending" ? "DRAFT" : "SUBMITTED";
    const { error } = await supabase.from('submissions').update({ status: dbStatus, remarks: feedback }).eq('id', id);
    if (error) throw error;

    await logAction('UPDATE_ABSTRACT_STATUS', 'submissions', id, { status: dbStatus, remarks: feedback });

    // Send status update email to the student
    try {
        const { data: submission } = await supabase
            .from('submissions')
            .select('title, program, remarks, eventStudentId')
            .eq('id', id)
            .single();

        if (submission?.eventStudentId) {
            const { data: student } = await supabase
                .from('event_students')
                .select('participantName, email')
                .eq('id', submission.eventStudentId)
                .single();

            if (student?.email) {
                const { sendAbstractStatusEmail } = await import('./emailService');
                await sendAbstractStatusEmail({
                    student_name: student.participantName,
                    student_email: student.email,
                    abstract_title: submission.title,
                    status: dbStatus,
                    remarks: feedback || submission.remarks || "No remarks provided.",
                    program: submission.program || "MIDAS",
                    login_url: window.location.origin + "/member-login"
                });
                console.log(`[AbstractStatusEmail] Email sent to ${student.email} for status: ${dbStatus}`);
            }
        }
    } catch (emailErr) {
        console.warn("[AbstractStatusEmail] Failed to send update email:", emailErr);
    }
};

export const updateAbstract = async (id: string, updates: Partial<Abstract>) => {
    const dbUpdates: any = {};
    if (updates.title) dbUpdates.title = updates.title;
    if (updates.subject) dbUpdates.subject = updates.subject;
    if (updates.type) dbUpdates.eventType = updates.type.includes("Paper") ? "PAPER" : "POSTER";
    if (updates.mode) dbUpdates.eventMode = updates.mode.toUpperCase();
    if (updates.fileUrl) dbUpdates.abstractFileUrl = updates.fileUrl;
    if (updates.presentationUrl) dbUpdates.presentationUrl = updates.presentationUrl;
    if (updates.status) {
        dbUpdates.status = updates.status === "staff_approved" ? "STAFF_APPROVED" : updates.status === "approved" ? "APPROVED" : updates.status === "rejected" ? "REJECTED" : updates.status === "revision_requested" ? "revision_requested" : updates.status === "pending" ? "DRAFT" : "SUBMITTED";
    }
    if (updates.feedback) dbUpdates.remarks = updates.feedback;

    const { error } = await supabase.from('submissions').update(dbUpdates).eq('id', id);
    if (error) throw error;
};

// --- SESSIONS ---
export const getSessions = async (program?: string): Promise<Session[]> => {
    // Fetch sessions along with their linked abstractIds (submissionId) and judgeIds
    let query = supabase
        .from('sessions')
        .select(`
            *,
            session_judges(judgeId, judge_finalized, finalized_at),
            session_participants(submissionId, attended)
        `);
    
    if (program) query = query.eq('program', program);

    const { data, error } = await query;

    if (error) {
        console.warn("Relational fetch failed for sessions, falling back", error);
        let fbQuery = supabase.from('sessions').select('*');
        if (program) fbQuery = fbQuery.eq('program', program);
        const { data: fbData } = await fbQuery;
        return (fbData || []).map((d: any) => ({
            id: d.id,
            name: d.name,
            subject: d.subject,
            type: d.type || 'PAPER',
            mode: d.mode || 'OFFLINE',
            date: d.startTime ? d.startTime.split('T')[0] : '',
            time: d.startTime ? new Date(d.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : '',
            venue: d.venue || d.meetingLink || '',
            judges: [],
            abstractIds: [],
            eventId: d.eventId,
            criterias: d.criterias || [],
            status: d.status ? d.status.toUpperCase() : 'SESSION_NOT_STARTED',
            currentPresenterId: d.currentPresenterId || null,
            program: d.program,
            winners: typeof d.winners === 'string' ? (()=>{ try { return JSON.parse(d.winners); } catch(e){ return []; } })() : (Array.isArray(d.winners) ? d.winners : [])
        })) as Session[];
    }

    return data.map((d: any) => {
        let dateStr = "";
        let timeStr = "";
        if (d.startTime) {
            const dateObj = new Date(d.startTime);
            if (!isNaN(dateObj.getTime())) {
                dateStr = dateObj.toISOString().split('T')[0];
                timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
            }
        }
        return {
            id: d.id,
            name: d.name,
            subject: d.subject,
            type: d.type || 'PAPER',
            mode: d.mode || 'OFFLINE',
            date: dateStr,
            time: timeStr,
            venue: d.venue || d.meetingLink || '',
            judges: d.session_judges?.map((j: any) => j.judgeId) || [],
            _sessionJudgesDetails: d.session_judges || [],
            abstractIds: d.session_participants?.map((p: any) => p.submissionId) || [],
            _attendedSubmissionIds: d.session_participants?.filter((p: any) => p.attended).map((p: any) => p.submissionId) || [],
            eventId: d.eventId,
            criterias: d.criterias || [],
            status: d.status ? d.status.toUpperCase() : 'SESSION_NOT_STARTED',
            currentPresenterId: d.currentPresenterId || null,
            program: d.program,
            winners: typeof d.winners === 'string' ? (()=>{ try { return JSON.parse(d.winners); } catch(e){ return []; } })() : (Array.isArray(d.winners) ? d.winners : []),
            completed_participants: typeof d.completed_participants === 'string' ? (()=>{ try { return JSON.parse(d.completed_participants); } catch(e){ return []; } })() : (Array.isArray(d.completed_participants) ? d.completed_participants : (d.completed_participants || []))
        };
    }) as Session[];
};

const getCurrentUserFromStorage = (): any => {
    try {
        const stored = localStorage.getItem("midas_user");
        if (stored) return JSON.parse(stored);
    } catch (e) {}
    return null;
};

export const isNonCompetitiveSession = (session: { type?: string; name?: string; subject?: string } | null | undefined): boolean => {
    if (!session) return false;
    const typeLower = (session.type || '').toLowerCase();
    const nameLower = (session.name || '').toLowerCase();
    const subjectLower = (session.subject || '').toLowerCase();
    return typeLower.includes('accommodation') || typeLower.includes('clinician') || typeLower.includes('academician') || typeLower.includes('acadamecian') ||
           nameLower.includes('accommodation') || nameLower.includes('clinician') || nameLower.includes('academician') || nameLower.includes('acadamecian') ||
           subjectLower.includes('accommodation') || subjectLower.includes('clinician') || subjectLower.includes('academician') || subjectLower.includes('acadamecian');
};

export const validateSessionAccess = async (sessionId: string, actionDescription: string) => {
    const user = getCurrentUserFromStorage();
    if (!user) return; // Allow if not logged in

    // Admin and Core Team have full access
    if (user.role === 'admin' || user.role === 'core_team') {
        return;
    }

    if (user.role === 'volunteer') {
        const { data, error } = await supabase
            .from('volunteer_assignments')
            .select('id')
            .eq('memberId', user.id)
            .eq('sessionId', sessionId)
            .maybeSingle();
        
        if (error || !data) {
            throw new Error(`Unauthorized: Volunteer is not assigned to this session. Cannot perform ${actionDescription}`);
        }
        return;
    }

    if (user.role === 'judge') {
        const { data: judgeData, error: jErr } = await supabase
            .from('judges')
            .select('id')
            .eq('memberId', user.id)
            .maybeSingle();

        if (jErr || !judgeData) {
            throw new Error("Judge profile not found");
        }

        const { data: assignment, error: aErr } = await supabase
            .from('session_judges')
            .select('id')
            .eq('sessionId', sessionId)
            .eq('judgeId', judgeData.id)
            .maybeSingle();

        if (aErr || !assignment) {
            throw new Error(`Unauthorized: Judge is not assigned to this session. Cannot perform ${actionDescription}`);
        }
        return;
    }
};

export const updateSessionStatus = async (id: string, status: string) => {
    await validateSessionAccess(id, "update status");
    
    // Validate finalization rule
    if (status.toUpperCase() === 'SESSION_COMPLETED' || status.toUpperCase() === 'COMPLETED') {
        const { data: session } = await supabase.from('sessions').select('*').eq('id', id).single();
        if (session) {
            const allAbstracts = await getAbstracts(session.program);
            const sessionAbstracts = allAbstracts.filter(a => session.abstractIds && session.abstractIds.includes(a.id));
            const attendedSubIds = (session as any)._attendedSubmissionIds || [];
            
            const { data: evaluations } = await supabase.from('evaluations').select('*').eq('session_id', id);
            const evals = evaluations || [];
            
            const isCompetitive = !isNonCompetitiveSession(session);
            for (const p of sessionAbstracts) {
                const isAbsent = !attendedSubIds.includes(p.id);
                if (!isAbsent && isCompetitive) {
                    const hasEval = evals.some(e => e.student_id === p.studentId || e.eventStudentId === p.studentId);
                    if (!hasEval) {
                        throw new Error(`Cannot finalize: Participant ${p.studentId} is present but has not been evaluated.`);
                    }
                }
            }
        }
    }

    const { error } = await supabase.from('sessions').update({ status: status.toUpperCase() }).eq('id', id);
    if (error) throw error;

    await logAction('UPDATE_SESSION_STATUS', 'sessions', id, { status });
};

export const updateCurrentPresenter = async (id: string, studentId: string | null) => {
    await validateSessionAccess(id, "update presenter");
    const { error } = await supabase.from('sessions').update({ currentPresenterId: studentId }).eq('id', id);
    if (error) throw error;

    await logAction('UPDATE_PRESENTER', 'sessions', id, { presenterId: studentId });
};

export const addSession = async (session: Omit<Session, "id">) => {
    let eventType = session.type.split(" ")[0].toUpperCase();
    if (!["PAPER", "POSTER", "QUIZ", "DEBATE", "WORKSHOP"].includes(eventType)) {
        eventType = "PAPER";
    }

    const isNonComp = isNonCompetitiveSession(session);

    const sessionPayload = {
        name: session.name,
        type: eventType,
        mode: session.mode.toUpperCase(),
        subject: session.subject,
        startTime: new Date(`${session.date}T${session.time}:00`).toISOString(),
        venue: session.venue || null,
        eventId: session.eventId || null,
        criterias: session.criterias || null,
        status: "SCHEDULED",
        program: session.program
    };

    // 1. Insert session
    const { data: newSession, error: sessionError } = await supabase
        .from('sessions')
        .insert(sessionPayload)
        .select('id')
        .single();

    if (sessionError) throw sessionError;
    const sessionId = newSession.id;

    // 2. Insert Judges if any
    if (session.judges && session.judges.length > 0) {
        for (const judgeId of session.judges) {
            const { count, error: countError } = await supabase
                .from('session_judges')
                .select('*', { count: 'exact', head: true })
                .eq('judgeId', judgeId);
            if (countError) throw countError;
            if (count && count >= 3) {
                const { data: judgeData } = await supabase.from('judges').select('*').eq('id', judgeId).single();
                const judgeName = judgeData?.fullName || judgeData?.full_name || judgeData?.name || judgeId;
                throw new Error(`Judge ${judgeName} is already assigned to 3 sessions. A judge can be assigned to at most 3 sessions.`);
            }
        }

        const judgePayloads = session.judges.map(judgeId => ({
            sessionId,
            judgeId,
            isChair: false
        }));
        const { error } = await supabase.from('session_judges').insert(judgePayloads);
        if (error) {
            console.error("Judge insert error", error);
            throw error;
        }
    }

    // 3. Link Participants (using the abstractIds aka submissions)
    if (session.abstractIds && session.abstractIds.length > 0) {
        const { data: subs, error: subsError } = await supabase
            .from('submissions')
            .select('id, eventStudentId, eventMode')
            .in('id', session.abstractIds);

        if (subsError) {
            console.error("Failed to lookup submissions for participant linker", subsError);
            throw subsError;
        }

        if (subs && subs.length > 0) {
            const participantPayloads = subs.map((sub, index) => ({
                sessionId,
                submissionId: sub.id,
                eventStudentId: sub.eventStudentId || null,
                presentationOrder: index + 1
            }));
            const { error: insertError } = await supabase.from('session_participants').insert(participantPayloads);
            if (insertError) {
                console.error("Participant insert error", insertError);
                throw insertError;
            }
        }
    }

    await logAction('CREATE_SESSION', 'sessions', sessionId, { name: session.name });
    return sessionId;
};

export const updateSession = async (id: string, updates: Partial<Session>) => {
    const dbUpdates: any = {};
    if (updates.name) dbUpdates.name = updates.name;
    if (updates.status) dbUpdates.status = updates.status.toUpperCase();
    if (updates.venue) dbUpdates.venue = updates.venue;
    if (updates.winners) dbUpdates.winners = updates.winners;
    if (updates.subject) dbUpdates.subject = updates.subject;
    if (updates.type) {
        let eventType = updates.type.split(" ")[0].toUpperCase();
        if (["PAPER", "POSTER", "QUIZ", "DEBATE", "WORKSHOP"].includes(eventType)) {
            dbUpdates.type = eventType;
        }
    }
    if (updates.mode) dbUpdates.mode = updates.mode.toUpperCase();
    if (updates.date && updates.time) {
        dbUpdates.startTime = new Date(`${updates.date}T${updates.time}:00`).toISOString();
    }
    if (updates.eventId !== undefined) dbUpdates.eventId = updates.eventId;
    if (updates.criterias !== undefined) dbUpdates.criterias = updates.criterias;
    if ((updates as any).completed_participants !== undefined) dbUpdates.completed_participants = (updates as any).completed_participants;

    if (Object.keys(dbUpdates).length > 0) {
        const { error } = await supabase.from('sessions').update(dbUpdates).eq('id', id);
        if (error) throw error;
    }

    const { data: currentSession } = await supabase.from('sessions').select('*').eq('id', id).single();
    const isNonComp = isNonCompetitiveSession({
        name: updates.name || currentSession?.name,
        type: updates.type || currentSession?.type,
        subject: updates.subject || currentSession?.subject
    });

    // Update Judges
    if (updates.judges !== undefined) {
        if (updates.judges.length > 0) {
            for (const judgeId of updates.judges) {
                const { count, error: countError } = await supabase
                    .from('session_judges')
                    .select('*', { count: 'exact', head: true })
                    .eq('judgeId', judgeId)
                    .neq('sessionId', id);
                if (countError) throw countError;
                if (count && count >= 3) {
                    const { data: judgeData } = await supabase.from('judges').select('*').eq('id', judgeId).single();
                    const judgeName = judgeData?.fullName || judgeData?.full_name || judgeData?.name || judgeId;
                    throw new Error(`Judge ${judgeName} is already assigned to 3 sessions. A judge can be assigned to at most 3 sessions.`);
                }
            }
        }
        await supabase.from('session_judges').delete().eq('sessionId', id);
        if (updates.judges.length > 0) {
            const judgePayloads = updates.judges.map(judgeId => ({
                sessionId: id,
                judgeId,
                isChair: false
            }));
            const { error } = await supabase.from('session_judges').insert(judgePayloads);
            if (error) throw error;
        }
    }

    // Update Participants (abstractIds)
    if (updates.abstractIds !== undefined) {
        await supabase.from('session_participants').delete().eq('sessionId', id);
        if (updates.abstractIds.length > 0) {
            const { data: subs, error: subsError } = await supabase
                .from('submissions')
                .select('id, eventStudentId')
                .in('id', updates.abstractIds);
            
            if (subsError) throw subsError;
            
            if (subs && subs.length > 0) {
                const participantPayloads = subs.map((sub, index) => ({
                    sessionId: id,
                    submissionId: sub.id,
                    eventStudentId: sub.eventStudentId || null,
                    presentationOrder: index + 1
                }));
                const { error: insertError } = await supabase.from('session_participants').insert(participantPayloads);
                if (insertError) throw insertError;
            }
        }
    }

    await logAction('UPDATE_SESSION', 'sessions', id, dbUpdates);
};

export const deleteSession = async (id: string) => {
    const { error } = await supabase.from('sessions').delete().eq('id', id);
    if (error) throw error;
    await logAction('DELETE_SESSION', 'sessions', id);
};

export const updateSessionAttendance = async (sessionId: string, attendedStudentIds: string[]) => {
    await validateSessionAccess(sessionId, "update attendance");
    const { data: abstracts, error } = await supabase.from('submissions').select('id, eventStudentId');
    if (error || !abstracts) {
        console.error("Failed to fetch abstracts for attendance mapping", error);
        return;
    }

    const attendedSubmissionIds = abstracts
        .filter(a => attendedStudentIds.includes(a.eventStudentId))
        .map(a => a.id);

    await supabase.from('session_participants').update({ attended: false }).eq('sessionId', sessionId);

    if (attendedSubmissionIds.length > 0) {
        const { error: updateError } = await supabase.from('session_participants')
            .update({ attended: true })
            .eq('sessionId', sessionId)
            .in('submissionId', attendedSubmissionIds);
        
        if (updateError) {
            console.error("Failed to update attendance records", updateError);
            throw updateError;
        }
    }

    await logAction('UPDATE_ATTENDANCE', 'sessions', sessionId, { attendedCount: attendedSubmissionIds.length });
};

// --- EVALUATIONS ---
export const getEvaluations = async (program?: string): Promise<Evaluation[]> => {
    let query = supabase.from('evaluations').select('*');
    if (program) query = query.eq('program', program);
    const { data, error } = await query;
    if (error) throw error;
    return data.map((e: any) => {
        const scoresObj = typeof e.scores === 'string' ? JSON.parse(e.scores) : (e.scores || {});
        return {
            id: e.id,
            sessionId: e.session_id || e.sessionId,
            judgeId: e.judge_id || e.judgeId,
            studentId: e.student_id || e.eventStudentId || e.participantId,
            scores: scoresObj,
            totalScore: e.total_score || e.totalScore || 0,
            feedback: e.feedback || e.comments,
            submittedAt: e.submitted_at || e.createdAt,
            isAbsent: !!scoresObj.isAbsent
        };
    });
};

export const addEvaluation = async (evaluation: Omit<Evaluation, "id" | "submittedAt"> & { program?: string }) => {
    const { data: session, error: sErr } = await supabase
        .from('sessions')
        .select('*')
        .eq('id', evaluation.sessionId)
        .single();
    if (sErr || !session) throw new Error("Session not found");

    if (session.status?.toLowerCase() === 'completed' || session.status?.toLowerCase() === 'session_completed') {
        throw new Error("Scores cannot be edited after finalization");
    }

    if (isNonCompetitiveSession(session)) {
        throw new Error("Accommodation/Clinician sessions cannot create judge records or evaluations");
    }

    const { data: sj, error: sjErr } = await supabase
        .from('session_judges')
        .select('id')
        .eq('sessionId', evaluation.sessionId)
        .eq('judgeId', evaluation.judgeId)
        .maybeSingle();
    if (sjErr || !sj) {
        throw new Error("Judge is not assigned to this session");
    }

    if (session.status !== 'SESSION_LIVE') {
        throw new Error("Evaluation not allowed until session is LIVE");
    }

    const { data: participant, error: pErr } = await supabase
        .from('session_participants')
        .select('attended')
        .eq('sessionId', evaluation.sessionId)
        .eq('eventStudentId', evaluation.studentId)
        .single();
    
    if (pErr || !participant) throw new Error("Participant not found in this session");

    if (!participant.attended || evaluation.isAbsent) {
        throw new Error("Participant marked absent");
    }

    if (session.currentPresenterId !== evaluation.studentId) {
        throw new Error("Only the active live presenter can be evaluated");
    }

    const dbEval = {
        session_id: evaluation.sessionId,
        judge_id: evaluation.judgeId,
        student_id: evaluation.studentId,
        scores: { ...evaluation.scores, isAbsent: evaluation.isAbsent },
        total_score: evaluation.totalScore,
        feedback: evaluation.feedback,
        program: evaluation.program,
        judgeId: evaluation.judgeId,
        eventStudentId: evaluation.studentId,
        comments: evaluation.feedback
    };
    const { error } = await supabase
        .from('evaluations')
        .upsert(dbEval, { onConflict: 'session_id,judge_id,student_id' });
    if (error) throw error;
};

// --- CERTIFICATES ---
export const logCertificateAction = async (userId: string, sessionId: string | null, action: string, details?: string) => {
    try {
        await supabase.from('certificate_audit_logs').insert({
            userId,
            sessionId,
            action,
            details
        });
    } catch (e) {
        console.error("Failed to log certificate action", e);
    }
};

export const getCertificates = async (program?: string): Promise<Certificate[]> => {
    let query = supabase.from('certificates').select('*');
    const { data, error } = await query;
    if (error) throw error;
    return data.map((c: any) => ({
        id: c.id,
        userId: c.user_id || c.eventStudentId,
        sessionId: c.session_id || c.eventId,
        type: (c.role || c.certificateType || c.type)?.toLowerCase() || 'participation',
        rank: c.rank,
        generatedAt: c.createdAt || c.generated_at || c.generatedAt,
        emailSent: !!(c.email_sent || c.emailSent),
        downloadUrl: `/api/certificate/download/${c.id}`
    }));
};

export const addCertificate = async (cert: Certificate) => {
    const isJudgeType = cert.type.toUpperCase() === 'JUDGE';
    
    const dbCert = {
        id: cert.id,
        eventStudentId: cert.userId,
        eventId: cert.sessionId,
        certificateType: isJudgeType ? 'PARTICIPATION' : cert.type.toUpperCase(),
        rank: cert.rank || null,
        user_id: cert.userId,
        session_id: cert.sessionId,
        role: cert.type.toLowerCase(),
        email_sent: cert.emailSent || false
    };
    
    // We try to upsert first to avoid duplicate key conflicts (e.g. from multiple judges finalizations)
    const { error } = await supabase.from('certificates').upsert(dbCert, {
        onConflict: 'eventStudentId,eventId,certificateType'
    });
    
    if (error) {
        console.warn("Upsert failed, trying standard insert as fallback with original columns", error);
        // Fallback for case where new columns or unique constraints are not run yet
        // In the original database schema, the column is named prizePosition (text) instead of rank.
        const { error: insertErr } = await supabase.from('certificates').insert({
            id: cert.id,
            eventStudentId: cert.userId,
            eventId: cert.sessionId,
            certificateType: isJudgeType ? 'PARTICIPATION' : cert.type.toUpperCase(),
            prizePosition: cert.rank ? String(cert.rank) : null
        });
        if (insertErr) {
            console.error("Standard fallback insert failed:", insertErr);
            throw new Error("Database schema mismatch. Please execute the SQL statements in 'certificates_migration.sql' in your Supabase SQL Editor to drop outdated foreign key constraints and update the schema.");
        }
    }
    
    await logCertificateAction(cert.userId, cert.sessionId || null, 'GENERATED', `Type: ${cert.type}`);
};

// --- RESULTS CALCULATION ---
// IMPORTANT: This logic mimics the mockDatabase logic but runs client-side fetching data.
// In a production app, this should be a Postgres Function or Edge Function.
export const calculateSessionResults = async (sessionId: string) => {
    await logAction('FINALIZE_SESSION', 'sessions', sessionId);

    // 1. Fetch Session
    const { data: session, error: sErr } = await supabase.from('sessions').select('*').eq('id', sessionId).single();
    if (sErr || !session) return null;

    let isNonComp = isNonCompetitiveSession(session);
    if (!isNonComp && session.eventId) {
        const { data: eventMaster } = await supabase.from('event_master').select('name, type').eq('id', session.eventId).single();
        if (eventMaster) {
            isNonComp = isNonCompetitiveSession({ name: eventMaster.name, type: eventMaster.type, subject: '' });
        }
    }

    if (isNonComp) {
        const { error: uErr } = await supabase.from('sessions').update({
            status: 'SESSION_COMPLETED',
            session_status: 'CLOSED',
            winners: []
        }).eq('id', sessionId);
        if (uErr) throw uErr;

        const { data: participants } = await supabase
            .from('session_participants')
            .select('eventStudentId')
            .eq('sessionId', sessionId)
            .eq('attended', true);
        
        const presentAttendeeIds = (participants || []).map((p: any) => p.eventStudentId).filter(Boolean);
        for (const studentId of presentAttendeeIds) {
            await addCertificate({
                id: crypto.randomUUID(),
                userId: studentId,
                sessionId: sessionId,
                type: "participation",
                generatedAt: new Date().toISOString(),
                emailSent: false,
                downloadUrl: `/api/certificate/download`
            });
        }

        // Judges: For all judges assigned to this session
        const { data: sessionJudges } = await supabase
            .from('session_judges')
            .select('judgeId')
            .eq('sessionId', sessionId);

        if (sessionJudges) {
            for (const sj of sessionJudges) {
                await addCertificate({
                    id: crypto.randomUUID(),
                    userId: sj.judgeId,
                    sessionId: sessionId,
                    type: "judge",
                    generatedAt: new Date().toISOString(),
                    emailSent: false,
                    downloadUrl: `/api/certificate/download`
                });
            }
        }

        return [];
    }

    // 2. Fetch Evaluations
    const { data: evaluations, error: eErr } = await supabase.from('evaluations').select('*').eq('session_id', sessionId);
    if (eErr || !evaluations || evaluations.length === 0) return null;

    // 3. Select Criteria (Respect session-level overrides)
    let activeCriterias = session.criterias || null;
    
    if (!activeCriterias || activeCriterias.length === 0) {
        // Fallback to Event-level from event_master
        if (session.eventId) {
            const { data: eventMaster } = await supabase.from('event_master').select('assessment_criteria').eq('id', session.eventId).single();
            if (eventMaster && eventMaster.assessment_criteria && eventMaster.assessment_criteria.length > 0) {
                activeCriterias = eventMaster.assessment_criteria;
            }
        }
    }
    
    if (!activeCriterias || activeCriterias.length === 0) {
        // Final fallback to standard criteria matching frontend SessionEvaluation.tsx
        activeCriterias = [
            { id: 'std-content', name: 'Scientific Content', maxScore: 10, weightage: 40 },
            { id: 'std-delivery', name: 'Presentation / Delivery', maxScore: 10, weightage: 30 },
            { id: 'std-impact', name: 'Innovation & Impact', maxScore: 10, weightage: 30 }
        ];
    }
    
    if (!activeCriterias || activeCriterias.length === 0) return null;

    // 4. Calculate Scores
    const studentScores: Record<string, { totalWeighted: number, rawTotal: number, count: number, isAbsent?: boolean }> = {};

    evaluations.forEach((evalData: any) => {
        const studentId = evalData.student_id || evalData.eventStudentId;
        if (!studentScores[studentId]) {
            studentScores[studentId] = { totalWeighted: 0, rawTotal: 0, count: 0, isAbsent: false };
        }
        
        let parsedScores = evalData.scores || {};
        if (typeof parsedScores === 'string') {
            try {
                parsedScores = JSON.parse(parsedScores);
            } catch (e) {
                parsedScores = {};
            }
        }

        if (parsedScores.isAbsent) {
            studentScores[studentId].isAbsent = true;
            return;
        }

        let weightedSum = 0;
        let rawSum = 0;

        Object.entries(parsedScores).forEach(([critId, score]) => {
            const criteria = (activeCriterias as any[]).find(c => c.id === critId);
            const numScore = Number(score);
            if (criteria && !isNaN(numScore)) {
                weightedSum += (numScore / criteria.maxScore) * criteria.weightage;
            }
            if (!isNaN(numScore)) {
                rawSum += numScore;
            }
        });

        studentScores[studentId].totalWeighted += weightedSum;
        studentScores[studentId].rawTotal += rawSum;
        studentScores[studentId].count += 1;
    });

    // 5. Rank & Winners
    const finalScores = Object.entries(studentScores)
        .filter(([_, data]) => !data.isAbsent && data.count > 0)
        .map(([studentId, data]) => ({
            studentId,
            finalScore: data.totalWeighted / data.count,
            rawTotal: data.rawTotal
        }));
    finalScores.sort((a, b) => b.finalScore - a.finalScore);

    let winnerLimit = 3;
    if (finalScores.length <= 3) {
        winnerLimit = 1;
    } else if (finalScores.length <= 6) {
        winnerLimit = 2;
    }

    const winners = finalScores.slice(0, winnerLimit).map((s, idx) => ({
        rank: idx + 1,
        studentId: s.studentId,
        score: Number(s.finalScore.toFixed(2))
    }));

    // 6. Update Session
    const { error: uErr } = await supabase.from('sessions').update({
        status: 'SESSION_COMPLETED',
        session_status: 'CLOSED',
        winners: winners
    }).eq('id', sessionId);
    if (uErr) throw uErr;

    // 7. Generate Certificates
    // Winners (Top 3)
    for (const w of winners) {
        await addCertificate({
            id: crypto.randomUUID(),
            userId: w.studentId,
            sessionId: sessionId,
            type: "winner",
            rank: w.rank,
            generatedAt: new Date().toISOString(),
            emailSent: false,
            downloadUrl: `/api/certificate/download`
        });
    }

    // Participation: For all present attendees
    const { data: participants } = await supabase
        .from('session_participants')
        .select('eventStudentId')
        .eq('sessionId', sessionId)
        .eq('attended', true);
    
    const presentAttendeeIds = (participants || []).map((p: any) => p.eventStudentId).filter(Boolean);
    for (const studentId of presentAttendeeIds) {
        await addCertificate({
            id: crypto.randomUUID(),
            userId: studentId,
            sessionId: sessionId,
            type: "participation",
            generatedAt: new Date().toISOString(),
            emailSent: false,
            downloadUrl: `/api/certificate/download`
        });
    }

    // Judges: For all judges assigned to this session
    const { data: sessionJudges } = await supabase
        .from('session_judges')
        .select('judgeId')
        .eq('sessionId', sessionId);

    if (sessionJudges) {
        for (const sj of sessionJudges) {
            await addCertificate({
                id: crypto.randomUUID(),
                userId: sj.judgeId,
                sessionId: sessionId,
                type: "judge",
                generatedAt: new Date().toISOString(),
                emailSent: false,
                downloadUrl: `/api/certificate/download`
            });
        }
    }

    return winners;
};

export const finalizeJudgeScores = async (sessionId: string, judgeId: string, program: string = "MIDAS") => {
    let allFinalized = false;
    try {
        const { error: jErr } = await supabase
            .from('session_judges')
            .update({ 
                judge_finalized: true, 
                finalized_at: new Date().toISOString() 
            })
            .eq('sessionId', sessionId)
            .eq('judgeId', judgeId);

        if (jErr) throw jErr;

        const { data: sJudges } = await supabase
            .from('session_judges')
            .select('*')
            .eq('sessionId', sessionId);

        allFinalized = sJudges && sJudges.length > 0 && sJudges.every(j => j.judge_finalized);
    } catch (dbErr) {
        console.warn("Supabase session_judges columns missing or failed, using fallback auto-closure", dbErr);
        allFinalized = true; // Fallback: close immediately on dev/mock systems if column doesn't exist
    }

    if (allFinalized) {
        const winners = await calculateSessionResults(sessionId);
        await supabase.from('sessions').update({ 
            status: 'SESSION_COMPLETED',
            session_status: 'CLOSED'
        }).eq('id', sessionId);
        
        // Trigger automated certificate emailing in background without blocking finalization UI
        triggerCertificateDistribution(sessionId, program).catch(err => {
            console.error("Certificate emailing worker failed:", err);
        });

        return { closed: true, winners };
    }

    await supabase.from('sessions').update({ 
        session_status: 'PENDING_FINALIZATION'
    }).eq('id', sessionId);

    return { closed: false };
};

export const getSessionResults = async (sessionId: string) => {
    const { data, error } = await supabase.from('sessions').select('winners').eq('id', sessionId).single();
    if (error) return [];
    let winners = data.winners;
    if (typeof winners === 'string') {
        try { winners = JSON.parse(winners); } catch(e) { winners = []; }
    }
    return Array.isArray(winners) ? winners : [];
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
            let winners = session.winners;
            if (typeof winners === 'string') {
                try { winners = JSON.parse(winners); } catch (e) { winners = []; }
            }
            winners = Array.isArray(winners) ? winners : [];
            
            if (winners && winners.length > 0) {
                const winner = winners.find((w: any) => w.rank === 1);
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

export const uploadPassportPhoto = async (userId: string, file: File): Promise<string | null> => {
    try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${userId}_photo_${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
            .from('documents')
            .upload(fileName, file, { upsert: true });

        if (uploadError) {
            console.error('Storage upload photo error:', uploadError);
            return null;
        }

        const { data } = supabase.storage.from('documents').getPublicUrl(fileName);
        return data.publicUrl;
    } catch (e) {
        console.error('Failed to upload passport photo:', e);
        return null;
    }
};

export const checkDuplicateIdCardNumber = async (idCardNumber: string, currentStudentId?: string): Promise<boolean> => {
    try {
        const trimmed = idCardNumber.trim();
        if (!trimmed) return false;

        let query = supabase
            .from('event_students')
            .select('id')
            .eq('idCardNumber', trimmed);

        if (currentStudentId) {
            query = query.neq('id', currentStudentId);
        }

        const { data, error } = await query;
        if (error) {
            console.error('Error checking duplicate ID Card Number:', error);
            return false;
        }
        return (data || []).length > 0;
    } catch (e) {
        console.error('Failed to check duplicate ID Card Number:', e);
        return false;
    }
};

export const recordUndertakingAcceptance = async (data: {
    eventStudentId: string;
    idCardNumber: string;
    declarationAccepted: boolean;
    termsAccepted: boolean;
    refundPolicyAccepted: boolean;
    termsVersion: string;
    refundPolicyVersion: string;
    ipAddress?: string;
    paymentReference?: string;
}) => {
    try {
        // 1. Update event_students table
        await supabase
            .from('event_students')
            .update({
                idCardNumber: data.idCardNumber.trim(),
                declarationAccepted: data.declarationAccepted,
                termsAccepted: data.termsAccepted,
                refundPolicyAccepted: data.refundPolicyAccepted,
                termsVersion: data.termsVersion,
                refundPolicyVersion: data.refundPolicyVersion,
                acceptedAt: new Date().toISOString(),
                ipAddress: data.ipAddress || null,
            })
            .eq('id', data.eventStudentId);

        // 2. Insert into undertaking_acceptances audit table
        await supabase
            .from('undertaking_acceptances')
            .insert({
                eventStudentId: data.eventStudentId,
                idCardNumber: data.idCardNumber.trim(),
                declarationAccepted: data.declarationAccepted,
                termsAccepted: data.termsAccepted,
                refundPolicyAccepted: data.refundPolicyAccepted,
                termsVersion: data.termsVersion,
                refundPolicyVersion: data.refundPolicyVersion,
                ipAddress: data.ipAddress || null,
                paymentReference: data.paymentReference || null,
                acceptedAt: new Date().toISOString(),
            });
    } catch (err) {
        console.error("Failed recording undertaking acceptance:", err);
    }
};

export const uploadAbstractFile = async (abstractId: string, file: File): Promise<string | null> => {
    try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${abstractId}_abstract_${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
            .from('abstracts')
            .upload(fileName, file, { upsert: true });

        if (uploadError) {
            console.error('Storage upload error:', uploadError);
            return null;
        }

        const { data } = supabase.storage.from('abstracts').getPublicUrl(fileName);
        return data.publicUrl;
    } catch (e) {
        console.error('Failed to upload abstract:', e);
        return null;
    }
};

export const uploadPresentationFile = async (abstractId: string, file: File): Promise<string | null> => {
    try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${abstractId}_presentation_${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
            .from('abstracts')
            .upload(fileName, file, { upsert: true });

        if (uploadError) {
            console.error('Storage upload error:', uploadError);
            return null;
        }

        const { data } = supabase.storage.from('abstracts').getPublicUrl(fileName);
        return data.publicUrl;
    } catch (e) {
        console.error('Failed to upload presentation:', e);
        return null;
    }
};

export const getStudentSessionsAndSubmissions = async (studentId: string, program: string) => {
    try {
        const { data: subsData, error: subsError } = await supabase
            .from('submissions')
            .select('*')
            .eq('eventStudentId', studentId)
            .eq('program', program);
            
        if (subsError) throw subsError;
        if (!subsData || subsData.length === 0) return [];
        
        const submissionIds = subsData.map(s => s.id);
        const { data: participantsData, error: partError } = await supabase
            .from('session_participants')
            .select('sessionId, submissionId, attended')
            .in('submissionId', submissionIds);
            
        if (partError) throw partError;
        
        if (!participantsData || participantsData.length === 0) {
            return subsData.map(s => ({ submission: s, session: null }));
        }
        
        const sessionIds = participantsData.map(p => p.sessionId);
        const { data: sessionsData, error: sessError } = await supabase
            .from('sessions')
            .select('*')
            .in('id', sessionIds);
            
        if (sessError) throw sessError;
        
        return subsData.map(s => {
            const participant = participantsData.find(p => p.submissionId === s.id);
            const session = participant ? (sessionsData || []).find(se => se.id === participant.sessionId) : null;
            return {
                submission: s,
                session: session ? {
                    ...session,
                    attended: participant?.attended || false
                } : null
            };
        });
    } catch (err) {
        console.error('Failed to get student sessions and submissions:', err);
        return [];
    }
};

export const getVolunteerAssignments = async (sessionId?: string) => {
    let query = supabase.from('volunteer_assignments').select('*');
    if (sessionId) {
        query = query.eq('sessionId', sessionId);
    }
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
};

export const assignVolunteerToSession = async (memberId: string, sessionId: string) => {
    const { data, error } = await supabase
        .from('volunteer_assignments')
        .upsert({ memberId, sessionId }, { onConflict: 'memberId,sessionId' });
    if (error) throw error;
    return data;
};

export const removeVolunteerFromSession = async (memberId: string, sessionId: string) => {
    const { error } = await supabase
        .from('volunteer_assignments')
        .delete()
        .eq('memberId', memberId)
        .eq('sessionId', sessionId);
    if (error) throw error;
};

