import { describe, it, expect } from 'vitest';
import { findFormFields } from './heuristic';

describe('form-field-finder heuristic', () => {
  it('finds email and password in a login form', () => {
    const html = `
      <form>
        <input type="email" name="email" placeholder="Email" />
        <input type="password" name="password" />
        <button type="submit">Sign In</button>
      </form>
    `;
    const r = findFormFields(html);
    expect(r.fields).toHaveLength(2);
    expect(r.fields[0].role).toBe('email');
    expect(r.fields[0].confidence).toBeGreaterThan(0.8);
    expect(r.fields[1].role).toBe('password');
    expect(r.fields[1].confidence).toBeGreaterThan(0.8);
    expect(r.hasLoginForm).toBe(true);
  });

  it('finds username + password (not email)', () => {
    const html = `
      <form>
        <input type="text" name="username" placeholder="Username" />
        <input type="password" name="pass" />
        <button>Login</button>
      </form>
    `;
    const r = findFormFields(html);
    expect(r.fields.some(f => f.role === 'username')).toBe(true);
    expect(r.fields.some(f => f.role === 'password')).toBe(true);
    expect(r.hasLoginForm).toBe(true);
  });

  it('finds registration form fields', () => {
    const html = `
      <form>
        <input type="text" name="first_name" placeholder="First Name" />
        <input type="text" name="last_name" placeholder="Last Name" />
        <input type="email" name="email" />
        <input type="password" name="password" />
        <input type="tel" name="phone" placeholder="Phone" />
        <button>Register</button>
      </form>
    `;
    const r = findFormFields(html);
    expect(r.fields.some(f => f.role === 'first-name')).toBe(true);
    expect(r.fields.some(f => f.role === 'last-name')).toBe(true);
    expect(r.fields.some(f => f.role === 'email')).toBe(true);
    expect(r.fields.some(f => f.role === 'password')).toBe(true);
    expect(r.hasRegistrationForm).toBe(true);
  });

  it('finds fields via autocomplete attribute', () => {
    const html = `
      <input autocomplete="email" />
      <input autocomplete="current-password" />
      <input autocomplete="given-name" />
      <input autocomplete="family-name" />
    `;
    const r = findFormFields(html);
    expect(r.fields.find(f => f.role === 'email')?.confidence).toBeGreaterThan(0.9);
    expect(r.fields.find(f => f.role === 'password')?.confidence).toBeGreaterThan(0.9);
    expect(r.fields.find(f => f.role === 'first-name')?.confidence).toBeGreaterThan(0.9);
    expect(r.fields.find(f => f.role === 'last-name')?.confidence).toBeGreaterThan(0.9);
  });

  it('finds fields via label association', () => {
    const html = `
      <label for="user-email">Email Address</label>
      <input type="text" id="user-email" />
      <label for="user-pass">Password</label>
      <input type="password" id="user-pass" />
    `;
    const r = findFormFields(html);
    expect(r.fields.some(f => f.role === 'email')).toBe(true);
    expect(r.fields.some(f => f.role === 'password')).toBe(true);
  });

  it('detects OTP / verification code fields', () => {
    const html = `
      <input type="text" name="otp" autocomplete="one-time-code" inputmode="numeric" maxlength="6" />
    `;
    const r = findFormFields(html);
    expect(r.fields[0].role).toBe('otp');
    expect(r.fields[0].confidence).toBeGreaterThan(0.7);
  });

  it('detects payment fields', () => {
    const html = `
      <input autocomplete="cc-number" name="card_number" />
      <input autocomplete="cc-csc" name="cvv" />
      <input autocomplete="cc-exp" name="expiry" />
    `;
    const r = findFormFields(html);
    expect(r.fields.some(f => f.role === 'card-number')).toBe(true);
    expect(r.fields.some(f => f.role === 'cvv')).toBe(true);
    expect(r.fields.some(f => f.role === 'expiry')).toBe(true);
  });

  it('disambiguates tel near payment context as card-number', () => {
    const html = `
      <div class="payment-form">
        <h3>Credit Card Details</h3>
        <input type="tel" name="cardnum" />
      </div>
    `;
    const r = findFormFields(html);
    expect(r.fields[0].role).toBe('card-number');
  });

  it('skips hidden and submit inputs', () => {
    const html = `
      <input type="hidden" name="csrf" value="abc" />
      <input type="email" name="email" />
      <input type="submit" value="Go" />
      <input type="button" value="Cancel" />
    `;
    const r = findFormFields(html);
    expect(r.fields).toHaveLength(1);
    expect(r.fields[0].role).toBe('email');
  });

  it('handles empty HTML', () => {
    const r = findFormFields('');
    expect(r.fields).toHaveLength(0);
    expect(r.formCount).toBe(0);
  });

  it('finds search fields', () => {
    const html = `
      <input type="search" name="q" placeholder="Search..." role="searchbox" />
    `;
    const r = findFormFields(html);
    expect(r.fields[0].role).toBe('search');
    expect(r.fields[0].confidence).toBeGreaterThan(0.9);
  });

  // --- ATS-specific tests ---

  it('finds Greenhouse ATS fields', () => {
    const html = `
      <form action="/users/sign_in" method="post">
        <input type="hidden" name="authenticity_token" value="abc" />
        <label for="user_email">Email</label>
        <input type="email" id="user_email" name="user[email]" />
        <label for="user_password">Password</label>
        <input type="password" id="user_password" name="user[password]" />
        <input type="submit" value="Sign In" />
      </form>
    `;
    const r = findFormFields(html);
    expect(r.fields.some(f => f.role === 'email')).toBe(true);
    expect(r.fields.some(f => f.role === 'password')).toBe(true);
    expect(r.hasLoginForm).toBe(true);
    // hidden and submit should be filtered
    expect(r.fields.length).toBe(2);
  });

  it('finds fields with bracket names (Rails-style)', () => {
    const html = `
      <input type="email" name="user[email]" />
      <input type="password" name="user[password]" />
    `;
    const r = findFormFields(html);
    expect(r.fields[0].role).toBe('email');
    expect(r.fields[1].role).toBe('password');
  });

  it('generates correct selectors with IDs', () => {
    const html = '<input type="email" id="my-field" name="email" />';
    const r = findFormFields(html);
    expect(r.fields[0].selector).toBe('#my-field');
  });

  it('generates correct selectors without IDs', () => {
    const html = '<input type="email" name="login_email" />';
    const r = findFormFields(html);
    expect(r.fields[0].selector).toBe('input[type="email"][name="login_email"]');
  });

  it('handles textarea elements', () => {
    const html = '<textarea name="message" placeholder="Your message"></textarea>';
    const r = findFormFields(html);
    // textarea with no matching role should not appear (role=unknown, no evidence)
    // Actually it has no attribute rules matching, so it stays unknown with no evidence
    expect(r.fields.length).toBe(0);
  });

  it('does not double-count fields', () => {
    // An email input with multiple matching attributes should produce one field, not many
    const html = '<input type="email" name="email" placeholder="Email" autocomplete="email" />';
    const r = findFormFields(html);
    expect(r.fields.length).toBe(1);
    expect(r.fields[0].role).toBe('email');
    // Should have multiple evidence entries though
    expect(r.fields[0].evidence.length).toBeGreaterThan(1);
  });

  it('finds label via for-attribute with special chars in id', () => {
    const html = `
      <label for="field.email">Email Address</label>
      <input type="text" id="field.email" />
    `;
    const r = findFormFields(html);
    expect(r.fields[0].role).toBe('email');
    expect(r.fields[0].evidence.some(e => e.startsWith('label:'))).toBe(true);
  });
});
