import { describe, it, expect } from 'vitest';
import { detectLoginPage } from './heuristic';

describe('login-detector heuristic', () => {
  it('detects a basic login form', () => {
    const html = `
      <html><head><title>Login</title></head><body>
        <h1>Sign In</h1>
        <form>
          <input type="email" name="email" placeholder="Email" />
          <input type="password" name="password" placeholder="Password" />
          <button type="submit">Log In</button>
        </form>
        <a href="/forgot">Forgot password?</a>
      </body></html>
    `;
    const r = detectLoginPage(html);
    expect(r.isLogin).toBe(true);
    expect(r.confidence).toBeGreaterThan(0.7);
  });

  it('detects login with OAuth buttons', () => {
    const html = `
      <div>
        <h2>Sign in to your account</h2>
        <button>Sign in with Google</button>
        <button>Sign in with GitHub</button>
        <p>or</p>
        <input type="email" placeholder="Email address" />
        <input type="password" placeholder="Password" />
        <button>Sign In</button>
      </div>
    `;
    const r = detectLoginPage(html);
    expect(r.isLogin).toBe(true);
    expect(r.confidence).toBeGreaterThan(0.6);
  });

  it('detects login with remember-me checkbox', () => {
    const html = `
      <form action="/login" method="post">
        <label>Username</label>
        <input type="text" name="username" />
        <label>Password</label>
        <input type="password" name="pass" />
        <label><input type="checkbox" /> Remember me</label>
        <input type="submit" value="Login" />
      </form>
    `;
    const r = detectLoginPage(html);
    expect(r.isLogin).toBe(true);
  });

  it('rejects a product page', () => {
    const html = `
      <html><head><title>Amazing Widget - Buy Now</title></head><body>
        <h1>Amazing Widget</h1>
        <p>Price: $29.99</p>
        <img src="widget.jpg" />
        <button>Add to Cart</button>
        <div>Customer Reviews</div>
      </body></html>
    `;
    const r = detectLoginPage(html);
    expect(r.isLogin).toBe(false);
    expect(r.confidence).toBeLessThan(0.3);
  });

  it('rejects a registration form (too many fields)', () => {
    const html = `
      <h1>Create Account</h1>
      <form>
        <input type="text" name="first_name" placeholder="First Name" />
        <input type="text" name="last_name" placeholder="Last Name" />
        <input type="email" name="email" placeholder="Email" />
        <input type="password" name="password" placeholder="Password" />
        <input type="password" name="confirm" placeholder="Confirm Password" />
        <input type="text" name="phone" placeholder="Phone" />
        <input type="text" name="company" placeholder="Company" />
        <input type="text" name="address" placeholder="Address" />
        <input type="text" name="city" placeholder="City" />
        <button type="submit">Register</button>
      </form>
    `;
    const r = detectLoginPage(html);
    expect(r.isLogin).toBe(false);
  });

  it('rejects a checkout page', () => {
    const html = `
      <h1>Checkout</h1>
      <form>
        <input type="email" name="email" />
        <input type="text" name="card-number" placeholder="Card Number" />
        <input type="tel" name="cc" />
        <input type="text" name="expiry" />
        <input type="text" name="cvv" placeholder="CVV" />
        <button>Pay Now</button>
      </form>
    `;
    const r = detectLoginPage(html);
    expect(r.isLogin).toBe(false);
  });

  it('rejects a search page', () => {
    const html = `
      <h1>Search</h1>
      <input type="search" placeholder="Search..." />
      <button>Search</button>
      <div>Search results for "login"</div>
    `;
    const r = detectLoginPage(html);
    expect(r.isLogin).toBe(false);
  });

  it('detects OAuth-only login (no password field)', () => {
    const html = `
      <h2>Log In</h2>
      <button>Continue with Google</button>
      <button>Continue with Apple</button>
      <p>Don't have an account? <a href="/register">Sign up</a></p>
    `;
    const r = detectLoginPage(html);
    expect(r.isLogin).toBe(true);
  });

  it('handles empty HTML', () => {
    const r = detectLoginPage('');
    expect(r.isLogin).toBe(false);
    expect(r.confidence).toBe(0);
  });

  // --- ATS-specific tests ---

  it('detects Greenhouse ATS login', () => {
    const html = `
      <div id="main">
        <h1>Sign In to Greenhouse</h1>
        <form action="/users/sign_in" method="post">
          <input type="hidden" name="authenticity_token" value="abc123" />
          <label for="user_email">Email</label>
          <input type="email" id="user_email" name="user[email]" autofocus />
          <label for="user_password">Password</label>
          <input type="password" id="user_password" name="user[password]" />
          <label><input type="checkbox" name="user[remember_me]" /> Remember me</label>
          <input type="submit" value="Sign In" />
        </form>
        <a href="/users/password/new">Forgot your password?</a>
      </div>
    `;
    const r = detectLoginPage(html);
    expect(r.isLogin).toBe(true);
    expect(r.confidence).toBeGreaterThan(0.7);
  });

  it('detects Workday login page', () => {
    const html = `
      <div data-automation-id="loginPage">
        <h2>Sign In</h2>
        <div data-automation-id="signInForm">
          <input type="text" data-automation-id="userName" name="username" placeholder="Username" />
          <input type="password" data-automation-id="password" name="password" placeholder="Password" />
          <button data-automation-id="signInBtn" type="submit">Sign In</button>
        </div>
        <a href="/forgotten">Forgot Password?</a>
      </div>
    `;
    const r = detectLoginPage(html);
    expect(r.isLogin).toBe(true);
  });

  it('correctly counts visible vs hidden inputs', () => {
    // 2 visible + 3 hidden = should NOT trigger too-many-inputs
    const html = `
      <form>
        <input type="hidden" name="csrf" />
        <input type="hidden" name="redirect" />
        <input type="hidden" name="source" />
        <input type="email" name="email" />
        <input type="password" name="pass" />
        <button>Log In</button>
      </form>
    `;
    const r = detectLoginPage(html);
    expect(r.isLogin).toBe(true);
    const tooMany = r.signals.find(s => s.name === 'too-many-inputs');
    expect(tooMany?.found).toBe(false);
  });

  it('handles self-closing input tags', () => {
    const html = `
      <form>
        <input type="email" name="email" />
        <input type="password" name="pass" />
        <button>Sign In</button>
      </form>
    `;
    const r = detectLoginPage(html);
    expect(r.isLogin).toBe(true);
  });

  it('returns signals array even for non-login pages', () => {
    const r = detectLoginPage('<div>Just text</div>');
    expect(r.signals).toBeInstanceOf(Array);
    expect(r.signals.length).toBeGreaterThan(0);
    expect(r.signals.every(s => !s.found)).toBe(true);
  });
});
