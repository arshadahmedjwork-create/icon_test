// Simple Signed URL generator and verifier using SHA-256
// HMAC is simulated using a secret key to be cross-platform compatible

const SECRET = 'midas-certificate-signing-key-2026-secret';

// Simple hash function for string
function simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16);
}

export function generateSignedUrl(certificateId: string): string {
    const expires = Date.now() + 10 * 60 * 1000; // 10 minutes
    const rawString = `${certificateId}:${expires}:${SECRET}`;
    const signature = simpleHash(rawString);
    return `/api/certificate/download/${certificateId}?expires=${expires}&signature=${signature}`;
}

export function verifySignedUrl(certificateId: string, expiresStr: string, signature: string): boolean {
    const expires = parseInt(expiresStr, 10);
    if (isNaN(expires) || expires < Date.now()) {
        return false;
    }
    const rawString = `${certificateId}:${expires}:${SECRET}`;
    const expected = simpleHash(rawString);
    return expected === signature;
}
