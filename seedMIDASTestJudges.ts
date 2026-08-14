import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import bcrypt from 'bcryptjs';

// Manual .env parser
const envPath = path.resolve('.env');
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (match) {
            const key = match[1];
            let value = match[2] || '';
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

async function seedMIDASJudges() {
    console.log("Seeding 2 test judge accounts for MIDAS (Password: 123456)...");

    const program = "MIDAS";
    const plainPassword = "123456";
    const hashedPassword = await bcrypt.hash(plainPassword, 10);

    const judgesToSeed = [
        {
            email: "midasjudge1@example.com",
            name: "Dr. MIDAS Judge One",
            isAcademic: true,
            specialization: "Oral & Maxillofacial Surgery",
            college: "KLE VK Institute of Dental Sciences, Belagavi"
        },
        {
            email: "midasjudge2@example.com",
            name: "Dr. MIDAS Judge Two",
            isAcademic: true,
            specialization: "Orthodontics",
            college: "SDM College of Dental Sciences, Dharwad"
        }
    ];

    for (const j of judgesToSeed) {
        console.log(`Setting up MIDAS judge: ${j.name} (${j.email})...`);
        let { data: existingMember } = await supabase.from('members').select('id').eq('email', j.email).maybeSingle();

        if (!existingMember) {
            const { data: member, error: memberErr } = await supabase.from('members').insert({
                email: j.email,
                password: hashedPassword,
                name: j.name,
                role: "JUDGE",
                isActive: true,
                program,
                mustChangePassword: false
            }).select('id').single();

            if (memberErr) {
                console.error(`Member creation error for ${j.name}:`, memberErr);
                continue;
            }
            existingMember = member;
        } else {
            // Update password and details
            const { error: updateErr } = await supabase.from('members').update({
                password: hashedPassword,
                role: "JUDGE",
                name: j.name,
                program,
                mustChangePassword: false,
                isActive: true
            }).eq('id', existingMember.id);

            if (updateErr) {
                console.error(`Error updating member for ${j.name}:`, updateErr);
            }
        }

        // Upsert judge profile
        const { data: existingJudge } = await supabase.from('judges').select('id').eq('memberId', existingMember.id).maybeSingle();

        if (existingJudge) {
            await supabase.from('judges').update({
                fullName: j.name,
                isAcademic: j.isAcademic,
                specialization: j.specialization,
                college: j.college,
                program
            }).eq('id', existingJudge.id);
            console.log(`Updated judge profile for ${j.name}`);
        } else {
            const { error: judgeErr } = await supabase.from('judges').insert({
                memberId: existingMember.id,
                fullName: j.name,
                isAcademic: j.isAcademic,
                specialization: j.specialization,
                college: j.college,
                program
            });
            if (judgeErr) {
                console.error(`Judge record creation error for ${j.name}:`, judgeErr);
            } else {
                console.log(`Successfully created judge profile for ${j.name}`);
            }
        }
    }

    console.log("Seeding completed successfully!");
}

seedMIDASJudges().catch(err => {
    console.error("Seeding failed:", err);
});
