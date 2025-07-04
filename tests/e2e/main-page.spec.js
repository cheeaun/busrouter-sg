import { test, expect } from '@playwright/test';

test.describe('Main Page', () => {
  test('should load the root page successfully', async ({ page }) => {
    await page.goto('/');
    
    // Check that the page title is correct
    await expect(page).toHaveTitle(/BusRouter SG/);
    
    // Check that the logo is visible
    await expect(page.locator('#logo')).toBeVisible();
    
    // Check that the map container is present
    await expect(page.locator('#map')).toBeVisible();
    
    // Wait for the app to load and render content
    await page.waitForFunction(
      () => {
        const app = document.getElementById('app');
        return app && app.children.length > 0;
      },
      { timeout: 5000 },
    );
    
    // Check for search functionality (main feature of the app)
    await expect(page.locator('input[type="search"]')).toBeVisible();
  });

  test('should load stop page for stop 08057', async ({ page }) => {
    await page.goto('/#/stops/08057');
    
    // Check that the page title is correct
    await expect(page).toHaveTitle(/BusRouter SG/);
    
    // Check that the map container is present
    await expect(page.locator('#map')).toBeVisible();
    
    // Wait for the app to load and render content
    await page.waitForFunction(
      () => {
        const app = document.getElementById('app');
        return app && app.children.length > 0;
      },
      { timeout: 5000 },
    );
    
    // Check that we're on the correct route by looking at the URL hash
    await expect(page).toHaveURL(/#\/stops\/08057/);
    
    // Look for stop-related content
    const hasStopContent = await page.locator('text=/08057|stop|bus|service/i').count();
    expect(hasStopContent).toBeGreaterThan(0);
  });

  test('should load service page for service 133', async ({ page }) => {
    await page.goto('/#/services/133');
    
    // Check that the page title is correct
    await expect(page).toHaveTitle(/BusRouter SG/);
    
    // Check that the map container is present
    await expect(page.locator('#map')).toBeVisible();
    
    // Wait for the app to load and render content
    await page.waitForFunction(
      () => {
        const app = document.getElementById('app');
        return app && app.children.length > 0;
      },
      { timeout: 5000 },
    );
    
    // Check that we're on the correct route by looking at the URL hash
    await expect(page).toHaveURL(/#\/services\/133/);
    
    // Look for service-related content
    const hasServiceContent = await page.locator('text=/133|service|route|bus/i').count();
    expect(hasServiceContent).toBeGreaterThan(0);
  });
});
