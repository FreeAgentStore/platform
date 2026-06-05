/**
 * Hash Generator — hashing, encoding, UUIDs, passwords, JWT decode, TOTP.
 * Uses Web Crypto API where available, pure JS fallback for MD5.
 */

// ── Hashing (Web Crypto) ────────────────────────────────────────────

async function hashDigest(algorithm: string, input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest(algorithm, data);
  return bufferToHex(hashBuffer);
}

function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function sha256(input: string): Promise<string> {
  return hashDigest('SHA-256', input);
}

export async function sha512(input: string): Promise<string> {
  return hashDigest('SHA-512', input);
}

// ── MD5 (pure JS — Web Crypto doesn't support MD5) ──────────────────

export function md5(input: string): string {
  const bytes = stringToBytes(input);
  return md5Bytes(bytes);
}

function stringToBytes(s: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 128) {
      bytes.push(c);
    } else if (c < 2048) {
      bytes.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
    } else {
      bytes.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
    }
  }
  return bytes;
}

function md5Bytes(input: number[]): string {
  const S = [
    7,12,17,22,7,12,17,22,7,12,17,22,7,12,17,22,
    5,9,14,20,5,9,14,20,5,9,14,20,5,9,14,20,
    4,11,16,23,4,11,16,23,4,11,16,23,4,11,16,23,
    6,10,15,21,6,10,15,21,6,10,15,21,6,10,15,21
  ];
  const K = new Uint32Array(64);
  for (let i = 0; i < 64; i++) {
    K[i] = Math.floor(2**32 * Math.abs(Math.sin(i + 1))) >>> 0;
  }

  // Pre-processing: pad to 512-bit blocks
  const msgLen = input.length;
  input.push(0x80);
  while ((input.length % 64) !== 56) input.push(0);

  // Append original length in bits as 64-bit little-endian
  const bitLen = msgLen * 8;
  for (let i = 0; i < 8; i++) {
    input.push((bitLen >>> (i * 8)) & 0xff);
  }

  let a0 = 0x67452301 >>> 0;
  let b0 = 0xefcdab89 >>> 0;
  let c0 = 0x98badcfe >>> 0;
  let d0 = 0x10325476 >>> 0;

  for (let offset = 0; offset < input.length; offset += 64) {
    const M = new Uint32Array(16);
    for (let j = 0; j < 16; j++) {
      M[j] = input[offset + j * 4]
        | (input[offset + j * 4 + 1] << 8)
        | (input[offset + j * 4 + 2] << 16)
        | (input[offset + j * 4 + 3] << 24);
    }

    let A = a0, B = b0, C = c0, D = d0;

    for (let i = 0; i < 64; i++) {
      let F: number, g: number;
      if (i < 16) {
        F = (B & C) | (~B & D);
        g = i;
      } else if (i < 32) {
        F = (D & B) | (~D & C);
        g = (5 * i + 1) % 16;
      } else if (i < 48) {
        F = B ^ C ^ D;
        g = (3 * i + 5) % 16;
      } else {
        F = C ^ (B | ~D);
        g = (7 * i) % 16;
      }
      F = (F + A + K[i] + M[g]) >>> 0;
      A = D;
      D = C;
      C = B;
      B = (B + ((F << S[i]) | (F >>> (32 - S[i])))) >>> 0;
    }

    a0 = (a0 + A) >>> 0;
    b0 = (b0 + B) >>> 0;
    c0 = (c0 + C) >>> 0;
    d0 = (d0 + D) >>> 0;
  }

  function toLittleEndianHex(n: number): string {
    return [0, 8, 16, 24].map(s => ((n >>> s) & 0xff).toString(16).padStart(2, '0')).join('');
  }

  return toLittleEndianHex(a0) + toLittleEndianHex(b0) + toLittleEndianHex(c0) + toLittleEndianHex(d0);
}

// ── HMAC-SHA256 ──────────────────────────────────────────────────────

export async function hmacSha256(key: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw', enc.encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(message));
  return bufferToHex(sig);
}

// ── Base64 / URL encoding ────────────────────────────────────────────

export function base64Encode(input: string): string {
  return btoa(unescape(encodeURIComponent(input)));
}

