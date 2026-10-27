import { test, expect } from '@playwright/test';
import { loginAsTestUser } from './fixtures/test-helper';

test.describe('Reminders & Alarms System', () => {
  test('User can open Reminders screen from Today and see categories', async ({ page }) => {
    await loginAsTestUser(page);

    // The bell on Today opens the Notifications inbox; Reminders is reached from there or Customize
    const bellBtn = page.getByRole('button', { name: /^Notifications/ });
    await expect(bellBtn).toBeVisible();
    await bellBtn.click();
    await expect(page).toHaveURL(/\/notifications/);
    await page.goto('/reminders');

    // Verify Reminders screen
    await expect(page).toHaveURL(/\/reminders/);
    await expect(page.getByText('Reminders', { exact: true }).last()).toBeVisible();

    // Category tabs
    await expect(page.getByText('All', { exact: true })).toBeVisible();
    await expect(page.getByText('Hydration', { exact: true })).toBeVisible();
    await expect(page.getByText('Movement', { exact: true })).toBeVisible();
    await expect(page.getByText('Sleep', { exact: true })).toBeVisible();
    await expect(page.getByText('Meds', { exact: true })).toBeVisible();
  });

  test('User can create a new reminder and see it in the list', async ({ page }) => {
    await loginAsTestUser(page);

    // Open reminders screen
    await page.goto('/reminders');
    await expect(page.getByText('Reminders', { exact: true }).last()).toBeVisible();

    // Click Add reminder button
    const addReminderTrigger = page.getByRole('button', { name: 'Add reminder' });
    await addReminderTrigger.click();

    // Verify on Add Reminder screen
    await expect(page).toHaveURL(/\/reminders\/add/);
    await expect(page.getByText('Add Reminder')).toBeVisible();
    await expect(page.getByPlaceholder('e.g. Drink Water, Stand Up, Walk')).toBeVisible();

    // Enter reminder name
    const reminderTitle = 'Drink Fresh Water';
    await page.getByPlaceholder('e.g. Drink Water, Stand Up, Walk').fill(reminderTitle);

    // Click Save
    const saveBtn = page.getByText('Save', { exact: true });
    await saveBtn.click();

    // Should return to /reminders and display the new reminder
    await expect(page).toHaveURL(/\/reminders/);
    await expect(page.getByText(reminderTitle).last()).toBeVisible();
  });
});
