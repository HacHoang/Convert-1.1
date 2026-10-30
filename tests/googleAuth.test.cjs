const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { once } = require('node:events');
const path = require('node:path');
const { buildSync } = require('esbuild');
const built = buildSync({ entryPoints: [path.join(__dirname, '../server/googleAuth.ts')], platform: 'node', format: 'cjs', bundle: true, packages: 'external', write: false });
const loaded = { exports: {} };
new Function('require', 'module', 'exports', built.outputFiles[0].text)(require, loaded, loaded.exports);
const { createGoogleAuthRouter } = loaded.exports;

async function fixture(t, options = {}) {
  let nonce;
  let overrides = {};
  const app = express();
  app.use('/api/auth', createGoogleAuthRouter({ clientId: 'test.apps.googleusercontent.com', verifyToken: async token => {
    if (token === 'invalid') throw new Error('signature rejected');
    return { sub: 'google-user-123', aud: 'test.apps.googleusercontent.com', iss: 'https://accounts.google.com', exp: Math.floor(Date.now() / 1000) + 3600, email: 'test@example.com', email_verified: true, name: 'Test User', nonce, ...overrides };
  }, ...options }));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const request = (route, body, cookie, customOrigin = origin) => fetch(`${origin}/api/auth/${route}`, { method: body === undefined ? 'GET' : 'POST', headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json', Origin: customOrigin }), ...(cookie ? { Cookie: cookie } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const challenge = async () => {
    const response = await request('config');
    const config = await response.json();
    nonce = config.nonce;
    return { config, cookie: response.headers.getSetCookie()[0].split(';')[0] };
  };
  return { request, challenge, override: value => { overrides = value; } };
}

test('unconfigured auth is explicit and cannot create a session', async t => {
  const { request } = await fixture(t, { clientId: '' });
  assert.deepEqual(await (await request('config')).json(), { configured: false });
  assert.equal((await request('google', { credential: 'anything' })).status, 503);
  assert.equal((await (await request('session')).json()).isLoggedIn, false);
});

test('verified account gets HttpOnly session and logout invalidates it', async t => {
  const { request, challenge } = await fixture(t);
  const { config, cookie } = await challenge();
  const login = await request('google', { credential: 'valid', csrf: config.csrf }, cookie);
  assert.equal(login.status, 200);
  assert.equal((await login.json()).id, 'google-user-123');
  const setCookie = login.headers.getSetCookie().find(value => value.startsWith('convert_session='));
  assert.ok(setCookie.includes('HttpOnly') && setCookie.includes('SameSite=Lax'));
  const session = setCookie.split(';')[0];
  assert.equal((await (await request('session', undefined, session)).json()).email, 'test@example.com');
  assert.equal((await request('logout', {}, session)).status, 200);
  assert.equal((await (await request('session', undefined, session)).json()).isLoggedIn, false);
});

test('cross-origin login, missing CSRF and forged session cookies are rejected', async t => {
  const { request, challenge } = await fixture(t);
  const { config, cookie } = await challenge();
  assert.equal((await request('google', { credential: 'valid', csrf: config.csrf }, cookie, 'https://evil.example')).status, 403);
  assert.equal((await request('google', { credential: 'valid' }, cookie)).status, 403);
  assert.equal((await request('google', { credential: 'valid', csrf: config.csrf })).status, 403);
  assert.equal((await (await request('session', undefined, 'convert_session=forged')).json()).isLoggedIn, false);
});

test('signature, nonce, audience, issuer, expiry and unverified email fail validation', async t => {
  const { request, challenge, override } = await fixture(t);
  for (const invalid of [{ nonce: 'wrong' }, { aud: 'wrong' }, { iss: 'wrong' }, { exp: 1 }, { email_verified: false }, { sub: '' }]) {
    const { config, cookie } = await challenge();
    override(invalid);
    assert.equal((await request('google', { credential: 'valid', csrf: config.csrf }, cookie)).status, 401);
  }
  override({});
  const { config, cookie } = await challenge();
  assert.equal((await request('google', { credential: 'invalid', csrf: config.csrf }, cookie)).status, 401);
});

test('login challenges cannot be replayed', async t => {
  const { request, challenge } = await fixture(t);
  const { config, cookie } = await challenge();
  const body = { credential: 'valid', csrf: config.csrf };
  assert.equal((await request('google', body, cookie)).status, 200);
  assert.equal((await request('google', body, cookie)).status, 403);
});

test('production requires HTTPS and sets secure host-only cookies', async t => {
  const first = await fixture(t, { production: true });
  assert.equal((await (await first.request('config')).json()).configured, false);
  const second = await fixture(t, { production: true, appUrl: 'https://convert.example.com' });
  const response = await second.request('config');
  const cookie = response.headers.getSetCookie()[0];
  assert.ok(cookie.startsWith('__Host-convert_login='));
  assert.ok(cookie.includes('Secure') && cookie.includes('Path=/') && !cookie.includes('Domain='));
});
