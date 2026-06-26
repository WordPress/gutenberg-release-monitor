import { test, expect, type Page } from '@playwright/test';

const tableSelector = '#releases-table';

async function getTableRows(page: Page) {
  return page.locator(`${tableSelector} tbody tr`).evaluateAll((rows) =>
    rows.map((row) =>
      Array.from(row.querySelectorAll('td')).map((cell) =>
        cell.textContent?.replace(/\s+/g, ' ').trim() ?? ''
      )
    )
  );
}

async function ensureColumnVisible(page: Page, columnName: string) {
  const table = page.locator(tableSelector);
  const columnHeader = table.locator('th').filter({ hasText: columnName });

  if (await columnHeader.count()) {
    return;
  }

  await table.getByRole('button', { name: 'View options' }).click();
  await page
    .locator('button.components-item')
    .filter({
      has: page.locator('.dataviews-view-config__label', { hasText: columnName }),
    })
    .last()
    .click();
  await page.mouse.click(20, 20);

  await expect(columnHeader).toBeVisible();
}

async function sortColumnDescending(page: Page, columnName: string) {
  const table = page.locator(tableSelector);

  await table.getByRole('button', { name: columnName, exact: true }).click();
  await page.getByRole('menuitemradio', { name: 'Sort descending' }).click();

  await expect(table.getByRole('columnheader', { name: columnName, exact: true })).toHaveAttribute(
    'aria-sort',
    'descending'
  );
}

test.describe('Table sorting', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.locator(tableSelector).getByText('Cycle B')).toBeVisible();
  });

  test('uses the visible percentage when sorting Distribution columns', async ({ page }) => {
    await page.locator('.view-mode-toggle').getByRole('radio', { name: 'Distribution' }).click();
    await ensureColumnVisible(page, 'Features');

    await sortColumnDescending(page, 'Features');

    const rows = await getTableRows(page);
    expect(rows.map((row) => row[0])).toEqual(['Cycle B', 'Cycle A']);
    expect(rows.map((row) => row[4])).toEqual(['20%', '19%']);
  });

  test('uses the visible per-release average when sorting contributors', async ({ page }) => {
    await page.locator('.metric-toggle').getByRole('radio', { name: 'Contributors' }).click();

    await sortColumnDescending(page, 'Contributors');

    const rows = await getTableRows(page);
    expect(rows.map((row) => row[0])).toEqual(['Cycle B', 'Cycle A']);
    expect(rows.map((row) => row[3])).toEqual(['33', '26']);
  });
});
