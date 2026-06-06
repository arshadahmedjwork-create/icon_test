import {
    Session,
    Abstract,
    Judge,
    EventConfig,
    Program
} from "@/types";

interface SchedulerConfig {
    abstracts: Abstract[];
    judges: Judge[];
    config: EventConfig;
    events: any[];
    program: Program;
    customCapacity?: number;
}

export interface ScheduleResult {
    sessions: Session[];
    unassignedAbstracts: Abstract[];
    warnings: string[];
}

/**
 * MIDAS & ICON Auto-Scheduler Service
 * Automates session creation based on abstract grouping and judge availability.
 * Enforces:
 * 1. SRS Capacity Rules (varies by Mode/Type)
 * 2. Max 2 students per college per session
 * 3. Judge Composition (1 Academic + 1 Non-Academic)
 * 4. Conflict of Interest (Judge College !== ANY Student College in the session)
 */
export class AutoScheduler {
    private abstracts: Abstract[];
    private judges: Judge[];
    private config: EventConfig;
    private events: any[];
        private program: Program;
    private customCapacity?: number;
    private warnings: string[] = [];

    constructor({ abstracts, judges, config, events, program, customCapacity }: SchedulerConfig) {
        this.program = program;
        this.customCapacity = customCapacity;
        // Only accept approved abstracts for the current program
        this.abstracts = abstracts.filter(a => 
            (a.status === "approved" || a.status === "completed" as any) && 
            a.program === program
        );
        // Only accept judges for the current program
        this.judges = judges.filter(j => j.status === "Available" && j.program === program);
        this.config = config;
        this.events = events;
    }

    public generateSchedule(targetMode: "Online" | "Offline"): ScheduleResult {
        // Enforce ICON is Offline only for now
        if (this.program === 'ICON' && targetMode === 'Online') {
            this.warnings.push(`Madras ICON is currently OFFLINE only. Online scheduling is disabled.`);
            return { sessions: [], unassignedAbstracts: [], warnings: this.warnings };
        }

        const generatedSessions: Session[] = [];
        const unassigned: Abstract[] = [];
        const modeAbstracts = this.abstracts.filter(a => a.mode.toLowerCase() === targetMode.toLowerCase());

        // 2. Group by Subject + Type (Mode is already filtered)
        const groups = this.groupAbstracts(modeAbstracts);

        // 3. Process each group (Subject + Type + DelegateType)
        for (const [groupKey, groupAbstracts] of Object.entries(groups)) {
            const { subject, type, delegateType } = this.parseGroupKey(groupKey);
            const capacity = this.getCapacity(targetMode, type);

            // 4. Distribute into session buckets enforcing College limits
            const buckets = this.createBuckets(groupAbstracts, capacity);

            // 5. Assign Judges & Create Sessions
            buckets.forEach((bucket, index) => {
                try {
                    const assignedJudges = this.assignJudges(subject, bucket);
                    const delegateLabel = delegateType && delegateType !== 'UG' ? ` (${delegateType})` : '';

                    const session: Session = {
                        id: crypto.randomUUID(),
                        name: `${subject} - ${type}${delegateLabel} (${targetMode}) - Session ${index + 1}`,
                        subject,
                        type,
                        mode: targetMode,
                        date: new Date().toISOString().split('T')[0], // Default to today
                        time: "09:00",
                        venue: targetMode === "Online" ? "Zoom Link TBD" : "Hall TBD",
                        judges: assignedJudges.map(j => j.id),
                        abstractIds: bucket.map(a => a.id),
                        eventId: this.events.find(e => e.name === subject && e.type === type && e.mode === targetMode)?.id,
                        status: "scheduled",
                        program: this.program
                    };

                    // Attach names for the preview UI (we will strip this before saving)
                    (session as any)._previewJudges = assignedJudges;
                    // Provide the full student name instead of just the college
                    (session as any)._previewStudentNames = bucket.map(a => {
                        const s = this.abstracts.find(abs => abs.id === a.id);
                        return {
                            id: a.studentId,
                            name: (s as any)?._studentName || 'Unknown',
                            college: a.college || 'Unknown'
                        };
                    });

                    generatedSessions.push(session);
                } catch (error: any) {
                    this.warnings.push(`Session ${index + 1} for ${subject} (${type}): ${error.message}`);
                    unassigned.push(...bucket);
                }
            });
        }

        return { sessions: generatedSessions, unassignedAbstracts: unassigned, warnings: this.warnings };
    }

