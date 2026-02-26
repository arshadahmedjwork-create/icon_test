
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

interface ScheduleResult {
    sessions: Session[];
    unassignedAbstracts: Abstract[];
    warnings: string[];
}

/**
 * MIDAS Auto-Scheduler Service
 * Automates session creation based on abstract grouping and judge availability.
 * Enforces:
 * 1. SRS Capacity Rules (10-12 Online, 8 Offline)
 * 2. Judge Composition (1 Academic + 2 Non-Academic)
 * 3. Conflict of Interest (Academic Judge College !== Student College)
 */
export class AutoScheduler {
    private abstracts: Abstract[];
    private judges: Judge[];
    private config: EventConfig;
    private warnings: string[] = [];

    constructor({ abstracts, judges, config }: SchedulerConfig) {
        this.abstracts = abstracts.filter(a => a.status === "approved" || a.status === "completed" as any);
        this.judges = judges.filter(j => j.status === "Available");
        this.config = config;
    }

    public generateSchedule(): ScheduleResult {
        const sessions: Session[] = [];
        const unassigned: Abstract[] = [];

        // 1. Group by Subject + Mode + Type
        const groups = this.groupAbstracts();

        // 2. Process each group
        for (const [groupKey, groupAbstracts] of Object.entries(groups)) {
            const { subject, mode, type } = this.parseGroupKey(groupKey);
            const capacity = this.getCapacity(mode, type);

            // 3. Chunk into sessions
            for (let i = 0; i < groupAbstracts.length; i += capacity) {
                const chunk = groupAbstracts.slice(i, i + capacity);

                // 4. Assign Judges
                try {
                    const assignedJudges = this.assignJudges(subject, chunk);

                    // 5. Create Session
                    const session: Session = {
                        id: crypto.randomUUID(),
                        name: `${subject} - ${type} (${mode}) - Session ${Math.floor(i / capacity) + 1}`,
                        subject,
                        type,
                        mode,
                        date: new Date().toISOString().split('T')[0], // Default to today, user edits later
                        time: "09:00",
                        venue: mode === "Online" ? "Zoom Link TBD" : "Hall TBD",
                        judges: assignedJudges.map(j => j.id),
                        abstractIds: chunk.map(a => a.id),
                        status: "scheduled"
                    };
                    sessions.push(session);
                } catch (error: any) {
                    this.warnings.push(`Could not schedule ${chunk.length} abstracts for ${subject} (${type}): ${error.message}`);
                    unassigned.push(...chunk);
                }
            }
        }

        return { sessions, unassignedAbstracts: unassigned, warnings: this.warnings };
    }

    private groupAbstracts(): Record<string, Abstract[]> {
        const groups: Record<string, Abstract[]> = {};
        for (const abs of this.abstracts) {
            const key = `${abs.subject}|${abs.mode}|${abs.type}`;
            if (!groups[key]) groups[key] = [];
            groups[key].push(abs);
        }
        return groups;
    }

    private parseGroupKey(key: string) {
        const [subject, mode, type] = key.split('|');
        return { subject, mode, type };
    }

    private getCapacity(mode: string, type: string): number {
        // Map loose SRS strings to config keys
        if (type.includes("Paper")) {
            return mode === "Online" ? this.config.capacities.paperOnline : this.config.capacities.paperOffline;
        }
        if (type.includes("Poster")) {
            return mode === "Online" ? this.config.capacities.posterOnline : this.config.capacities.posterOffline;
        }
        return 10; // Default fallback
    }

    private assignJudges(subject: string, abstracts: Abstract[]): Judge[] {
        // Filter by Subject
        const eligibleJudges = this.judges.filter(j => j.specialization === subject);

        const academicJudges = eligibleJudges.filter(j => j.type === "Academic");
        const nonAcademicJudges = eligibleJudges.filter(j => j.type === "Non-Academic");

        // Requirement: 1 Academic
        let selectedAcademic: Judge | null = null;

        // Conflict Check: Academic Judge College != ANY Student College in chunk
        const studentColleges = new Set(abstracts.map(a => a.college));

        for (const judge of academicJudges) {
            // If judge has no college (e.g. private practice/standalone), they are safe.
            // If judge has college, check if it's in student set.
            // also ensure judge has college field if it is Academic
            const judgeCollege = judge.college || "";
            if (!judgeCollege || !studentColleges.has(judgeCollege)) {
                selectedAcademic = judge;
                break;
            }
        }

        if (!selectedAcademic) {
            throw new Error(`No non-conflicting Academic Judge available for ${subject}. Needs to avoid: ${Array.from(studentColleges).join(', ')}`);
        }

        // Requirement: 2 Non-Academic
        if (nonAcademicJudges.length < 2) {
            // For prototype, if we run out of mock judges, we might want to warn instead of fail to show the UI working.
            // But SRS is strict.
            throw new Error("Insufficient Non-Academic Judges.");
        }

        // Simple pick first 2 for now (could add randomization later)
        const selectedNonAcademic = nonAcademicJudges.slice(0, 2);

        return [selectedAcademic, ...selectedNonAcademic];
    }
}
