import { expect, type Page } from '@playwright/test';

export async function expectSingleH1(page: Page) {
  await expect(page.locator('h1')).toHaveCount(1);
}

export async function expectNoHorizontalOverflow(page: Page) {
  const hasOverflow = await page.evaluate(() => {
    const root = document.documentElement;
    return root.scrollWidth > root.clientWidth;
  });

  expect(hasOverflow).toBe(false);
}
