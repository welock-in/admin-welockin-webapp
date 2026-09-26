const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { NextRequest } = require('next/server');
const root = path.resolve(__dirname, '..');
function load(file, mocks = {}, globals = {}) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(code, { module, exports: module.exports, process, URL, URLSearchParams, console,
    require: name => name in mocks ? mocks[name] : require(name), ...globals }, { filename: file });
  return module.exports;
}
const session = load('src/lib/admin-session.ts');
function jar(values = {}) {
  return { values: { ...values }, get(name) { const v = this.values[name]; return v == null ? undefined : { value: v }; },
    set(name, value) { this.values[name] = value; }, delete(name) { delete this.values[name]; } };
}
const v1 = '11111111-1111-4111-8111-111111111111';
const v2 = '22222222-2222-4222-8222-222222222222';
const makeRequest = (url, values = {}) => new NextRequest(`https://admin.test${url}`, { headers: { cookie: Object.entries(values).map(([k,v]) => `${k}=${v}`).join('; ') } });
const libs = { '@/lib/admin-session': session };

test('login remains accessible for absent, fake and expired credentials; private pages stay gated', () => {
  const { middleware } = load('src/middleware.ts', libs);
  for (const value of [undefined, 'fake', 'expired', 'revoked', 'valid']) {
    const values = value ? { wl_admin: value } : {};
    assert.equal(middleware(makeRequest('/login', values)).status, 200);
  }
  assert.equal(middleware(makeRequest('/signup-offers')).status, 307);
  assert.equal(middleware(makeRequest('/', { wl_admin: 'valid' })).status, 200);
});

test('return URLs cannot escape the admin or re-enter its login/API loop', () => {
  for (const from of ['//evil.test', '/\\evil.test', '/%2Fevil.test', '/%5cevil.test', '/%252Fevil.test', '/%0aevil', 'https://evil.test', '/login', '/api/logout', '/\nevil', null]) assert.equal(session.safeReturnPath(from), '/');
  assert.equal(session.safeReturnPath('/users/123?tab=focus'), '/users/123?tab=focus');
});

test('expired server session is cleared through a route, while a newer login remains intact', () => {
  const { GET } = load('src/app/api/session/expired/route.ts', libs);
  const current = { wl_admin_session: v2, [`wl_admin_${v2}`]: 'new-token' };
  const stale = GET(makeRequest(session.expiryPath(v1, '/signup-offers'), current));
  assert.equal(new URL(stale.headers.get('location')).pathname, '/signup-offers');
  assert.equal(stale.cookies.getAll().length, 0);
  const expired = GET(makeRequest(session.expiryPath(v2, '/users/123'), current));
  assert.equal(new URL(expired.headers.get('location')).pathname, '/login');
  assert.equal(expired.cookies.getAll().length, 1);
  assert.equal(expired.cookies.getAll()[0].name, `wl_admin_${v2}`);
  const legacy = GET(makeRequest(session.expiryPath('legacy'), { wl_admin: 'expired' }));
  assert.equal(legacy.cookies.getAll()[0].name, 'wl_admin');
});

test('proxy expires exactly its request credential on 401, never on 403 or a server failure', async () => {
  for (const status of [200, 401, 403, 503]) {
    const cookies = jar({ wl_admin_session: v1, [`wl_admin_${v1}`]: 'old-token' });
    const proxy = load('src/app/api/proxy/[...path]/route.ts', { ...libs, 'next/headers': { cookies: async () => cookies },
      '@/lib/backend': { backendBase: () => 'https://backend.test/api' } }, {
      fetch: async (_, init) => {
        assert.equal(init.headers.authorization, 'Bearer old-token');
        // A new login completes while this request is still in flight.
        cookies.set('wl_admin_session', v2); cookies.set(`wl_admin_${v2}`, 'new-token');
        return new Response('{}', { status });
      },
    });
    const response = await proxy.GET(new Request('https://admin.test/api/proxy/admin/overview'), { params: Promise.resolve({ path: ['admin', 'overview'] }) });
    assert.equal(response.status, status);
    const expired = response.cookies.getAll();
    assert.equal(expired.length, status === 401 ? 1 : 0);
    if (status === 401) assert.equal(expired[0].name, `wl_admin_${v1}`);
    assert.equal(cookies.get(`wl_admin_${v2}`).value, 'new-token');
  }
});

test('server backend errors retain request generation and distinguish authentication from availability', async () => {
  for (const status of [401, 403, 503]) {
    const cookies = jar({ wl_admin: 'expired' });
    const backend = load('src/lib/backend.ts', { 'server-only': {}, './admin-session': session, 'next/headers': { cookies: async () => cookies } }, {
      fetch: async () => new Response('{"error":"fixture"}', { status }),
    });
    await assert.rejects(() => backend.backendGet('/admin/overview'), e => e.status === status && e.sessionVersion === 'legacy');
    assert.equal(cookies.get('wl_admin').value, 'expired', 'Server Components never mutate cookies');
  }
});

test('new login installs its own httpOnly credential cookie and retires the previous one', async () => {
  const cookies = jar({ wl_admin: 'invalid' });
  const login = load('src/app/api/login/route.ts', { ...libs, 'node:crypto': { randomUUID: () => v2 }, 'next/headers': { cookies: async () => cookies },
    '@/lib/backend': { backendBase: () => 'https://backend.test/api' } }, { fetch: async () => new Response('{"token":"fresh"}') });
  assert.equal((await login.POST(new Request('https://admin.test/api/login', { method: 'POST', body: '{"username":"test","password":"fixture"}' }))).status, 200);
  assert.equal(cookies.get('wl_admin'), undefined);
  assert.equal(cookies.get(`wl_admin_${v2}`).value, 'fresh');
  assert.equal(cookies.get('wl_admin_session').value, v2);
  assert.equal(session.COOKIE_OPTIONS.httpOnly, true);
});

test('browser callers handle current 401 once and ignore delayed errors from an earlier login', async () => {
  for (const changed of [false, true]) {
    let redirects = 0;
    const document = { cookie: `wl_admin_session=${v1}` };
    const client = load('src/lib/client.ts', { './admin-session': session }, {
      document, window: { location: { pathname: '/signup-offers', search: '', replace: () => redirects++ } },
      fetch: async () => { if (changed) document.cookie = `wl_admin_session=${v2}`; return new Response('{}', { status: 401 }); },
    });
    await assert.rejects(() => client.apiGet('admin/signup-lifetime/settings'));
    assert.equal(redirects, changed ? 0 : 1);
    await assert.rejects(() => client.apiSend('admin/profile', 'PATCH', {}));
    assert.equal(redirects, 1, 'a later request for the current generation redirects only once');
  }
});
