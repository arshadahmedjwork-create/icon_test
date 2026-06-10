import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

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

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const { data: students, error } = await supabase
        .from('event_students')
        .select('*')
        .like('dciCertificateUrl', '%9384601122_dci_bonafide%')
        .limit(1);

    if (error) {
        console.error(error);
        return;
    }

    if (!students || students.length === 0) {
        console.log("No student found with that PDF URL. Listing last 5 event_students:");
        const { data: lastStudents } = await supabase
            .from('event_students')
            .select('*')
            .order('id', { ascending: false })
            .limit(5);
        console.log(lastStudents);
        return;
    }

    console.log("Student record:", JSON.stringify(students[0], null, 2));
}

run();
