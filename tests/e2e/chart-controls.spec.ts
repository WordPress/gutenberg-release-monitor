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

  test.describe('Section Toggle', () => {
    test('should display section controls', async ({ page }) => {
      const metricToggle = page.locator('.metric-toggle');
      await expect(metricToggle).toBeVisible();

      // Verify section options are present
      await expect(metricToggle.getByRole('radio', { name: 'PR Types' })).toBeVisible();
      await expect(metricToggle.getByRole('radio', { name: 'Contributors' })).toBeVisible();
      await expect(metricToggle.getByRole('radio', { name: 'AI Usage' })).toBeVisible();
    });

    test('should switch between PR Types, Contributors, and AI Usage', async ({ page }) => {
      const metricToggle = page.locator('.metric-toggle');

      // Default should be PR Types (based on project.json defaults)
      await expect(metricToggle.getByRole('radio', { name: 'PR Types' })).toBeChecked();

      // Switch to Contributors
      await metricToggle.getByRole('radio', { name: 'Contributors' }).click();
      await expect(metricToggle.getByRole('radio', { name: 'Contributors' })).toBeChecked();

      // Switch to AI Usage
      await metricToggle.getByRole('radio', { name: 'AI Usage' }).click();
      await expect(metricToggle.getByRole('radio', { name: 'AI Usage' })).toBeChecked();

      // Switch back to PR Types
      await metricToggle.getByRole('radio', { name: 'PR Types' }).click();
      await expect(metricToggle.getByRole('radio', { name: 'PR Types' })).toBeChecked();
    });

    test('should show AI views inside AI Usage', async ({ page }) => {
      const metricToggle = page.locator('.metric-toggle');
      const viewModeToggle = page.locator('.view-mode-toggle');

      await expect(metricToggle.getByRole('radio', { name: 'PR Types' })).toBeChecked();

      await expect(viewModeToggle.getByRole('radio', { name: 'Totals' })).toBeVisible();
      await expect(viewModeToggle.getByRole('radio', { name: 'Distribution' })).toBeVisible();
      await expect(viewModeToggle.getByRole('radio', { name: 'Detected usage' })).toHaveCount(0);

      await metricToggle.getByRole('radio', { name: 'AI Usage' }).click();
      await expect(metricToggle.getByRole('radio', { name: 'AI Usage' })).toBeChecked();
      await expect(viewModeToggle.getByRole('radio', { name: 'Detected usage' })).toBeVisible();
      await expect(viewModeToggle.getByRole('radio', { name: 'Author source' })).toBeVisible();
      await expect(viewModeToggle.getByRole('radio', { name: 'Tools' })).toBeVisible();
      await expect(viewModeToggle.getByRole('radio', { name: 'Detected usage' })).toBeChecked();
      await expect(page.locator('.summary-section').getByText('Detected AI usage')).toHaveCount(0);
      await expect(page.locator('.summary-section').getByText('Not detected')).toHaveCount(0);
      await expect(page.locator('.trend-chart-legend').first().getByText('Detected AI')).toBeVisible();
      await expect(page.locator('.trend-chart-legend').first().getByText('Not detected')).toBeVisible();
      const detectedLegend = page.locator('.trend-chart-legend-item', { hasText: 'Detected AI' }).first();
      await detectedLegend.click();
      await expect(detectedLegend).toHaveClass(/trend-chart-legend-item--hidden/);
      await detectedLegend.click();
      await expect(detectedLegend).not.toHaveClass(/trend-chart-legend-item--hidden/);
      await expect(page.locator('#releases-table').getByRole('button', { name: 'Detected AI PRs' })).toBeVisible();
      await expect(page.locator('#releases-table').getByRole('button', { name: 'Other detected AI' })).toBeVisible();
      await expect(page.locator('#releases-table').getByRole('button', { name: 'Known agent account' })).toBeVisible();

      await page.locator('#trend-chart .recharts-responsive-container').scrollIntoViewIfNeeded();
      const aiUsageTooltip = page.locator('.trend-chart-tooltip');
      const aiUsageBarCenters = await page.locator('#trend-chart .recharts-bar-rectangle').evaluateAll((bars) =>
        bars
          .map((bar) => {
            const box = bar.getBoundingClientRect();
            return {
              x: box.x + box.width / 2,
              y: box.y + Math.max(box.height / 2, 1),
              width: box.width,
            };
          })
          .filter((box) => box.width > 0)
      );

      for (const center of aiUsageBarCenters) {
        await page.mouse.move(center.x, center.y);
        await page.waitForTimeout(50);
        const text = await aiUsageTooltip.textContent().catch(() => '');
        if (text?.includes('Known agent account')) {
          break;
        }
      }

      await expect(aiUsageTooltip).toContainText('Known agent account');
      await expect(aiUsageTooltip).toContainText('%');

      await viewModeToggle.getByRole('radio', { name: 'Author source' }).click();
      await expect(viewModeToggle.getByRole('radio', { name: 'Author source' })).toBeChecked();
      await expect(page.locator('#trend-chart').getByText('Detected AI PRs by author source')).toBeVisible();
      await expect(page.locator('.trend-chart-legend').first().getByText('Other detected AI')).toBeVisible();
      const agentLegend = page.locator('.trend-chart-legend').first().getByRole('button', { name: 'Known agent account' });
      await expect(agentLegend).toBeVisible();
      await agentLegend.click();
      await expect(agentLegend).toHaveClass(/trend-chart-legend-item--hidden/);
      await agentLegend.click();
      await expect(agentLegend).not.toHaveClass(/trend-chart-legend-item--hidden/);
      await expect(page.locator('#releases-table').getByRole('button', { name: 'Known agent %' })).toBeVisible();

      await viewModeToggle.getByRole('radio', { name: 'Tools' }).click();
      await expect(viewModeToggle.getByRole('radio', { name: 'Tools' })).toBeChecked();
      await expect(page.locator('#trend-chart').getByText('Detected AI tool mentions by release')).toBeVisible();
      await expect(page.locator('.trend-chart-legend').first().getByText('claude-code')).toBeVisible();
      await expect(page.locator('.trend-chart-legend-item', { hasText: 'Not detected' })).toHaveCount(0);

      await page.locator('#trend-chart .recharts-responsive-container').scrollIntoViewIfNeeded();
      const tooltip = page.locator('.trend-chart-tooltip');
      const chartBox = await page.locator('#trend-chart .recharts-surface').boundingBox();
      if (!chartBox) throw new Error('Chart surface missing');

      for (const fraction of [0.25, 0.5, 0.75]) {
        await page.mouse.move(
          chartBox.x + chartBox.width * fraction,
          chartBox.y + chartBox.height / 2
        );
        await page.waitForTimeout(50);
        const text = await tooltip.textContent().catch(() => '');
        if (text?.includes('Cycle A')) {
          break;
        }
      }

      await expect(tooltip).toContainText('Cycle A');
      await expect(tooltip).toContainText('Total3');
      await expect(tooltip).not.toContainText('Total4');

      const allPRsLegend = page.locator('.trend-chart-legend-item', { hasText: 'All PRs' });
      await expect(allPRsLegend).toHaveCount(0);

      await page.locator('.chart-type-toggle').getByRole('radio', { name: 'Line' }).click();
      await expect(allPRsLegend).toBeVisible();
      await expect(allPRsLegend).toHaveClass(/trend-chart-legend-item--hidden/);

      await allPRsLegend.click();
      await expect(allPRsLegend).not.toHaveClass(/trend-chart-legend-item--hidden/);
      await expect(page.locator('#releases-table').getByRole('button', { name: 'Detected AI PRs' })).toBeVisible();
    });

    test('should update view mode options when metric changes', async ({ page }) => {
      const metricToggle = page.locator('.metric-toggle');
      const viewModeToggle = page.locator('.view-mode-toggle');

      // With PR Types selected, should only have PR type options
      await expect(metricToggle.getByRole('radio', { name: 'PR Types' })).toBeChecked();
      await expect(viewModeToggle.getByRole('radio', { name: 'Totals' })).toBeVisible();
      await expect(viewModeToggle.getByRole('radio', { name: 'Distribution' })).toBeVisible();
      await expect(viewModeToggle.getByRole('radio', { name: 'Detected usage' })).toHaveCount(0);

      // Switch to AI Usage
      await metricToggle.getByRole('radio', { name: 'AI Usage' }).click();
      await expect(viewModeToggle.getByRole('radio', { name: 'Detected usage' })).toBeVisible();
      await expect(viewModeToggle.getByRole('radio', { name: 'Author source' })).toBeVisible();
      await expect(viewModeToggle.getByRole('radio', { name: 'Tools' })).toBeVisible();

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
