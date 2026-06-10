import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// This script can be run using Deno: deno run --allow-net --allow-env scratch/test-ocr.ts
const supabaseUrl = Deno.env.get('SUPABASE_URL') || 'https://your-project.supabase.co'
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || 'your-service-role-key'
const supabase = createClient(supabaseUrl, supabaseKey)

async function testOCR(studentId: string) {
  console.log(`[Test] Calling verify-dci for student ${studentId}...`)
  
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/verify-dci`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`
      },
      body: JSON.stringify({ studentId })
    })
    
    const data = await response.json()
    console.log('[Test] OCR Response:', JSON.stringify(data, null, 2))
  } catch (err) {
    console.error('[Test] OCR Request failed:', err)
  }
}

// Replace with a valid student ID to run manual testing
const studentId = 'some-uuid-here'
if (studentId !== 'some-uuid-here') {
  testOCR(studentId)
} else {
  console.log('[Test] Please set a valid studentId in the script to test the OCR function.')
}
