import { Judge, EventConfig, User, Deadline, Registration, Abstract, Session, Evaluation } from "../types";

const STORAGE_KEY = "midas_db";

interface DBSchema {
    judges: Judge[];
    users: User[];
    eventConfig: EventConfig;
    deadlines: Deadline[];
    registrations: Registration[];
    abstracts: Abstract[];
    sessions: Session[];
    evaluations: Evaluation[];
}

const INITIAL_DB: DBSchema = {
    judges: [
        {
            id: "j1",
            name: "Dr. Sarah Lee",
            specialization: "Oral Pathology",
            type: "Academic",
            affiliation: "City Dental College",
            contact: "9876543210",
            email: "sarah.lee@example.com",
            status: "Available",
        },
        {
            id: "j2",
            name: "Dr. James Bond",
            specialization: "Periodontics",
            type: "Non-Academic",
            affiliation: "Private Practice",
            contact: "9988776655",
            email: "james.bond@example.com",
            status: "Available",
        },
    ],
    users: [],
    eventConfig: {
        subjects: [
            "Oral Pathology",
            "Oral Medicine & Radiology",
            "Periodontics",
            "Prosthodontics",
            "Orthodontics",
            "Pedodontics",
            "Oral Surgery",
            "Public Health Dentistry",
            "Conservative Dentistry",
        ],
        presentationTypes: ["Paper Presentation", "Poster Presentation"],
        modes: ["Online", "Offline"],
        capacities: {
            paperOnline: 12,
            paperOffline: 8,
            posterOnline: 15,
            posterOffline: 12,
        },
        criterias: [
            { id: "c1", name: "Content Quality", maxScore: 10, weightage: 30 },
            { id: "c2", name: "Presentation Skills", maxScore: 10, weightage: 30 },
            { id: "c3", name: "Clarity & Organization", maxScore: 10, weightage: 20 },
            { id: "c4", name: "Q&A Response", maxScore: 10, weightage: 20 },
        ],
    },
    deadlines: [
        { id: "d1", name: "Registration Deadline", date: "2026-03-01T23:59:00", description: "Last date for student registration" },
        { id: "d2", name: "Abstract Submission", date: "2026-03-10T23:59:00", description: "Last date for abstracts" },
        { id: "d3", name: "Presentation Upload", date: "2026-03-20T23:59:00", description: "Last date for final files" },
    ],
    registrations: [],
    abstracts: [],
    sessions: [],
    evaluations: [],
};

function getDB(): DBSchema {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_DB));
        return INITIAL_DB;
    }
    return JSON.parse(data);
}

function saveDB(data: DBSchema) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// Judge Operations
export const getJudges = (): Judge[] => {
    return getDB().judges;
};

export const addJudge = (judge: Omit<Judge, "id">): Judge => {
    const db = getDB();
    const newJudge: Judge = { ...judge, id: crypto.randomUUID() };
    db.judges.push(newJudge);
    saveDB(db);
    return newJudge;
};

export const updateJudge = (id: string, updates: Partial<Judge>): Judge | null => {
    const db = getDB();
    const index = db.judges.findIndex((j) => j.id === id);
    if (index === -1) return null;

    db.judges[index] = { ...db.judges[index], ...updates };
    saveDB(db);
    return db.judges[index];
};

export const deleteJudge = (id: string) => {
    const db = getDB();
    db.judges = db.judges.filter((j) => j.id !== id);
    saveDB(db);
};

// Event Config Operations
export const getEventConfig = (): EventConfig => {
    return getDB().eventConfig;
};

export const updateEventConfig = (newConfig: EventConfig) => {
    const db = getDB();
    db.eventConfig = newConfig;
    saveDB(db);
};

// User Operations
export const getUsers = (): User[] => {
    return getDB().users;
};

export const addUser = (user: Omit<User, "id" | "createdAt">): User => {
    const db = getDB();
    const newUser: User = {
        ...user,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString()
    };
    db.users.push(newUser);
    saveDB(db);
    return newUser;
};

export const deleteUser = (id: string) => {
    const db = getDB();
    db.users = db.users.filter((u) => u.id !== id);
    saveDB(db);
};

export const updateUser = (id: string, updates: Partial<User>): User | null => {
    const db = getDB();
    const index = db.users.findIndex((u) => u.id === id);
    if (index !== -1) {
        db.users[index] = { ...db.users[index], ...updates };
        saveDB(db);
        return db.users[index];
    }
    return null;
};

// Deadline Operations
export const getDeadlines = (): Deadline[] => {
    return getDB().deadlines;
};

export const updateDeadline = (id: string, updates: Partial<Deadline>) => {
    const db = getDB();
    const index = db.deadlines.findIndex(d => d.id === id);
    if (index !== -1) {
        db.deadlines[index] = { ...db.deadlines[index], ...updates };
        saveDB(db);
    }
};

// Registration Operations
// NOTE: For Phase 1, we are using User.registrationStatus directly. 
// These helpers are placeholders for a normalized schema later.
export const getRegistrations = (): Registration[] => {
    return getDB().registrations;
};

export const updateRegistrationStatus = (id: string, status: Registration["status"]) => {
    const db = getDB();
    const index = db.registrations.findIndex(r => r.id === id);
    if (index !== -1) {
        db.registrations[index] = { ...db.registrations[index], status };
        saveDB(db);
    }
};

// Abstract Operations
export const getAbstracts = (): Abstract[] => {
    return getDB().abstracts;
};

export const addAbstract = (abstract: Omit<Abstract, "id" | "submittedAt" | "status">): Abstract => {
    const db = getDB();
    const newAbstract: Abstract = {
        ...abstract,
        id: crypto.randomUUID(),
        submittedAt: new Date().toISOString(),
        status: "pending"
    };
    db.abstracts.push(newAbstract);
    saveDB(db);
    return newAbstract;
};

export const updateAbstractStatus = (id: string, status: Abstract["status"], feedback?: string) => {
    const db = getDB();
    const index = db.abstracts.findIndex(a => a.id === id);
    if (index !== -1) {
        db.abstracts[index] = { ...db.abstracts[index], status, feedback };
        saveDB(db);
    }
};

// Session Operations
export const getSessions = (): Session[] => {
    return getDB().sessions;
};

export const addSession = (session: Omit<Session, "id" | "status">): Session => {
    const db = getDB();
    const newSession: Session = {
        ...session,
        id: crypto.randomUUID(),
        status: "scheduled"
    };
    db.sessions.push(newSession);
    saveDB(db);
    return newSession;
};

export const updateSession = (id: string, updates: Partial<Session>) => {
    const db = getDB();
    const index = db.sessions.findIndex(s => s.id === id);
    if (index !== -1) {
        db.sessions[index] = { ...db.sessions[index], ...updates };
        saveDB(db);
    }
};

export const deleteSession = (id: string) => {
    const db = getDB();
    const index = db.sessions.findIndex(s => s.id === id);
    if (index !== -1) {
        db.sessions.splice(index, 1);
        saveDB(db);
    }
};

// Evaluation Operations
export const getEvaluations = (): Evaluation[] => {
    return getDB().evaluations;
};

export const addEvaluation = (evaluation: Omit<Evaluation, "id" | "submittedAt">): Evaluation => {
    const db = getDB();
    const newEvaluation: Evaluation = {
        ...evaluation,
        id: crypto.randomUUID(),
        submittedAt: new Date().toISOString()
    };
    db.evaluations.push(newEvaluation);
    saveDB(db);
    return newEvaluation;
}
