import { test, expect } from '@playwright/test';

test.describe('Chart Interactions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for initial data to load - use table-specific locator
    await expect(page.locator('#releases-table').getByText('Cycle B')).toBeVisible();
  });

  test('should display chart with legend', async ({ page }) => {
    // Verify main chart container exists (use first() for multiple charts)
    await expect(page.locator('.recharts-responsive-container').first()).toBeVisible();

    // Verify legend is visible (custom class from TrendChart)
    await expect(page.locator('.trend-chart-legend').first()).toBeVisible();
  });

  test('should have interactive legend items', async ({ page }) => {
    // Find legend items (custom button class)
    const legendItems = page.locator('.trend-chart-legend-item');

    // Should have at least one legend item
    const count = await legendItems.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should toggle category visibility by clicking legend', async ({ page }) => {
    // Find a category legend item (not fixed, clickable)
    const featuresLegend = page.locator('.trend-chart-legend-item', { hasText: 'Features' }).first();

    // Click to toggle visibility
    await featuresLegend.click();

    // Should now have the hidden class
    await expect(featuresLegend).toHaveClass(/trend-chart-legend-item--hidden/);

    // Click again to show
    await featuresLegend.click();

    // Hidden class should be removed
    await expect(featuresLegend).not.toHaveClass(/trend-chart-legend-item--hidden/);
  });
});
