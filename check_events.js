import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://fzxtxumrmhudvzhxvawa.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6eHR4dW1ybWh1ZHZ6aHh2YXdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzOTQwNTIsImV4cCI6MjA4Njk3MDA1Mn0.3lOp1uIgf05t46eMM6qa652iK7HnwVKmdabuXmrRp8c";
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const { data: events, error: err } = await supabase.from('event_master').select('*');
    console.log("EVENTS IN DB:", events);
    if (err) console.error(err);
}
check();