export function base64Decode(input: string): string {
  try {
    return decodeURIComponent(escape(atob(input)));
  } catch {
    return atob(input);
  }
}

export function urlEncode(input: string): string {
  return encodeURIComponent(input);
}

export function urlDecode(input: string): string {
  try {
    return decodeURIComponent(input);
  } catch {
    return input;
  }
}

// ── UUID ─────────────────────────────────────────────────────────────

export function generateUuid(): string {
  return crypto.randomUUID();
}

// ── Password generator ───────────────────────────────────────────────

export interface PasswordOptions {
  uppercase: boolean;
  lowercase: boolean;
  digits: boolean;
  symbols: boolean;
}

export function generatePassword(length: number, options: PasswordOptions): string {
  let chars = '';
  if (options.uppercase) chars += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  if (options.lowercase) chars += 'abcdefghijklmnopqrstuvwxyz';
  if (options.digits) chars += '0123456789';
  if (options.symbols) chars += '!@#$%^&*()_+-=[]{}|;:,.<>?';
  if (!chars) chars = 'abcdefghijklmnopqrstuvwxyz0123456789';

  const array = new Uint32Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, v => chars[v % chars.length]).join('');
}

export function passwordStrength(password: string): { score: number; label: string; color: string } {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (password.length >= 16) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;

  if (score <= 2) return { score, label: 'Weak', color: 'bg-red-500' };
  if (score <= 4) return { score, label: 'Fair', color: 'bg-amber-500' };
  if (score <= 5) return { score, label: 'Good', color: 'bg-emerald-500' };
  return { score, label: 'Strong', color: 'bg-emerald-400' };
}

// ── JWT decode ───────────────────────────────────────────────────────

export function decodeJwt(token: string): { header: any; payload: any; signature: string } | null {
  try {
    const parts = token.trim().split('.');
    if (parts.length !== 3) return null;

    const decodeBase64Url = (s: string) => {
      const padded = s.replace(/-/g, '+').replace(/_/g, '/');
      const pad = padded.length % 4;
      const fixed = pad ? padded + '='.repeat(4 - pad) : padded;
      return JSON.parse(atob(fixed));
    };

    return {
      header: decodeBase64Url(parts[0]),
      payload: decodeBase64Url(parts[1]),
      signature: parts[2],
    };
  } catch {
    return null;
  }
}

// ── TOTP (RFC 6238) ──────────────────────────────────────────────────

function base32Decode(input: string): Uint8Array {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const clean = input.toUpperCase().replace(/[= ]/g, '');
  const bits: number[] = [];

  for (const ch of clean) {
    const val = alphabet.indexOf(ch);
    if (val === -1) continue;
    for (let i = 4; i >= 0; i--) {
      bits.push((val >> i) & 1);
    }
  }

  const bytes = new Uint8Array(Math.floor(bits.length / 8));
  for (let i = 0; i < bytes.length; i++) {
    let byte = 0;
    for (let j = 0; j < 8; j++) {
      byte = (byte << 1) | bits[i * 8 + j];
    }
    bytes[i] = byte;
  }
  return bytes;
}

export async function generateTotp(secret: string): Promise<{ code: string; remaining: number }> {
  const keyBytes = base32Decode(secret);
  const time = Math.floor(Date.now() / 1000);
  const step = Math.floor(time / 30);
  const remaining = 30 - (time % 30);

  // Encode step as 8-byte big-endian
  const msg = new Uint8Array(8);
  let tmp = step;
  for (let i = 7; i >= 0; i--) {
    msg[i] = tmp & 0xff;
    tmp = Math.floor(tmp / 256);
  }

  const cryptoKey = await crypto.subtle.importKey(
    'raw', keyBytes,
    { name: 'HMAC', hash: 'SHA-1' },
    false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, msg);
  const hash = new Uint8Array(sig);

  // Dynamic truncation
  const offset = hash[hash.length - 1] & 0x0f;
  const binary =
    ((hash[offset] & 0x7f) << 24) |
    ((hash[offset + 1] & 0xff) << 16) |
    ((hash[offset + 2] & 0xff) << 8) |
    (hash[offset + 3] & 0xff);

  const otp = (binary % 1000000).toString().padStart(6, '0');
  return { code: otp, remaining };
}
