import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { studentId } = await req.json()
    if (!studentId) {
      throw new Error('studentId is required')
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Fetch delegate record
    const { data: student, error: fetchError } = await supabase
      .from('event_students')
      .select('*')
      .eq('id', studentId)
      .single()

    if (fetchError || !student) {
      throw new Error(fetchError?.message || 'Delegate not found')
    }

    const { dciNumber, participantName, dciCertificateUrl } = student

    if (!dciCertificateUrl) {
      return new Response(
        JSON.stringify({ success: false, error: 'No DCI Certificate URL found on delegate record' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Call OCR.space API (uses free API key 'helloworld' as default)
    const ocrApiKey = Deno.env.get('OCR_SPACE_API_KEY') || 'helloworld'
    
    // We pass the public URL of the certificate directly to OCR.space
    const ocrUrl = `https://api.ocr.space/parse/image`
    const ocrParams = new URLSearchParams()
    ocrParams.append('apikey', ocrApiKey)
    ocrParams.append('url', dciCertificateUrl)
    ocrParams.append('filetype', dciCertificateUrl.toLowerCase().endsWith('.pdf') ? 'PDF' : 'JPG')
    ocrParams.append('isOverlayRequired', 'false')
    ocrParams.append('OCREngine', '2')

    console.log(`[OCR] Sending document to OCR.space: ${dciCertificateUrl}`)

    const ocrResponse = await fetch(ocrUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: ocrParams
    })

    if (!ocrResponse.ok) {
      throw new Error(`OCR.space API responded with status ${ocrResponse.status}`)
    }

    const ocrData = await ocrResponse.json()
    
    if (ocrData.IsErroredOnProcessing) {
      throw new Error(`OCR processing error: ${JSON.stringify(ocrData.ErrorMessage)}`)
    }

    const extractedText = ocrData.ParsedResults?.[0]?.ParsedText || ''
    console.log(`[OCR] Extracted text length: ${extractedText.length}`)

    // Verification Logic:
    // 1. Check if the provided DCI number is found in the text
    const normalizedProvidedDci = String(dciNumber || '').trim()
    const hasDciMatch = normalizedProvidedDci.length > 0 && extractedText.includes(normalizedProvidedDci)

    // 2. Check if delegate's name components (longer than 2 characters) match
    const nameComponents = String(participantName || '')
      .toLowerCase()
      .split(/\s+/)
      .filter(part => part.length > 2)
    
    const matchedNameParts = nameComponents.filter(part => extractedText.toLowerCase().includes(part))
    const hasNameMatch = nameComponents.length > 0 && matchedNameParts.length >= Math.min(2, nameComponents.length)

    const isVerified = hasDciMatch && hasNameMatch
    const verificationStatus = isVerified ? 'VERIFIED' : 'FAILED'

    const verificationDetails = {
      verifiedAt: new Date().toISOString(),
      ocrTextSnippet: extractedText.substring(0, 1000), // store a snippet for admin review
      hasDciMatch,
      hasNameMatch,
      matchedNameParts,
      providedDciNumber: dciNumber,
      providedName: participantName
    }

    // Update delegate record with results
    const { error: updateError } = await supabase
      .from('event_students')
      .update({
        dciVerificationStatus: verificationStatus,
        dciVerificationDetails: verificationDetails
      })
      .eq('id', studentId)

    if (updateError) {
      throw updateError
    }

    return new Response(
      JSON.stringify({ success: true, status: verificationStatus, details: verificationDetails }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (err) {
    console.error('[verify-dci error]', err)
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
