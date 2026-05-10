import { test, expect } from '@playwright/test';
import { mockArchlensApi } from './fixtures/api-mock';
import { signInViaCallback } from './fixtures/sign-in';

test.describe('hotspots tab', () => {
  test.beforeEach(async ({ page }) => {
    await mockArchlensApi(page);
  });

  test('renders scatter and list, opens refactor modal', async ({ page }) => {
    await signInViaCallback(page);
    await page.goto('/repos/acme/widgets');

    await page.getByRole('link', { name: 'Hotspots' }).click();
    await page.waitForURL('**/repos/acme/widgets/hotspots');

    await expect(page.getByTestId('hotspots-view')).toBeVisible();
    await expect(page.getByTestId('hotspot-scatter')).toBeVisible();
    await expect(page.getByTestId('hotspot-list')).toBeVisible();

    const rows = page.getByTestId('hotspot-row');
    await expect(rows).toHaveCount(3);
    // Highest risk should be sorted to the top.
    await expect(rows.first()).toContainText('users.controller.ts');

    // Suggest-refactor button opens the placeholder modal.
    await rows.first().getByTestId('suggest-refactor').click();
    await expect(page.getByTestId('refactor-modal')).toBeVisible();
  });
});
