import type { Page } from '@playwright/test';

const FAKE_ACCESS_TOKEN = 'test.archlens.access.token';
const FAKE_REFRESH_TOKEN = 'test.archlens.refresh.token';

/**
 * Walks the page through the API's redirect-style sign-in by visiting
 * /auth/callback with seeded tokens. Resolves once we land on /dashboard.
 */
export async function signInViaCallback(page: Page) {
  await page.goto(
    `/auth/callback?accessToken=${encodeURIComponent(
      FAKE_ACCESS_TOKEN
    )}&refreshToken=${encodeURIComponent(FAKE_REFRESH_TOKEN)}`
  );
  await page.waitForURL('**/dashboard', { timeout: 15_000 });
}
