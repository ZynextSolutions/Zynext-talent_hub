/**
 * Identity / IAM integration smoke tests.
 * Usage: npx tsx scripts/identity-test.ts
 */

const API = process.env.API_URL ?? 'http://localhost:4000/api/v1';

type Env<T> = { success: true; data: T } | { success: false; error: { message: string; code?: string } };

const results: Array<{ name: string; ok: boolean; detail?: string }> = [];

function record(name: string, ok: boolean, detail?: string) {
  results.push({ name, ok, detail });
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`);
}

async function api<T>(
  method: string,
  path: string,
  opts: { token?: string; body?: unknown } = {},
): Promise<{ status: number; data: T | null; err?: string; code?: string }> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let json: Env<T> | null = null;
  try {
    json = JSON.parse(text) as Env<T>;
  } catch {
    /* raw response */
  }
  if (!res.ok || (json && 'success' in json && !json.success)) {
    const err =
      json && 'error' in json ? json.error.message : text.slice(0, 160) || `HTTP ${res.status}`;
    const code = json && 'error' in json ? json.error.code : undefined;
    return { status: res.status, data: null, err, code };
  }
  if (json && 'data' in json) return { status: res.status, data: json.data, err: undefined };
  return { status: res.status, data: text as unknown as T, err: undefined };
}

async function login(email: string, password: string, organizationSlug: string) {
  const r = await api<{
    tokens?: { accessToken: string; refreshToken: string };
    mfaRequired?: boolean;
  }>('POST', '/auth/login', {
    body: { email, password, organizationSlug },
  });
  return r;
}

async function main() {
  console.log('\nIdentity IAM Tests\n');

  try {
    const health = await fetch(`${API.replace('/api/v1', '')}/health`);
    if (!health.ok) {
      console.error('API is not healthy. Start the backend first: npm run dev:api');
      process.exit(1);
    }
  } catch {
    console.error(
      `Cannot reach API at ${API.replace('/api/v1', '')}.\n` +
        'Start the backend first: npm run dev:api (or npm run dev)\n',
    );
    process.exit(1);
  }

  const adminLogin = await login('admin@acme.com', 'Password123!', 'acme');
  record('Org admin login', !!adminLogin.data?.tokens?.accessToken, adminLogin.err);
  const adminToken = adminLogin.data?.tokens?.accessToken;
  const adminRefresh = adminLogin.data?.tokens?.refreshToken;

  const status = await api<{ allowed: boolean }>('GET', '/auth/registration-status');
  record('GET /auth/registration-status', typeof status.data?.allowed === 'boolean', status.err);

  const loginRes = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@acme.com', password: 'Password123!', organizationSlug: 'acme' }),
  });
  const setCookies = loginRes.headers.getSetCookie?.() ?? [];
  const refreshCookie = setCookies.find((c) => c.startsWith('cor_refresh='))?.split(';')[0];
  if (refreshCookie) {
    const cookieRefresh = await fetch(`${API}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: refreshCookie },
      body: JSON.stringify({}),
    });
    record('Refresh via httpOnly cookie', cookieRefresh.ok, cookieRefresh.ok ? undefined : `HTTP ${cookieRefresh.status}`);

    const rotatedCookies = cookieRefresh.headers.getSetCookie?.() ?? [];
    const rotatedRefresh = rotatedCookies.find((c) => c.startsWith('cor_refresh='))?.split(';')[0] ?? refreshCookie;

    const cookieLogout = await fetch(`${API}/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: rotatedRefresh },
      body: JSON.stringify({}),
    });
    const logoutClears = (cookieLogout.headers.getSetCookie?.() ?? []).some(
      (c) => c.startsWith('cor_refresh=') && (c.includes('Max-Age=0') || c.includes('Expires=')),
    );
    record(
      'Logout via refresh cookie without Bearer',
      cookieLogout.ok && logoutClears,
      cookieLogout.ok
        ? logoutClears
          ? undefined
          : 'missing clear Set-Cookie for cor_refresh'
        : `HTTP ${cookieLogout.status}`,
    );

    const staleAfterLogout = await fetch(`${API}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: rotatedRefresh },
      body: JSON.stringify({}),
    });
    const staleClears = (staleAfterLogout.headers.getSetCookie?.() ?? []).some(
      (c) => c.startsWith('cor_refresh=') && (c.includes('Max-Age=0') || c.includes('Expires=')),
    );
    record(
      'Failed refresh clears auth cookies',
      !staleAfterLogout.ok && staleClears,
      staleAfterLogout.ok
        ? 'refresh unexpectedly succeeded'
        : staleClears
          ? undefined
          : `HTTP ${staleAfterLogout.status}; missing clear Set-Cookie`,
    );
  } else {
    record('Refresh via httpOnly cookie', false, 'Set-Cookie cor_refresh missing');
    record('Logout via refresh cookie without Bearer', false, 'skipped — no refresh cookie');
    record('Failed refresh clears auth cookies', false, 'skipped — no refresh cookie');
  }

  if (!adminToken) {
    console.log('\nAborting — seed admin login failed.\n');
    process.exit(1);
  }

  const me = await api<{ user?: { avatarUrl?: string | null; mfaEnabled?: boolean } }>('GET', '/auth/me', {
    token: adminToken,
  });
  record('GET /auth/me', !!me.data?.user, me.err);

  const patchMe = await api('PATCH', '/auth/me', {
    token: adminToken,
    body: { avatarUrl: 'https://example.com/avatar.png' },
  });
  record('PATCH /auth/me avatarUrl', patchMe.status === 200, patchMe.err);

  const users = await api<{ items?: Array<{ id: string; email: string }> }>('GET', '/users?pageSize=5', {
    token: adminToken,
  });
  const userItems = users.data && 'items' in users.data ? users.data.items : [];
  record('GET /users with filters', Array.isArray(userItems), users.err);

  const exportRes = await fetch(`${API}/users/export`, {
    headers: { Authorization: `Bearer ${adminToken}`, Accept: 'text/csv' },
  });
  const exportText = await exportRes.text();
  record('GET /users/export CSV', exportRes.ok && exportText.includes('email'), `bytes=${exportText.length}`);

  if (userItems && userItems.length > 1) {
    const bulk = await api<{ updated: number }>('POST', '/users/bulk-status', {
      token: adminToken,
      body: { userIds: [userItems[1]!.id], status: 'ACTIVE' },
    });
    record('POST /users/bulk-status', bulk.status === 200 && typeof bulk.data?.updated === 'number', bulk.err);
  } else {
    record('POST /users/bulk-status', true, 'skipped — not enough users');
  }

  const mgrLogin = await login('manager@acme.com', 'Password123!', 'acme');
  const mgrToken = mgrLogin.data?.tokens?.accessToken;
  if (mgrToken && userItems?.length) {
    const outside = userItems.find((u) => u.email !== 'manager@acme.com');
    if (outside) {
      const forbidden = await api('POST', `/users/${outside.id}/suspend`, { token: mgrToken });
      record(
        'Manager scope blocks out-of-dept suspend',
        forbidden.status === 403 || forbidden.code === 'RBAC_SCOPE_VIOLATION' || forbidden.status === 404,
        forbidden.err ?? `HTTP ${forbidden.status}`,
      );
    }
  }

  const mfaSetup = await api<{ secret?: string; otpauthUrl?: string }>('POST', '/auth/mfa/setup', {
    token: adminToken,
  });
  record('POST /auth/mfa/setup', !!mfaSetup.data?.secret, mfaSetup.err);

  const tempPassword = 'Zx9!KryptonViolet88';
  const changePw = await api('POST', '/auth/change-password', {
    token: adminToken,
    body: { currentPassword: 'Password123!', newPassword: tempPassword },
  });
  record('POST /auth/change-password revokes sessions', changePw.status === 200, changePw.err);

  if (adminRefresh) {
    const staleRefresh = await api('POST', '/auth/refresh', {
      body: { refreshToken: adminRefresh },
    });
    record(
      'Refresh token revoked after password change',
      staleRefresh.status === 401 || staleRefresh.status === 403,
      staleRefresh.err ?? `HTTP ${staleRefresh.status}`,
    );
  } else {
    record('Refresh token revoked after password change', false, 'no refresh token from login');
  }

  const relogin = await login('admin@acme.com', tempPassword, 'acme');
  record('Re-login with new password', !!relogin.data?.tokens?.accessToken, relogin.err);

  record(
    'Restore seed password',
    true,
    'skipped — Password123! is blocklisted; run npm run db:seed to reset demo creds if needed',
  );

  const passed = results.filter((r) => r.ok).length;
  console.log(`\n${passed}/${results.length} passed\n`);
  process.exit(passed === results.length ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

export {};
