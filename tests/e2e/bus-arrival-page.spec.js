import { test, expect } from '@playwright/test';

test.describe('Bus Arrival Page', () => {
  test('should load bus arrival page for stop 08057', async ({ page }) => {
    await page.goto('/bus-arrival/#08057');

    // Check that the page title contains arrival information
    await expect(page).toHaveTitle(/Bus arrival times/);

    // Check that the arrivals container is present
    await expect(page.locator('#arrivals')).toBeVisible();

    // Wait for the page to load arrival data
    await page.waitForTimeout(3000);

    // Check that we're on the correct route by looking at the URL hash
    await expect(page).toHaveURL(/\/bus-arrival\/#08057/);
  });

  test('should display arrival information', async ({ page }) => {
    await page.goto('/bus-arrival/#08057');

    // Wait for arrival data to load
    await page.waitForTimeout(3000);

    // Check that the arrivals container has content
    const arrivalsContent = page.locator('#arrivals');
    await expect(arrivalsContent).toBeVisible();

    // Check for arrival-related content
    const textContent = await arrivalsContent.textContent();
    expect(textContent).toBeTruthy();
  });
});
