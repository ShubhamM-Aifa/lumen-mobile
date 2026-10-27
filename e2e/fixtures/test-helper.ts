import { Page } from '@playwright/test';

const API_BASE = process.env.API_BASE || 'http://127.0.0.1:3081/api/v1';

export interface TestUser {
  email: string;
  name: string;
  accessToken: string;
  refreshToken: string;
}

/**
 * Creates a unique test user directly via API and returns tokens.
 */
export async function createTestUser(): Promise<TestUser> {
  const rand = Math.floor(Math.random() * 1000000);
  const email = `playwright_test_${rand}@example.com`;
  const password = 'Password123!';
  const name = `Tester ${rand}`;

  const res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name }),
  });

  const json = await res.json() as any;
  if (!res.ok) {
    throw new Error(`Failed to create test user: ${json.message || res.statusText}`);
  }

  return {
    email,
    name,
    accessToken: json.data.accessToken,
    refreshToken: json.data.refreshToken,
  };
}

/**
 * Logs in the test user into the browser by setting tokens in localStorage
 * and navigating to the specified page (defaults to /today).
 */
export async function loginAsTestUser(page: Page, user?: TestUser, targetPath = '/today') {
  const testUser = user ?? (await createTestUser());

  // Inject authentication tokens before page scripts evaluate
  await page.addInitScript((tokens) => {
    try {
      window.localStorage.setItem('lumen_access_token', tokens.accessToken);
      window.localStorage.setItem('lumen_refresh_token', tokens.refreshToken);
    } catch {}
  }, { accessToken: testUser.accessToken, refreshToken: testUser.refreshToken });

  // Navigate to root which reads tokens on boot and redirects to Today
  await page.goto('/', { waitUntil: 'commit' });
  await page.getByRole('button', { name: /^Notifications/ }).waitFor({ timeout: 35000 });

  if (targetPath && targetPath !== '/today' && targetPath !== '/') {
    await page.goto(targetPath, { waitUntil: 'commit' });
  }

  return testUser;
}
