import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

if (!ENCRYPTION_KEY) {
  throw new Error('ENCRYPTION_KEY environment variable is required');
}

// Validate key is 64 hex characters (256 bits)
if (!/^[a-fA-F0-9]{64}$/.test(ENCRYPTION_KEY)) {
  throw new Error('ENCRYPTION_KEY must be a 64-character hex string (256 bits)');
}

const key = Buffer.from(ENCRYPTION_KEY, 'hex');

/**
 * Encrypt a string using AES-256-GCM
 * Returns base64-encoded string: iv:authTag:ciphertext
 */
export function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(12); // 96-bit IV for GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:ciphertext (all as base64)
  const combined = Buffer.concat([iv, authTag, Buffer.from(encrypted, 'hex')]).toString('base64');
  return combined;
}

/**
 * Decrypt a string encrypted with encrypt()
 * Expects base64-encoded string: iv:authTag:ciphertext
 */
export function decrypt(encrypted: string): string {
  try {
    const combined = Buffer.from(encrypted, 'base64');

    // Extract components
    const iv = combined.slice(0, 12); // First 12 bytes
    const authTag = combined.slice(12, 28); // Next 16 bytes
    const ciphertext = combined.slice(28); // Remaining bytes

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(ciphertext.toString('hex'), 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    throw new Error(`Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Hash a string using SHA-256 (one-way, for verification)
 */
export function hash(plaintext: string): string {
  return crypto.createHash('sha256').update(plaintext).digest('hex');
}

/**
 * Verify a plaintext matches its hash
 */
export function verifyHash(plaintext: string, hashed: string): boolean {
  return hash(plaintext) === hashed;
}
