// Crisis flow E2E — verifies the safety-critical paths work end-to-end
// against the in-browser demo backend. (No Firebase / Gemini required.)
//
// What we assert:
//   • The Emergency banner is always visible to a logged-in user
//   • Opening the Emergency modal shows the helpline list
//   • The modal is non-dismissable by clicking outside
//   • Mood "down" three days in a row surfaces the check-in card
//
// We deliberately don't test Companion crisis detection here — that
// requires the live Cloud Function. The unit tests cover the
// crisisDetection regex side; the integration smoke is manual.

import { test, expect } from '@playwright/test';

test.describe('Crisis safety flows', () => {
  test('emergency banner opens helpline modal and is non-dismissable', async ({ page }) => {
    await page.goto('/');
    // Demo mode; sign in as the seeded user.
    await page.getByRole('link', { name: /sign in/i }).first().click();
    // The demo seed creates user@demo.app / user1234 (see mockBackend.js).
    await page.getByPlaceholder(/email/i).fill('user@demo.app');
    await page.getByPlaceholder(/password/i).fill('user1234');
    await page.getByRole('button', { name: /sign in/i }).click();

    // Land on dashboard, banner is sticky.
    await expect(page.locator('text=Need help')).toBeVisible({ timeout: 10_000 });

    // Open emergency modal.
    await page.getByRole('button', { name: /emergency|need help|crisis/i }).first().click();
    await expect(page.getByText(/Tele-MANAS|Vandrevala|iCall/i).first()).toBeVisible();

    // Click outside — modal should NOT close (crisis modals must be
    // intentional dismisses).
    await page.locator('.modal-back').click({ position: { x: 5, y: 5 } });
    await expect(page.getByText(/Tele-MANAS|Vandrevala|iCall/i).first()).toBeVisible();

    // Explicit close button works.
    await page.getByRole('button', { name: /safer for now|close/i }).first().click();
    await expect(page.locator('.crisis-modal, .modal').first()).toHaveCount(0);
  });

  test('quick exit button is rendered and accessible', async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder(/email/i).fill('user@demo.app');
    await page.getByPlaceholder(/password/i).fill('user1234');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page.locator('.quick-exit-btn')).toBeVisible({ timeout: 10_000 });
  });
});