    private groupAbstracts(abstracts: Abstract[]): Record<string, Abstract[]> {
        const groups: Record<string, Abstract[]> = {};
        for (const abs of abstracts) {
            const delegateType = (abs as any).delegateType || 'UG';
            const key = `${abs.subject}|${abs.type}|${delegateType}`; // Mode is uniform for the run
            if (!groups[key]) groups[key] = [];
            groups[key].push(abs);
        }
        return groups;
    }

    private parseGroupKey(key: string) {
        const [subject, type, delegateType] = key.split('|');
        return { subject, type, delegateType };
    }

    private getCapacity(mode: string, type: string): number {
        if (this.customCapacity) {
            return this.customCapacity;
        }
        if (this.program === 'ICON') {
            return 4; // Max 4 delegates per session for ICON
        }
        // Mappings based on MIDAS requirements
        // Type: Paper -> online: 12, offline: 8
        // Type: Poster -> online: 15, offline: 12
        const isPaper = type.toLowerCase().includes("paper");
        const isOnline = mode.toLowerCase() === "online";

        if (isPaper) {
            return isOnline ? (this.config.capacities?.paperOnline || 12) : (this.config.capacities?.paperOffline || 8);
        } else {
            return isOnline ? (this.config.capacities?.posterOnline || 15) : (this.config.capacities?.posterOffline || 12);
        }
    }

    /**
     * Distributes abstracts into buckets.
     * Enforces MAX 2 students from the same college in a single bucket.
     */
    private createBuckets(abstracts: Abstract[], capacity: number): Abstract[][] {
        const buckets: Abstract[][] = [];

        for (const abstract of abstracts) {
            let placed = false;

            for (const bucket of buckets) {
                if (bucket.length >= capacity) continue; // Bucket is full

                // Count how many from this college are already in the bucket
                const collegeQuery = abstract.college || 'Unknown';
                const collegeCount = bucket.filter(a => (a.college || 'Unknown') === collegeQuery).length;

                if (collegeCount < 2) {
                    bucket.push(abstract);
                    placed = true;
                    break;
                }
            }

            // If it couldn't be placed in any existing bucket, create a new one
            if (!placed) {
                buckets.push([abstract]);
            }
        }

        return buckets;
    }

    /**
     * Assigns exactly 1 Academic Judge and 1 Non-Academic judge.
     * Enforces Conflict of Interest: Judge college != ANY student college in the bucket.
     */
    private assignJudges(subject: string, bucket: Abstract[]): Judge[] {
        // Collect all student colleges in the bucket to check for conflicts
        const studentColleges = new Set(bucket.map(a => a.college || 'Unknown').filter(c => c !== 'Unknown'));

        // Strictly filter judges by Subject/Specialization
        const eligibleJudges = this.judges.filter(j => j.specialization === subject);

        // Helper to check conflict
        const hasConflict = (judge: Judge) => {
            if (!judge.affiliation && !judge.college) return false; // Independent/private judge
            return studentColleges.has(judge.college || judge.affiliation || '');
        };

        const academicCandidates = eligibleJudges.filter(j => j.type === "Academic" && !hasConflict(j));
        const nonAcademicCandidates = eligibleJudges.filter(j => j.type === "Non-Academic" && !hasConflict(j));

        const assigned: Judge[] = [];

        if (academicCandidates.length < 1) {
            this.warnings.push(`Insufficient Academic Judges for ${subject} without college conflicts (${Array.from(studentColleges).join(', ')}). Session created without one.`);
        } else {
            assigned.push(academicCandidates[0]);
        }

        if (nonAcademicCandidates.length < 1) {
            this.warnings.push(`Insufficient Non-Academic Judges for ${subject} without college conflicts. Found: ${nonAcademicCandidates.length}, Needed: 1.`);
        } else {
            assigned.push(nonAcademicCandidates[0]);
        }

        return assigned;
    }
}
