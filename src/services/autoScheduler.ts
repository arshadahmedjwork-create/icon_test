import {
    Session,
    Abstract,
    Judge,
    EventConfig
} from "@/types";

interface SchedulerConfig {
    abstracts: Abstract[];
    judges: Judge[];
    config: EventConfig;
}

export interface ScheduleResult {
    sessions: Session[];
    unassignedAbstracts: Abstract[];
    warnings: string[];
}

/**
 * MIDAS Auto-Scheduler Service
 * Automates session creation based on abstract grouping and judge availability.
 * Enforces:
 * 1. SRS Capacity Rules (varies by Mode/Type)
 * 2. Max 2 students per college per session
 * 3. Judge Composition (1 Academic + 2 Non-Academic)
 * 4. Conflict of Interest (Judge College !== ANY Student College in the session)
 */
export class AutoScheduler {
    private abstracts: Abstract[];
    private judges: Judge[];
    private config: EventConfig;
    private warnings: string[] = [];

    constructor({ abstracts, judges, config }: SchedulerConfig) {
        // Only accept approved abstracts
        this.abstracts = abstracts.filter(a => a.status === "approved" || a.status === "completed" as any);
        this.judges = judges.filter(j => j.status === "Available");
        this.config = config;
    }

    public generateSchedule(targetMode: "Online" | "Offline"): ScheduleResult {
        const generatedSessions: Session[] = [];
        const unassigned: Abstract[] = [];

        // 1. Filter by Target Mode
        const modeAbstracts = this.abstracts.filter(a => a.mode.toLowerCase() === targetMode.toLowerCase());

        if (modeAbstracts.length === 0) {
            this.warnings.push(`No approved ${targetMode} abstracts found to schedule.`);
            return { sessions: [], unassignedAbstracts: [], warnings: this.warnings };
        }

        // 2. Group by Subject + Type (Mode is already filtered)
        const groups = this.groupAbstracts(modeAbstracts);

        // 3. Process each group (Subject + Type)
        for (const [groupKey, groupAbstracts] of Object.entries(groups)) {
            const { subject, type } = this.parseGroupKey(groupKey);
            const capacity = this.getCapacity(targetMode, type);

            // 4. Distribute into session buckets enforcing College limits
            const buckets = this.createBuckets(groupAbstracts, capacity);

            // 5. Assign Judges & Create Sessions
            buckets.forEach((bucket, index) => {
                try {
                    const assignedJudges = this.assignJudges(subject, bucket);

                    const session: Session = {
                        id: crypto.randomUUID(),
                        name: `${subject} - ${type} (${targetMode}) - Session ${index + 1}`,
                        subject,
                        type,
                        mode: targetMode,
                        date: new Date().toISOString().split('T')[0], // Default to today
                        time: "09:00",
                        venue: targetMode === "Online" ? "Zoom Link TBD" : "Hall TBD",
                        judges: assignedJudges.map(j => j.id),
                        abstractIds: bucket.map(a => a.id),
                        status: "scheduled"
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
            const key = `${abs.subject}|${abs.type}`; // Mode is uniform for the run
            if (!groups[key]) groups[key] = [];
            groups[key].push(abs);
        }
        return groups;
    }

    private parseGroupKey(key: string) {
        const [subject, type] = key.split('|');
        return { subject, type };
    }

    private getCapacity(mode: string, type: string): number {
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
     * Assigns exactly 1 Academic Judge and 2 Non-Academic judges.
     * Enforces Conflict of Interest: Judge college != ANY student college in the bucket.
     */
    private assignJudges(subject: string, bucket: Abstract[]): Judge[] {
        // Collect all student colleges in the bucket to check for conflicts
        const studentColleges = new Set(bucket.map(a => a.college || 'Unknown').filter(c => c !== 'Unknown'));

        // Filter by Subject/Specialization first for academic
        const eligibleJudges = this.judges.filter(j => j.specialization === subject);

        // Helper to check conflict
        const hasConflict = (judge: Judge) => {
            if (!judge.affiliation && !judge.college) return false; // Independent/private judge
            return studentColleges.has(judge.college || judge.affiliation || '');
        };

        const academicCandidates = eligibleJudges.filter(j => j.type === "Academic" && !hasConflict(j));

        // Find Non-Academic: prefer specialization match, but fallback to any without conflict
        let nonAcademicCandidates = eligibleJudges.filter(j => j.type === "Non-Academic" && !hasConflict(j));
        if (nonAcademicCandidates.length < 2) {
            const fallbackNonAcademic = this.judges.filter(j =>
                j.type === "Non-Academic" &&
                !hasConflict(j) &&
                !nonAcademicCandidates.some(c => c.id === j.id)
            );
            nonAcademicCandidates = [...nonAcademicCandidates, ...fallbackNonAcademic];
        }

        const assigned: Judge[] = [];

        if (academicCandidates.length < 1) {
            this.warnings.push(`Insufficient Academic Judges for ${subject} without college conflicts (${Array.from(studentColleges).join(', ')}). Session created without one.`);
        } else {
            assigned.push(academicCandidates[0]);
        }

        if (nonAcademicCandidates.length < 2) {
            this.warnings.push(`Insufficient Non-Academic Judges for ${subject} without college conflicts. Found: ${nonAcademicCandidates.length}, Needed: 2.`);
            assigned.push(...nonAcademicCandidates);
        } else {
            assigned.push(nonAcademicCandidates[0], nonAcademicCandidates[1]);
        }

        return assigned;
    }
}
