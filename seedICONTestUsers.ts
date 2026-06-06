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
    console.log("Seeding test users for Madras ICON (Program = ICON)...");

    const program = "ICON";
    const plainPassword = "password123";
    const hashedPassword = await bcrypt.hash(plainPassword, 10);

    // 1. Seed two Judges
    const judgesToSeed = [
        {
            email: "iconjudge1@example.com",
            name: "Dr. Alan Turing",
            isAcademic: true,
            specialization: "Orthodontics",
            college: "SRM Dental College"
        },
        {
            email: "iconjudge2@example.com",
            name: "Dr. Grace Hopper",
            isAcademic: false,
            specialization: "Orthodontics",
            college: "Saveetha Dental College"
        }
    ];

    for (const j of judgesToSeed) {
        console.log(`Setting up judge: ${j.name} (${j.email})...`);
        let { data: existingMember } = await supabase.from('members').select('id').eq('email', j.email).maybeSingle();
        
        if (!existingMember) {
            const { data: member, error: memberErr } = await supabase.from('members').insert({
                email: j.email,
                password: hashedPassword,
                name: j.name,
                role: "JUDGE",
                isActive: true,
                program
            }).select('id').single();

            if (memberErr) {
                console.error(`Member creation error for ${j.name}:`, memberErr);
                continue;
            }
            existingMember = member;
        } else {
            // Update password just in case
            await supabase.from('members').update({ password: hashedPassword, role: "JUDGE", program }).eq('id', existingMember.id);
        }

        const { error: judgeErr } = await supabase.from('judges').insert({
            memberId: existingMember.id,
            fullName: j.name,
            isAcademic: j.isAcademic,
            specialization: j.specialization,
            college: j.college,
            program
        });
        
        if (judgeErr && judgeErr.code !== '23505') {
            console.error(`Judge record creation error for ${j.name}:`, judgeErr);
        } else {
            console.log(`Successfully set up judge record for ${j.name}`);
        }
    }

    // 2. Seed one Volunteer
    const volunteerEmail = "iconvolunteer@example.com";
    const volunteerName = "ICON Test Volunteer";
    console.log(`Setting up volunteer: ${volunteerName} (${volunteerEmail})...`);

    let { data: existingVol } = await supabase.from('members').select('id').eq('email', volunteerEmail).maybeSingle();
    
    if (!existingVol) {
        const { error: volErr } = await supabase.from('members').insert({
            email: volunteerEmail,
            password: hashedPassword,
            name: volunteerName,
            role: "VOLUNTEER",
            isActive: true,
            program
        });

        if (volErr) {
            console.error(`Volunteer creation error:`, volErr);
        } else {
            console.log(`Successfully created volunteer: ${volunteerName}`);
        }
    } else {
        await supabase.from('members').update({ password: hashedPassword, role: "VOLUNTEER", program }).eq('id', existingVol.id);
        console.log(`Updated existing volunteer: ${volunteerName}`);
    }

    console.log("\n==============================================");
    console.log(" Madras ICON Test Users Seeded Successfully!");
    console.log("==============================================");
    console.log(` Password for all accounts: ${plainPassword}`);
    console.log(`\n Accounts:`);
    console.log(` - Judge 1: iconjudge1@example.com (Academic - Orthodontics)`);
    console.log(` - Judge 2: iconjudge2@example.com (Non-Academic - Orthodontics)`);
    console.log(` - Volunteer: iconvolunteer@example.com`);
    console.log("==============================================\n");
}

seedData().catch(console.error);
