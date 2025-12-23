import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test('should load with default tab (by-cycle)', async ({ page }) => {
    await page.goto('/');

    // Check that test data loads - wait for table to have data
    await expect(page.locator('#releases-table').getByText('Cycle B')).toBeVisible();

    // Check that the default tab is active
    const cycleTab = page.getByRole('tab', { name: 'By Cycle' });
    await expect(cycleTab).toHaveAttribute('aria-selected', 'true');
  });

  test('should switch between tabs', async ({ page }) => {
    await page.goto('/');

    // Wait for initial data load
    await expect(page.locator('#releases-table').getByText('Cycle B')).toBeVisible();

    // Start on cycles tab
    await expect(page.getByRole('tab', { name: 'By Cycle' })).toHaveAttribute('aria-selected', 'true');

    // Switch to releases tab
    await page.getByRole('tab', { name: 'By Release' }).click();

    // Verify tab is now active
    await expect(page.getByRole('tab', { name: 'By Release' })).toHaveAttribute('aria-selected', 'true');

    // Verify data loads for releases tab
    await expect(page.locator('#releases-table').getByText('3.0')).toBeVisible();

    // Switch back to cycles tab
    await page.getByRole('tab', { name: 'By Cycle' }).click();

    // Verify tab is active again
    await expect(page.getByRole('tab', { name: 'By Cycle' })).toHaveAttribute('aria-selected', 'true');
  });

  test('should load data for each tab', async ({ page }) => {
    await page.goto('/');

    // Wait for cycles data to load
    await expect(page.locator('#releases-table').getByText('Cycle B')).toBeVisible();

    // Switch to releases tab
    await page.getByRole('tab', { name: 'By Release' }).click();

    // Wait for releases data to load
    await expect(page.locator('#releases-table').getByText('3.0')).toBeVisible();
  });
});
