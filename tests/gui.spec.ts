import { test, expect } from '@playwright/test';

test.describe('Smiðr GUI E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Open Smiðr at local development URL
    await page.goto('/');
  });

  test('should support the complete flow: toggle to Design mode, create a new project, and configure editor modes', async ({ page }) => {
    // 1. Verify Smiðr title
    await expect(page).toHaveTitle(/Smiðr/i);

    // 2. Click the "Design" button in the top-right header to enter Design mode
    const designBtn = page.getByRole('button', { name: /Design/i }).first();
    await expect(designBtn).toBeVisible();
    await designBtn.click();

    // 3. Verify the splash page instructs us to open/create a project
    const welcomeHeading = page.getByRole('heading', { name: /Please open a project|プロジェクトを開いてください/i }).first();
    await expect(welcomeHeading).toBeVisible({ timeout: 5000 });

    // 4. Click the "New Project" button (Sparkles icon / New) in the top-left toolbar
    const newProjectBtn = page.locator('button[title*="New"], button[title*="新規"]').first();
    await expect(newProjectBtn).toBeVisible();
    await newProjectBtn.click();

    // 5. Hardware Setup modal should pop up. Locate and click "Confirm & Start Designing"
    const confirmBtn = page.locator('button', { hasText: /Confirm & Start Designing|確定して設計を開始/i }).first();
    await expect(confirmBtn).toBeVisible({ timeout: 5000 });
    await confirmBtn.click();

    // 6. Project is now open! Bottom properties panel should be visible
    const propertiesPanel = page.locator('div', { hasText: /Key Properties|キープロパティ/i }).first();
    await expect(propertiesPanel).toBeVisible({ timeout: 5000 });

    // 7. Click on "Matrix" editor mode in the right-side vertical floating switcher
    const matrixBtn = page.getByRole('button', { name: /マトリックス|Matrix/i }).first();
    await expect(matrixBtn).toBeVisible();
    await matrixBtn.click();

    // 8. Verify the Matrix properties panel is visible at the bottom
    const matrixPanel = page.locator('div', { hasText: /マトリックスプロパティ|Matrix Properties/i }).first();
    await expect(matrixPanel).toBeVisible({ timeout: 5000 });

    // 9. Toggle back to "Layout" mode
    const layoutBtn = page.getByRole('button', { name: /レイアウト|Layout/i }).first();
    await expect(layoutBtn).toBeVisible();
    await layoutBtn.click();

    // 10. Verify that zoom control buttons can be clicked
    const zoomInBtn = page.locator('button[title*="Zoom In"], button[title*="拡大"]').first();
    await expect(zoomInBtn).toBeVisible();
    await expect(zoomInBtn).toBeEnabled();
    await zoomInBtn.click();
  });
});
