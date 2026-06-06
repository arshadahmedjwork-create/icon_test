import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Manual .env parser
const envPath = path.resolve('.env');
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (match) {
            const key = match[1];
            let value = match[2] || '';
            if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
            else if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
            process.env[key] = value;
        }
    });
}

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function seedEvaluations() {
    console.log("Seeding evaluations for auto-scheduled sessions...");
    const program = "MIDAS";

    // 1. Get all scheduled sessions
    const { data: sessions, error: sessionsErr } = await supabase
        .from('sessions')
        .select('*, session_judges(judgeId), session_participants(submissionId)')
        .eq('status', 'SCHEDULED')
        .eq('program', program);

    if (sessionsErr || !sessions) {
        console.error("Failed to fetch sessions:", sessionsErr);
        return;
    }

    if (sessions.length === 0) {
        console.log("No scheduled sessions found. Did you run the Auto-Scheduler from the UI?");
        return;
    }

    // 2. Fetch global criteria fallback
    let globalCriteria: any[] = [];
    const { data: config } = await supabase.from('event_config').select('*').single();
    if (config) {
        const { data: crit } = await supabase.from('evaluation_criteria').select('*');
        if (crit) globalCriteria = crit;
    }

    // fallback standard criteria if db is empty
    if (globalCriteria.length === 0) {
        globalCriteria = [
            { id: crypto.randomUUID(), name: 'Scientific Content', maxScore: 10, weightage: 40 },
            { id: crypto.randomUUID(), name: 'Presentation / Delivery', maxScore: 10, weightage: 30 },
            { id: crypto.randomUUID(), name: 'Innovation & Impact', maxScore: 10, weightage: 30 }
        ];
    }

    let evalCount = 0;

    // 3. For each session, for each judge, for each participant, generate an evaluation
    for (const session of sessions) {
        let activeCriterias = session.criterias || [];
        if (activeCriterias.length === 0) activeCriterias = globalCriteria;

        const judgeIds = session.session_judges?.map((j: any) => j.judgeId) || [];
        const submissionIds = session.session_participants?.map((p: any) => p.submissionId) || [];

        // Need studentId for evaluation. Fetch submissions to map to studentId
        if (submissionIds.length > 0 && judgeIds.length > 0) {
            const { data: submissions } = await supabase.from('submissions').select('id, eventStudentId').in('id', submissionIds);
            
            if (submissions) {
                for (const judgeId of judgeIds) {
                    for (const sub of submissions) {
                        const studentId = sub.eventStudentId;
                        if (!studentId) continue;

                        const scores: Record<string, number> = {};
                        let totalScore = 0;

                        for (const crit of activeCriterias) {
                            // random score between maxScore / 2 and maxScore
                            const max = crit.maxScore || 10;
                            const score = Math.floor(Math.random() * (max / 2)) + (max / 2);
                            scores[crit.id] = score;
                            totalScore += score;
                        }

                        // Upsert evaluation
                        const { error: evalErr } = await supabase.from('evaluations').upsert({
                            session_id: session.id,
                            judge_id: judgeId,
                            student_id: studentId,
                            scores: scores,
                            total_score: totalScore,
                            feedback: "Good presentation",
                            program
                        }, { onConflict: 'session_id,judge_id,student_id' });

                        if (!evalErr) evalCount++;
                        else console.error("Eval Error:", evalErr);
                    }
                }
            }
        }
        
        // Mark session as evaluating so the system thinks they actually presented and got evaluated
        // Actually we can keep it SCHEDULED so the user can click "Finalize" which expects it to be scheduled or evaluating
    }

    console.log(`Successfully generated ${evalCount} dummy evaluations across ${sessions.length} sessions.`);
    console.log("You can now click 'Finalize Results' on the Core Team Session Management page.");
}

seedEvaluations().catch(console.error);
