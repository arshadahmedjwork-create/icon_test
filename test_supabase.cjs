const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://fzxtxumrmhudvzhxvawa.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6eHR4dW1ybWh1ZHZ6aHh2YXdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzOTQwNTIsImV4cCI6MjA4Njk3MDA1Mn0.3lOp1uIgf05t46eMM6qa652iK7HnwVKmdabuXmrRp8c';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: logs, error } = await supabase.from('system_logs').select('*');
  console.log("SYSTEM LOGS IN DB:", logs);
  if (error) console.error("Error fetching system logs:", error);
}

run();
