const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://fzxtxumrmhudvzhxvawa.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6eHR4dW1ybWh1ZHZ6aHh2YXdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzOTQwNTIsImV4cCI6MjA4Njk3MDA1Mn0.3lOp1uIgf05t46eMM6qa652iK7HnwVKmdabuXmrRp8c';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const studentId = 'b149477b-435e-4a1d-b6e6-86988051c490';
  
  // Delete existing
  const { error: delError } = await supabase.from('certificates').delete().eq('eventStudentId', studentId);
  if (delError) {
    console.error("Error deleting old certificates:", delError);
    return;
  }
  console.log("Successfully deleted old certificates.");

  const certsToInsert = [
    {
      id: 'f6cba4ea-f6fb-4815-a2de-f7854ccf0b8f',
      eventStudentId: studentId,
      eventId: '5f8bfdb8-d755-40c5-8615-e9c02d29c5ae',
      certificateType: 'WINNER',
      participated: true,
      program: 'MIDAS',
      user_id: studentId,
      session_id: '5f8bfdb8-d755-40c5-8615-e9c02d29c5ae',
      role: 'winner',
      email_sent: false,
      rank: 1
    },
    {
      id: 'd2cba4ea-f6fb-4815-a2de-f7854ccf0b8f',
      eventStudentId: studentId,
      eventId: '1f8bfdb8-d755-40c5-8615-e9c02d29c5ae',
      certificateType: 'WINNER',
      participated: true,
      program: 'MIDAS',
      user_id: studentId,
      session_id: '1f8bfdb8-d755-40c5-8615-e9c02d29c5ae',
      role: 'winner',
      email_sent: false,
      rank: 2
    },
    {
      id: 'e3cba4ea-f6fb-4815-a2de-f7854ccf0b8f',
      eventStudentId: studentId,
      eventId: '2f8bfdb8-d755-40c5-8615-e9c02d29c5ae',
      certificateType: 'WINNER',
      participated: true,
      program: 'MIDAS',
      user_id: studentId,
      session_id: '2f8bfdb8-d755-40c5-8615-e9c02d29c5ae',
      role: 'winner',
      email_sent: false,
      rank: 3
    },
    {
      id: '861350af-6c48-4c5d-8921-cbdcdd83ecf9',
      eventStudentId: studentId,
      eventId: '3f8bfdb8-d755-40c5-8615-e9c02d29c5ae',
      certificateType: 'PARTICIPATION',
      participated: true,
      program: 'MIDAS',
      user_id: studentId,
      session_id: '3f8bfdb8-d755-40c5-8615-e9c02d29c5ae',
      role: 'participation',
      email_sent: false,
      rank: null
    }
  ];

  const { error: insError } = await supabase.from('certificates').insert(certsToInsert);
  if (insError) {
    console.error("Error inserting certificates:", insError);
  } else {
    console.log("Successfully inserted test certificates.");
  }
}

run();
