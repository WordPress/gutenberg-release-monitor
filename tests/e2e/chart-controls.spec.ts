import { test, expect } from '@playwright/test';

test.describe('Chart Controls', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for initial data to load
    await expect(page.locator('#releases-table').getByText('Cycle B')).toBeVisible();
  });

  test.describe('Chart Type Toggle', () => {
    test('should display chart type controls', async ({ page }) => {
      const chartTypeToggle = page.locator('.chart-type-toggle');
      await expect(chartTypeToggle).toBeVisible();

      // Verify all chart type options are present
      await expect(chartTypeToggle.getByRole('radio', { name: 'Stacked' })).toBeVisible();
      await expect(chartTypeToggle.getByRole('radio', { name: 'Area' })).toBeVisible();
      await expect(chartTypeToggle.getByRole('radio', { name: 'Bar' })).toBeVisible();
      await expect(chartTypeToggle.getByRole('radio', { name: 'Line' })).toBeVisible();
    });

    test('should switch between chart types', async ({ page }) => {
      const chartTypeToggle = page.locator('.chart-type-toggle');

      // Default should be Stacked (based on project.json defaults)
      await expect(chartTypeToggle.getByRole('radio', { name: 'Stacked' })).toBeChecked();

      // Switch to Area
      await chartTypeToggle.getByRole('radio', { name: 'Area' }).click();
      await expect(chartTypeToggle.getByRole('radio', { name: 'Area' })).toBeChecked();

      // Switch to Bar
      await chartTypeToggle.getByRole('radio', { name: 'Bar' }).click();
      await expect(chartTypeToggle.getByRole('radio', { name: 'Bar' })).toBeChecked();

      // Switch to Line
      await chartTypeToggle.getByRole('radio', { name: 'Line' }).click();
      await expect(chartTypeToggle.getByRole('radio', { name: 'Line' })).toBeChecked();
    });

    test('should update chart rendering when type changes', async ({ page }) => {
      const chartContainer = page.locator('.recharts-responsive-container').first();
      await expect(chartContainer).toBeVisible();

      // Switch to Bar chart
      await page.locator('.chart-type-toggle').getByRole('radio', { name: 'Bar' }).click();

      // Chart should still be visible after type change
      await expect(chartContainer).toBeVisible();
    });
  });

  test.describe('Metric Toggle', () => {
    test('should display metric controls', async ({ page }) => {
      const metricToggle = page.locator('.metric-toggle');
      await expect(metricToggle).toBeVisible();

      // Verify metric options are present
      await expect(metricToggle.getByRole('radio', { name: 'PRs' })).toBeVisible();
      await expect(metricToggle.getByRole('radio', { name: 'Contributors' })).toBeVisible();
    });

    test('should switch between PRs and Contributors', async ({ page }) => {
      const metricToggle = page.locator('.metric-toggle');

      // Default should be PRs (based on project.json defaults)
      await expect(metricToggle.getByRole('radio', { name: 'PRs' })).toBeChecked();

      // Switch to Contributors
      await metricToggle.getByRole('radio', { name: 'Contributors' }).click();
      await expect(metricToggle.getByRole('radio', { name: 'Contributors' })).toBeChecked();

      // Switch back to PRs
      await metricToggle.getByRole('radio', { name: 'PRs' }).click();
      await expect(metricToggle.getByRole('radio', { name: 'PRs' })).toBeChecked();
    });

    test('should update view mode options when metric changes', async ({ page }) => {
      const metricToggle = page.locator('.metric-toggle');
      const viewModeToggle = page.locator('.view-mode-toggle');

      // With PRs selected, should have Distribution option
      await expect(metricToggle.getByRole('radio', { name: 'PRs' })).toBeChecked();
      await expect(viewModeToggle.getByRole('radio', { name: 'Distribution' })).toBeVisible();

      // Switch to Contributors
      await metricToggle.getByRole('radio', { name: 'Contributors' }).click();

      // Should now have Sponsors and Countries options instead of Distribution
      await expect(viewModeToggle.getByRole('radio', { name: 'Sponsors' })).toBeVisible();
      await expect(viewModeToggle.getByRole('radio', { name: 'Countries' })).toBeVisible();
    });
  });

  test.describe('View Mode Toggle', () => {
    test('should display view mode controls', async ({ page }) => {
      const viewModeToggle = page.locator('.view-mode-toggle');
      await expect(viewModeToggle).toBeVisible();
    });

    test('should switch between view modes for PRs', async ({ page }) => {
      const viewModeToggle = page.locator('.view-mode-toggle');

      // Switch to Distribution
      await viewModeToggle.getByRole('radio', { name: 'Distribution' }).click();
      await expect(viewModeToggle.getByRole('radio', { name: 'Distribution' })).toBeChecked();

      // Chart should update (pie chart should be visible for distribution)
      await expect(page.locator('.recharts-responsive-container').first()).toBeVisible();
    });

    test('should switch between view modes for Contributors', async ({ page }) => {
      // First switch to Contributors metric
      await page.locator('.metric-toggle').getByRole('radio', { name: 'Contributors' }).click();

      const viewModeToggle = page.locator('.view-mode-toggle');

      // Switch to Sponsors
      await viewModeToggle.getByRole('radio', { name: 'Sponsors' }).click();
      await expect(viewModeToggle.getByRole('radio', { name: 'Sponsors' })).toBeChecked();

      // Switch to Countries
      await viewModeToggle.getByRole('radio', { name: 'Countries' }).click();
      await expect(viewModeToggle.getByRole('radio', { name: 'Countries' })).toBeChecked();
    });
  });
});
