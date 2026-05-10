import { test, expect } from '@playwright/test';
import { mockArchlensApi } from './fixtures/api-mock';
import { signInViaCallback } from './fixtures/sign-in';

test.describe('architecture tab', () => {
  test.beforeEach(async ({ page }) => {
    await mockArchlensApi(page);
  });

  test('renders mermaid SVG and violation banner for seeded data', async ({ page }) => {
    await signInViaCallback(page);
    await page.goto('/repos/acme/widgets');
    await expect(page.getByTestId('repo-tabs')).toBeVisible();

    await page.getByRole('link', { name: 'Architecture' }).click();
    await page.waitForURL('**/repos/acme/widgets/architecture');

    // Violation banner appears with the seeded cycle.
    const banner = page.getByTestId('violation-banner');
    await expect(banner).toBeVisible();
    await expect(banner).toHaveAttribute('data-state', 'violations');
    await expect(page.getByTestId('violation-cycles')).toBeVisible();

    // Static layer diagram renders an SVG.
    const diagram = page.getByTestId('layer-diagram');
    await expect(diagram).toBeVisible();
    const svg = page.getByTestId('mermaid-svg');
    await expect(svg).toHaveAttribute('data-mermaid-ready', 'true', { timeout: 15_000 });
    await expect(svg.locator('svg')).toBeVisible();

    // Toggle to interactive view renders a Cytoscape container.
    await page.getByTestId('toggle-interactive').click();
    await expect(page.getByTestId('interactive-graph')).toBeVisible();
    await expect(page.getByTestId('architecture-view')).toHaveAttribute('data-mode', 'interactive');

    // Toggle back.
    await page.getByTestId('toggle-static').click();
    await expect(page.getByTestId('layer-diagram')).toBeVisible();
  });
});
