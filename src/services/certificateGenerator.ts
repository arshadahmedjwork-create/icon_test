import { Evaluation, Session, Certificate, Student } from "@/types";
import { addCertificate } from "./supabaseService";

// Mock template URLs
const TEMPLATES = {
    PARTICIPATION: "https://mock-cdn/templates/participation.pdf",
    WINNER: "https://mock-cdn/templates/winner.pdf",
    JUDGE: "https://mock-cdn/templates/judge.pdf"
};

export interface Ranking {
    studentId: string;
    totalScore: number;
    rank: number;
}

export const ResultCalculator = {
    calculateSessionRankings: (evaluations: Evaluation[], session: Session): Ranking[] => {
        // Group by student
        const studentScores: Record<string, number> = {};

        evaluations.forEach(ev => {
            if (!studentScores[ev.studentId]) studentScores[ev.studentId] = 0;
            studentScores[ev.studentId] += ev.totalScore;
        });

        // Convert to array and sort
        // Note: If multiple judges evaluate same student, we average their scores? 
        // SRS doesn't specify average vs sum. Assuming SUM for now, or 1 evaluation per judge per student.
        // If 3 judges, max score is 300.

        const rankings = Object.entries(studentScores)
            .map(([studentId, totalScore]) => ({ studentId, totalScore, rank: 0 }))
            .sort((a, b) => b.totalScore - a.totalScore); // Descending

        // Assign ranks (handle ties?) - SRS silent on ties, simple ranking for now
        rankings.forEach((r, idx) => {
            r.rank = idx + 1;
        });

        return rankings;
    }
};

export const CertificateGenerator = {
    generateForSession: async (session: Session, rankings: Ranking[], students: Student[]) => {
        const generated: Certificate[] = [];
        const now = new Date().toISOString();

        // 1. Winners (Top 3)
        const winners = rankings.filter(r => r.rank <= 3);

        // Use Promise.all for parallel processing
        const winnerPromises = winners.map(async w => {
            const cert: Certificate = {
                id: crypto.randomUUID(),
                userId: w.studentId,
                sessionId: session.id,
                type: "winner",
                rank: w.rank,
                generatedAt: now,
                emailSent: false,
                downloadUrl: `${TEMPLATES.WINNER}?student=${w.studentId}&rank=${w.rank}`
            };
            await addCertificate(cert);
            generated.push(cert);
        });

        await Promise.all(winnerPromises);

        // 2. Participation (All present attendees)
        const attendees = session.attendanceRecords || [];

        const participationPromises = attendees.map(async studentId => {
            const cert: Certificate = {
                id: crypto.randomUUID(),
                userId: studentId,
                sessionId: session.id,
                type: "participation",
                generatedAt: now,
                emailSent: false,
                downloadUrl: `${TEMPLATES.PARTICIPATION}?student=${studentId}`
            };
            await addCertificate(cert);
            generated.push(cert);
        });

        await Promise.all(participationPromises);

        return generated;
    }
};
