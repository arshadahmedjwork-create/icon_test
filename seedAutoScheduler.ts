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
            // remove quotes if any
            if (value.startsWith('"') && value.endsWith('"')) {
                value = value.slice(1, -1);
            } else if (value.startsWith("'") && value.endsWith("'")) {
                value = value.slice(1, -1);
            }
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

async function seedData() {
    console.log("Seeding data for Auto-Scheduler...");

    const program = "MIDAS";

    // 1. Create Event
    const { data: event, error: eventErr } = await supabase.from('event_master').insert({
        name: "Oral Pathology",
        type: "PAPER",
        mode: "OFFLINE",
        capacity: 10,
        assessment_criteria: [],
        rules: "None",
        judge_instructions: "None",
        program
    }).select('id').single();

    if (eventErr && eventErr.code !== '23505') {
        console.error("Event error:", eventErr);
    } else {
        console.log("Created event (or it exists).");
    }

    // 2. Create 3 Judges
    for (let i = 1; i <= 3; i++) {
        const email = `dummyjudge${i}@example.com`;
        let { data: existingMember } = await supabase.from('members').select('id').eq('email', email).maybeSingle();
        
        if (!existingMember) {
            const { data: member, error: memberErr } = await supabase.from('members').insert({
                email,
                password: "hashedpassword",
                name: `Dummy Judge ${i}`,
                role: "JUDGE",
                isActive: true
            }).select('id').single();

            if (memberErr) {
                console.error("Member err:", memberErr);
                continue;
            }
            existingMember = member;
        }

        const { error: judgeErr } = await supabase.from('judges').insert({
            memberId: existingMember.id,
            fullName: `Dummy Judge ${i}`,
            isAcademic: i === 1,
            specialization: "Oral Pathology",
            college: "Some College",
            program
        });
        
        if (judgeErr && judgeErr.code !== '23505') {
             console.error("Judge err:", judgeErr);
        }
    }

    console.log("Created 3 judges");

    // 3. Create 20 Students and Abstracts
    for (let i = 1; i <= 20; i++) {
        const studentId = crypto.randomUUID();
        const { error: stuErr } = await supabase.from('event_students').insert({
            id: studentId,
            participantName: `Dummy Student ${i}`,
            email: `student${i}@example.com`,
            mobile: `99999999${i < 10 ? '0'+i : i}`,
            course: "BDS",
            year: "1",
            college: i % 2 === 0 ? "College A" : "College B",
            program,
            paymentStatus: "PAID",
            approvalStatus: "APPROVED"
        });

        if (stuErr) {
            console.error("Student err:", stuErr);
            continue;
        }

        await supabase.from('submissions').insert({
            eventStudentId: studentId,
            title: `Dummy Abstract ${i}`,
            subject: "Oral Pathology",
            eventType: "PAPER",
            eventMode: "OFFLINE",
            status: "APPROVED",
            program
        });
    }

    console.log("Created 20 students and abstracts");
    console.log("Done");
}

seedData().catch(console.error);
