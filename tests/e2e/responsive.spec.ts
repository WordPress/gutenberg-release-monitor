import { test, expect } from '@playwright/test';

test.describe('Responsive Design', () => {
  test('should render correctly on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/');

    // Check that page loads with data
    await expect(page.locator('#releases-table').getByText('Cycle B')).toBeVisible();

    // Verify tabs are visible
    await expect(page.getByRole('tab', { name: 'By Cycle' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'By Release' })).toBeVisible();

    // Verify chart is visible (use first() for multiple charts)
    await expect(page.locator('.recharts-wrapper').first()).toBeVisible();
  });

  test('should render correctly on tablet viewport', async ({ page }) => {
    // Set tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });

    await page.goto('/');

    // Check that page loads with data
    await expect(page.locator('#releases-table').getByText('Cycle B')).toBeVisible();

    // Verify layout elements
    await expect(page.getByRole('tab', { name: 'By Cycle' })).toBeVisible();
    await expect(page.locator('.recharts-wrapper').first()).toBeVisible();
  });

  test('should render correctly on desktop viewport', async ({ page }) => {
    // Set desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 });

    await page.goto('/');

    // Check that page loads with data
    await expect(page.locator('#releases-table').getByText('Cycle B')).toBeVisible();

    // Verify all UI elements are visible
    await expect(page.getByRole('tab', { name: 'By Cycle' })).toBeVisible();
    await expect(page.locator('.recharts-wrapper').first()).toBeVisible();
  });

  test('should maintain functionality on mobile after tab switch', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/');

    // Wait for cycles data to load
    await expect(page.locator('#releases-table').getByText('Cycle B')).toBeVisible();

    // Switch to releases tab
    await page.getByRole('tab', { name: 'By Release' }).click();

    // Wait for releases data to load
    await expect(page.locator('#releases-table').getByText('3.0')).toBeVisible();

    // Verify chart is still visible
    await expect(page.locator('.recharts-wrapper').first()).toBeVisible();
  });
});
