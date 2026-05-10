import { test, expect } from '@playwright/test';
import { mockArchlensApi, SEED_REPO } from './fixtures/api-mock';

const FAKE_ACCESS_TOKEN = 'test.archlens.access.token';
const FAKE_REFRESH_TOKEN = 'test.archlens.refresh.token';

test.describe('sign-in flow with mocked GitHub OAuth', () => {
  test.beforeEach(async ({ page, context }) => {
    // Server-to-API and client-to-API calls all match these patterns.
    await mockArchlensApi(page);
    await context.route(/.*\/repositories$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([SEED_REPO]),
      });
    });
  });

  test('landing → /callback (token-based) → dashboard → repo overview', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('sign-in-github')).toBeVisible();

    // Simulate the API redirecting to /auth/callback with tokens — this is the
    // real GitHub OAuth flow as implemented by the API. The /callback page
    // signs the user in via NextAuth's archlens-tokens credentials provider.
    await page.goto(
      `/auth/callback?accessToken=${encodeURIComponent(
        FAKE_ACCESS_TOKEN
      )}&refreshToken=${encodeURIComponent(FAKE_REFRESH_TOKEN)}`
    );

    await page.waitForURL('**/dashboard', { timeout: 15_000 });
    await expect(page.getByTestId('dashboard')).toBeVisible();
    await expect(page.getByTestId('dashboard-repo-card').first()).toContainText('acme/widgets');

    await page.getByTestId('dashboard-repo-card').first().click();
    await page.waitForURL('**/repos/acme/widgets');
    await expect(page.getByTestId('repo-overview')).toBeVisible();
    await expect(page.getByTestId('score-card')).toBeVisible();
    await expect(page.getByTestId('rating-tile').first()).toBeVisible();
    await expect(page.getByTestId('module-row').first()).toBeVisible();
  });
});
