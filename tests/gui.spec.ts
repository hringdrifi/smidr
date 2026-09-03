import { test, expect } from '@playwright/test';

test.describe('Smiðr GUI E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Open Smiðr at local development URL
    await page.goto('/');
  });

  test('supports the 0.5 project home and hardware workflow', async ({ page }) => {
    // 1. Verify Smiðr title
    await expect(page).toHaveTitle(/Smiðr/i);

    // 2. The project home is the initial entry point.
    const welcomeHeading = page.getByRole('heading', { name: /What would you like to make|何を作りますか/i }).first();
    await expect(welcomeHeading).toBeVisible({ timeout: 5000 });

    // 3. Start a project from the primary card.
    const newProjectBtn = page.getByRole('button', { name: /New project|新規プロジェクト/i }).first();
    await expect(newProjectBtn).toBeVisible();
    await newProjectBtn.click();

    // 4. The setup stays focused, while a preset can create the first layout immediately.
    await page.getByLabel(/Load Preset Layout|プリセットを読み込む/i).selectOption('Corne (42 keys)');

    // 5. Confirm the focused setup and start designing.
    const confirmBtn = page.locator('button', { hasText: /Confirm & Start Designing|確定して設計を開始/i }).first();
    await expect(confirmBtn).toBeVisible({ timeout: 5000 });
    await confirmBtn.click();

    // 5. Open the layout workflow step.
    await page.getByRole('button', { name: /Layout|レイアウト/i }).first().click();
    const layoutOptionsPanel = page.locator('div', { hasText: /Layout Options|レイアウトオプション/i }).first();
    await expect(layoutOptionsPanel).toBeVisible({ timeout: 5000 });

    // 6. Pin settings open as a project-wide dialog.
    await page.getByRole('button', { name: /Pins|ピン設定/i }).first().click();
    await expect(page.getByRole('dialog', { name: /Pins|ピン設定/i })).toBeVisible();
    await page.getByRole('dialog', { name: /Pins|ピン設定/i }).getByRole('button', { name: /Cancel|キャンセル/i }).click();
    await expect(layoutOptionsPanel).toBeVisible();

    // 7. Move to Wiring using the left workflow navigation.
    const matrixBtn = page.getByRole('button', { name: /配線|Wiring/i }).first();
    await expect(matrixBtn).toBeVisible();
    await matrixBtn.click();

    // 8. Verify the wiring inspector is visible.
    const matrixPanel = page.locator('div', { hasText: /キー配線|Key Wiring/i }).first();
    await expect(matrixPanel).toBeVisible({ timeout: 5000 });

    // 9. Toggle back to layout.
    const layoutBtn = page.getByRole('button', { name: /レイアウト|Layout/i }).first();
    await expect(layoutBtn).toBeVisible();
    await layoutBtn.click();

    // 10. Verify that zoom control buttons can be clicked.
    const zoomInBtn = page.locator('button[title*="Zoom In"], button[title*="拡大"]').first();
    await expect(zoomInBtn).toBeVisible();
    await expect(zoomInBtn).toBeEnabled();
    await zoomInBtn.click();

    // 9. Project creation writes a saved baseline in the versioned 0.5 store.
    const projectNameInput = page.getByPlaceholder(/Project Name|プロジェクト名/i);
    const savedName = await projectNameInput.inputValue();
    await expect.poll(() => page.evaluate(() => {
      const projects = JSON.parse(localStorage.getItem('smidr_projects_v0_5') || '[]');
      return { schemaVersion: projects[0]?.schemaVersion, keyCount: projects[0]?.layout?.keys?.length };
    })).toEqual({ schemaVersion: '0.5', keyCount: 42 });

    // 10. Later edits stay out of the saved project and are written to a recovery draft.
    const draftName = `${savedName} Draft`;
    await projectNameInput.fill(draftName);
    await expect.poll(() => page.evaluate(() => {
      const projects = JSON.parse(localStorage.getItem('smidr_projects_v0_5') || '[]');
      const drafts = JSON.parse(localStorage.getItem('smidr_project_drafts_v0_5') || '[]');
      return { savedName: projects[0]?.metadata?.name, draftName: drafts[0]?.project?.metadata?.name };
    })).toEqual({ savedName, draftName });

    // 11. Reopening after a reload offers and restores the unsaved draft.
    await page.reload();
    await expect(page.getByRole('heading', { name: /What would you like to make|何を作りますか/i })).toBeVisible();
    page.once('dialog', dialog => dialog.accept());
    await page.getByText(savedName, { exact: true }).click();
    await expect(page.getByPlaceholder(/Project Name|プロジェクト名/i)).toHaveValue(draftName);
  });

  test('opens hardware and inspector panels as drawers on tablet', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.getByRole('button', { name: /New project|新規プロジェクト/i }).first().click();
    await page.getByRole('button', { name: /Confirm & Start Designing|確認して設計を開始/i }).first().click();

    await expect(page.getByRole('navigation', { name: /Workflow|工程/i })).toBeVisible();
    await page.setViewportSize({ width: 900, height: 768 });
    await page.getByRole('button', { name: /Workflow|工程/i }).click();
    await expect(page.getByRole('navigation', { name: /Workflow|工程/i })).toBeVisible();
  });
});
