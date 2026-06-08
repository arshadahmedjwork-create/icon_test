import { supabase } from "@/lib/supabaseClient";

export interface DciVerificationDetails {
  verifiedAt: string;
  ocrTextSnippet?: string;
  hasDciMatch: boolean;
  hasNameMatch: boolean;
  matchedNameParts: string[];
  providedDciNumber: string;
  providedName: string;
  error?: string;
}

export async function verifyDciCertificate(studentId: string): Promise<{ success: boolean; status: 'VERIFIED' | 'FAILED'; details: DciVerificationDetails }> {
  try {
    // 1. Fetch delegate record
    const { data: student, error: fetchError } = await supabase
      .from('event_students')
      .select('*')
      .eq('id', studentId)
      .single();

    if (fetchError || !student) {
      throw new Error(fetchError?.message || 'Delegate not found');
    }

    const { dciNumber, name: participantName, dciCertificateUrl } = student;

    if (!dciCertificateUrl) {
      throw new Error('No DCI Certificate URL found on delegate record');
    }

    // 2. Call OCR.space API (use VITE_OCR_SPACE_API_KEY from env or default 'helloworld')
    // Note: Since this runs client-side, we can read from import.meta.env
    const ocrApiKey = (import.meta.env.VITE_OCR_SPACE_API_KEY) || 'helloworld';
    
    const ocrUrl = `https://api.ocr.space/parse/image`;
    const ocrParams = new URLSearchParams();
    ocrParams.append('apikey', ocrApiKey);
    ocrParams.append('url', dciCertificateUrl);
    ocrParams.append('filetype', dciCertificateUrl.toLowerCase().endsWith('.pdf') ? 'PDF' : 'JPG');
    ocrParams.append('isOverlayRequired', 'false');
    ocrParams.append('OCREngine', '2');

    console.log(`[OCR Client] Sending document to OCR.space: ${dciCertificateUrl}`);

    const ocrResponse = await fetch(ocrUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: ocrParams
    });

    if (!ocrResponse.ok) {
      throw new Error(`OCR.space API responded with status ${ocrResponse.status}`);
    }

    const ocrData = await ocrResponse.json();
    
    if (ocrData.IsErroredOnProcessing) {
      throw new Error(`OCR processing error: ${ocrData.ErrorMessage?.[0] || JSON.stringify(ocrData.ErrorMessage)}`);
    }

    const extractedText = ocrData.ParsedResults?.[0]?.ParsedText || '';
    console.log(`[OCR Client] Extracted text length: ${extractedText.length}`);

    // Verification Logic:
    // 1. Check if the provided DCI number is found in the text
    const normalizedProvidedDci = String(dciNumber || '').trim();
    const hasDciMatch = normalizedProvidedDci.length > 0 && extractedText.includes(normalizedProvidedDci);

    // 2. Check if delegate's name components (longer than 2 characters) match
    const nameComponents = String(participantName || '')
      .toLowerCase()
      .split(/\s+/)
      .filter(part => part.length > 2);
    
    const matchedNameParts = nameComponents.filter(part => extractedText.toLowerCase().includes(part));
    const hasNameMatch = nameComponents.length > 0 && matchedNameParts.length >= Math.min(2, nameComponents.length);

    const isVerified = hasDciMatch && hasNameMatch;
    const verificationStatus = isVerified ? 'VERIFIED' : 'FAILED';

    const verificationDetails: DciVerificationDetails = {
      verifiedAt: new Date().toISOString(),
      ocrTextSnippet: extractedText.substring(0, 1000), // store a snippet for admin review
      hasDciMatch,
      hasNameMatch,
      matchedNameParts,
      providedDciNumber: dciNumber || '',
      providedName: participantName || ''
    };

    // Update delegate record with results
    const { error: updateError } = await supabase
      .from('event_students')
      .update({
        dciVerificationStatus: verificationStatus,
        dciVerificationDetails: verificationDetails
      })
      .eq('id', studentId);

    if (updateError) {
      throw updateError;
    }

    return { success: true, status: verificationStatus, details: verificationDetails };

  } catch (err: any) {
    console.error('[verifyDciCertificate error]', err);
    
    const failedDetails: DciVerificationDetails = {
      verifiedAt: new Date().toISOString(),
      hasDciMatch: false,
      hasNameMatch: false,
      matchedNameParts: [],
      providedDciNumber: '',
      providedName: '',
      error: err.message || 'Unknown error'
    };

    // Mark as FAILED on error
    await supabase
      .from('event_students')
      .update({
        dciVerificationStatus: 'FAILED',
        dciVerificationDetails: failedDetails
      })
      .eq('id', studentId)
      .catch(updateErr => console.error('Failed to update status to FAILED after OCR error:', updateErr));

    return { success: false, status: 'FAILED', details: failedDetails };
  }
}
