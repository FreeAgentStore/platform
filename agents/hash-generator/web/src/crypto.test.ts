import { describe, expect, it } from 'vitest';
import {
  sha256, sha512, md5, hmacSha256,
  base64Encode, base64Decode, urlEncode, urlDecode,
  generateUuid, generatePassword, passwordStrength,
  decodeJwt, generateTotp,
} from './crypto';

describe('sha256', () => {
  it('hashes empty string', async () => {
    expect(await sha256('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });
  it('hashes "hello"', async () => {
    expect(await sha256('hello')).toBe('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
  });
});

describe('sha512', () => {
  it('hashes empty string', async () => {
    const hash = await sha512('');
    expect(hash).toHaveLength(128);
    expect(hash).toBe('cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e');
  });
});

describe('md5', () => {
  it('hashes empty string', () => {
    expect(md5('')).toBe('d41d8cd98f00b204e9800998ecf8427e');
  });
  it('hashes "hello"', () => {
    expect(md5('hello')).toBe('5d41402abc4b2a76b9719d911017c592');
  });
  it('hashes "The quick brown fox"', () => {
    expect(md5('The quick brown fox jumps over the lazy dog')).toBe('9e107d9d372bb6826bd81d3542a419d6');
  });
});

describe('hmacSha256', () => {
  it('returns 64 hex chars', async () => {
    const result = await hmacSha256('key', 'message');
    expect(result).toHaveLength(64);
    expect(result).toMatch(/^[0-9a-f]+$/);
  });
  it('different keys produce different results', async () => {
    const a = await hmacSha256('key1', 'message');
    const b = await hmacSha256('key2', 'message');
    expect(a).not.toBe(b);
  });
});

describe('base64', () => {
  it('encodes and decodes ASCII', () => {
    expect(base64Decode(base64Encode('hello'))).toBe('hello');
  });
  it('encodes and decodes unicode', () => {
    expect(base64Decode(base64Encode('hello world!'))).toBe('hello world!');
  });
  it('encodes known value', () => {
    expect(base64Encode('hello')).toBe('aGVsbG8=');
  });
  it('decodes known value', () => {
    expect(base64Decode('aGVsbG8=')).toBe('hello');
  });
});

describe('urlEncode/urlDecode', () => {
  it('encodes spaces', () => {
    expect(urlEncode('hello world')).toBe('hello%20world');
  });
  it('round-trips special chars', () => {
    const input = 'a=1&b=2&c=hello world';
    expect(urlDecode(urlEncode(input))).toBe(input);
  });
  it('decode handles invalid input gracefully', () => {
    expect(urlDecode('%ZZ')).toBe('%ZZ');
  });
});

describe('generateUuid', () => {
  it('returns valid UUID v4 format', () => {
    const uuid = generateUuid();
    expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
  it('generates unique values', () => {
    const a = generateUuid();
    const b = generateUuid();
    expect(a).not.toBe(b);
  });
});

describe('generatePassword', () => {
  it('generates correct length', () => {
    expect(generatePassword(16, { uppercase: true, lowercase: true, digits: true, symbols: false })).toHaveLength(16);
  });
  it('respects uppercase only', () => {
    const pw = generatePassword(20, { uppercase: true, lowercase: false, digits: false, symbols: false });
    expect(pw).toMatch(/^[A-Z]+$/);
  });
  it('respects digits only', () => {
    const pw = generatePassword(20, { uppercase: false, lowercase: false, digits: true, symbols: false });
    expect(pw).toMatch(/^[0-9]+$/);
  });
  it('falls back to lowercase+digits when nothing selected', () => {
    const pw = generatePassword(10, { uppercase: false, lowercase: false, digits: false, symbols: false });
    expect(pw).toHaveLength(10);
    expect(pw).toMatch(/^[a-z0-9]+$/);
  });
});

describe('passwordStrength', () => {
  it('rates empty as weak', () => {
    expect(passwordStrength('').label).toBe('Weak');
  });
  it('rates short lowercase as weak', () => {
    expect(passwordStrength('abc').label).toBe('Weak');
  });
  it('rates complex password as strong', () => {
    const result = passwordStrength('MyP@ssw0rd!Long123');
    expect(result.label).toBe('Strong');
    expect(result.score).toBeGreaterThanOrEqual(6);
  });
  it('rates medium password as fair or good', () => {
    const result = passwordStrength('Hello123');
    expect(['Fair', 'Good']).toContain(result.label);
  });
});

describe('decodeJwt', () => {
  it('decodes a valid JWT', () => {
    // Header: {"alg":"HS256","typ":"JWT"}, Payload: {"sub":"1234567890","name":"Test","iat":1516239022}
    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IlRlc3QiLCJpYXQiOjE1MTYyMzkwMjJ9.signature';
    const decoded = decodeJwt(token);
    expect(decoded).not.toBeNull();
    expect(decoded!.header.alg).toBe('HS256');
    expect(decoded!.payload.sub).toBe('1234567890');
    expect(decoded!.payload.name).toBe('Test');
    expect(decoded!.signature).toBe('signature');
  });
  it('returns null for invalid token', () => {
    expect(decodeJwt('not-a-jwt')).toBeNull();
  });
  it('returns null for empty string', () => {
    expect(decodeJwt('')).toBeNull();
  });
  it('returns null for malformed base64', () => {
    expect(decodeJwt('a.b.c')).toBeNull();
  });
});

describe('generateTotp', () => {
  it('returns 6-digit code', async () => {
    const result = await generateTotp('JBSWY3DPEHPK3PXP');
    expect(result.code).toMatch(/^\d{6}$/);
    expect(result.remaining).toBeGreaterThan(0);
    expect(result.remaining).toBeLessThanOrEqual(30);
  });
});
