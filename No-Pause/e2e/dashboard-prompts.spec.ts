import { expect, test } from './fixtures/auth';

test('authenticated user can navigate from dashboard to prompts', async ({ authenticatedPage: page }) => {
  const runtimeErrors: string[] = [];

  page.on('pageerror', (error) => {
    runtimeErrors.push(error.message);
  });
  page.on('console', (message) => {
    if (message.type() === 'error') {
      runtimeErrors.push(message.text());
    }
  });

  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'No Pause' })).toBeVisible();
  await expect(page.getByText('Start with your voice')).toBeVisible();

  await page.getByRole('button', { name: 'More', exact: true }).click();

  await expect(page).toHaveURL(/\/prompts$/);
  await expect(page.getByRole('heading', { name: 'Prompts' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Back' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Argue', exact: true })).toBeVisible();

  expect(runtimeErrors).toEqual([]);
});
