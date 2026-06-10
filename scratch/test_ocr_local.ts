import { createClient } from '@supabase/supabase-js';
import { verifyDciCertificate } from '../src/services/dciService';
import * as fs from 'fs';
import * as path from 'path';

// Parse .env
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

// Set up mock window/env variables so dciService can run under node
(global as any).import = {
  meta: {
    env: {
      VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL,
      VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY,
      VITE_OCR_SPACE_API_KEY: process.env.VITE_OCR_SPACE_API_KEY || 'helloworld'
    }
  }
};

async function test() {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("Searching for a delegate with DCI Certificate to test...");
    const { data: students, error } = await supabase
        .from('event_students')
        .select('*')
        .not('dciCertificateUrl', 'is', null)
        .limit(1);

    if (error) {
        console.error("Error fetching students:", error);
        return;
    }

    if (!students || students.length === 0) {
        console.log("No delegates with DCI Certificate URL found in event_students table.");
        console.log("Please register a delegate with a DCI Certificate first or run the SQL migration to create the table structure.");
        return;
    }

    const student = students[0];
    console.log(`Found delegate: ${student.name} (ID: ${student.id})`);
    console.log(`DCI Number: ${student.dciNumber}`);
    console.log(`DCI Certificate: ${student.dciCertificateUrl}`);

    console.log("\nRunning OCR verification...");
    const result = await verifyDciCertificate(student.id);
    console.log("\nOCR Verification Result:", JSON.stringify(result, null, 2));
}

test().catch(console.error);
