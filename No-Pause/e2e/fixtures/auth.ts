import { expect, test as base, type Page, type Route } from '@playwright/test';

const supabaseUrl = process.env.VITE_SUPABASE_URL ?? 'https://nuwdjopbvxpfeaxfirot.supabase.co';
const supabaseProjectRef = new URL(supabaseUrl).hostname.split('.')[0] ?? 'test';
const supabaseStorageKey = `sb-${supabaseProjectRef}-auth-token`;

const fakeUser = {
  id: '00000000-0000-4000-8000-000000000001',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'e2e@example.com',
  email_confirmed_at: '2026-05-15T00:00:00.000Z',
  phone: '',
  confirmed_at: '2026-05-15T00:00:00.000Z',
  last_sign_in_at: '2026-05-15T00:00:00.000Z',
  app_metadata: {
    provider: 'google',
    providers: ['google'],
  },
  user_metadata: {
    full_name: 'E2E User',
    name: 'E2E User',
    difficulty: 'beginner',
  },
  identities: [],
  created_at: '2026-05-15T00:00:00.000Z',
  updated_at: '2026-05-15T00:00:00.000Z',
  is_anonymous: false,
};

const buildFakeSession = () => {
  const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60;

  return {
    access_token: 'fake-e2e-access-token',
    refresh_token: 'fake-e2e-refresh-token',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: expiresAt,
    user: fakeUser,
  };
};

const emptyPracticeStats = {
  scoredSessions: 0,
  totalPracticeTime: 0,
  avgFlowScore: 0,
  bestFlowScore: 0,
  lastSessionDate: null,
  currentStreak: 0,
  bestStreak: 0,
  modeBreakdown: [],
  recentSessions: [],
};

const corsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-headers': 'authorization,apikey,content-type,x-client-info,x-supabase-api-version',
};

async function fulfillJson(route: Route, body: unknown) {
  if (route.request().method() === 'OPTIONS') {
    await route.fulfill({ status: 204, headers: corsHeaders });
    return;
  }

  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    headers: corsHeaders,
    body: JSON.stringify(body),
  });
}

async function installMockSupabaseAuth(page: Page) {
  await page.route('**/auth/v1/user**', (route) => fulfillJson(route, fakeUser));
  await page.route('**/auth/v1/token**', (route) => fulfillJson(route, buildFakeSession()));
  await page.route('**/rest/v1/rpc/get_practice_stats**', (route) => fulfillJson(route, emptyPracticeStats));

  await page.addInitScript(
    ({ storageKey, session }) => {
      window.localStorage.setItem(storageKey, JSON.stringify(session));
    },
    {
      storageKey: supabaseStorageKey,
      session: buildFakeSession(),
    },
  );
}

type AuthFixtures = {
  authenticatedPage: Page;
};

export const test = base.extend<AuthFixtures>({
  authenticatedPage: async ({ page }, use) => {
    await installMockSupabaseAuth(page);
    await use(page);
  },
});

export { expect };
