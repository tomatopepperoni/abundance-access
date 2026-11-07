import { test, expect, type Page, type Locator } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const widthKey = 'abundance-access:sidebar-width:v1';
const researchKey = 'abundance-access:research:v1';

function resizer(page: Page) {
  return page.getByRole('separator', { name: 'Resize sidebar', exact: true });
}

async function research(page: Page) {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), researchKey);
}

async function aligned(page: Page, width: number) {
  await expect(resizer(page)).toHaveAttribute('aria-valuenow', String(width));
  await expect
    .poll(async () => {
      const sidebar = await page.locator('.sidebar').boundingBox();
      const workspace = await page.locator('.workspace').boundingBox();
      return {
        sidebar: Math.round(sidebar!.width),
        workspaceLeft: Math.round(workspace!.x),
        workspaceRight: Math.round(workspace!.x + workspace!.width),
      };
    })
    .toEqual({ sidebar: width, workspaceLeft: width, workspaceRight: page.viewportSize()!.width });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

async function audit(page: Page) {
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(
    result.violations.map((violation) => ({
      id: violation.id,
      nodes: violation.nodes.map((node) => ({ target: node.target, reason: node.failureSummary })),
    })),
  ).toEqual([]);
}

async function activate(locator: Locator, mobile: boolean) {
  if (mobile) await locator.tap();
  else await locator.click();
}

test('dragging the sidebar edge adjusts the actual layout, persists its width and preserves research notes', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('./#notes');
  const facts = 'Sidebar width changes must preserve this original research draft.';
  await page.getByRole('textbox', { name: 'Observed facts — your notes', exact: true }).fill(facts);
  await expect.poll(async () => (await research(page)).draft.facts).toBe(facts);
  const original = await research(page);
  await aligned(page, 248);
  const edge = resizer(page);
  const bounds = await edge.boundingBox();
  const x = bounds!.x + bounds!.width / 2;
  const y = Math.min(300, bounds!.y + bounds!.height / 2);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 64, y, { steps: 8 });
  await page.mouse.up();
  await aligned(page, 312);
  await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), widthKey)).toBe('312');
  await expect(page.locator('.app-shell')).not.toHaveClass(/is-resizing/);
  expect(await research(page)).toEqual(original);
  await page.reload();
  await aligned(page, 312);
  await expect(
    page.getByRole('textbox', { name: 'Observed facts — your notes', exact: true }),
  ).toHaveValue(facts);
  expect(await research(page)).toEqual(original);
  await audit(page);
});

test('keyboard resizing is bounded, adapts to the viewport and restores the requested width and default', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('./#compare');
  const edge = resizer(page);
  await expect(edge).toHaveAttribute('aria-orientation', 'vertical');
  await expect(edge).toHaveAttribute('aria-valuemin', '208');
  await expect(edge).toHaveAttribute('aria-valuemax', '360');
  await edge.focus();
  await edge.press('End');
  await aligned(page, 360);
  await page.setViewportSize({ width: 820, height: 1000 });
  await expect(edge).toHaveAttribute('aria-valuemax', '300');
  await aligned(page, 300);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await aligned(page, 360);
  await edge.focus();
  await edge.press('Home');
  await aligned(page, 208);
  await edge.press('ArrowLeft');
  await aligned(page, 208);
  await edge.press('ArrowRight');
  await aligned(page, 218);
  await edge.press('ArrowLeft');
  await aligned(page, 208);
  await edge.press('End');
  await edge.press('Enter');
  await aligned(page, 248);
  await expect(edge).toBeFocused();
  expect(await page.evaluate((key) => localStorage.getItem(key), widthKey)).toBeNull();
  await edge.press('ArrowRight');
  await aligned(page, 258);
  await edge.dblclick();
  await aligned(page, 248);
  expect(await page.evaluate((key) => localStorage.getItem(key), widthKey)).toBeNull();
  await page.setViewportSize({ width: 1024, height: 1000 });
  await aligned(page, 220);
  await page.reload();
  await aligned(page, 220);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await aligned(page, 248);
  await audit(page);
});

test('collapsing the desktop sidebar widens the comparison and restores the adjusted width on expand', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('./#compare');
  await resizer(page).press('ArrowRight');
  await aligned(page, 258);
  const sidebar = page.locator('#research-sidebar');
  const workspace = page.locator('#research-workspace');
  const matrix = page.locator('.comparison-matrix-table');
  const expandedWidth = (await matrix.boundingBox())!.width;
  const collapse = page.getByRole('button', { name: 'Collapse sidebar', exact: true });
  const expand = page.getByRole('button', { name: 'Expand sidebar', exact: true });
  await expect(collapse).toHaveAttribute('aria-expanded', 'true');
  await expect(collapse).toHaveAttribute('aria-controls', 'research-sidebar');
  await collapse.click();
  await expect(expand).toHaveAttribute('aria-expanded', 'false');
  await expect(expand).toBeFocused();
  await expect(sidebar).toBeHidden();
  await expect(resizer(page)).toBeHidden();
  await expect
    .poll(async () => {
      const bounds = await workspace.boundingBox();
      return { x: bounds!.x, width: bounds!.width };
    })
    .toEqual({ x: 0, width: 1440 });
  await expect.poll(async () => (await matrix.boundingBox())!.width).toBeGreaterThan(expandedWidth);
  await expect(page.getByTestId('matrix-KOR-IT.NET.USER.ZS')).toHaveText('97.2%');

  await page.setViewportSize({ width: 390, height: 740 });
  await expect(expand).toBeHidden();
  await activate(
    page.getByRole('button', { name: 'Open navigation', exact: true }),
    info.project.name === 'mobile',
  );
  await expect(sidebar).not.toHaveAttribute('inert');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(sidebar).toBeHidden();
  await expect(expand).toBeVisible();
  await expand.press('Enter');
  await expect(collapse).toBeFocused();
  await aligned(page, 258);
});

test('a desktop width preference does not obstruct the mobile menu or comparison and returns when the screen widens', async ({
  page,
}, info) => {
  const mobile = info.project.name === 'mobile';
  await page.addInitScript((key) => localStorage.setItem(key, '360'), widthKey);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('./#compare');
  await aligned(page, 360);
  const original = await research(page);
  await page.setViewportSize({ width: 320, height: 640 });
  await expect(resizer(page)).toHaveCount(0);
  const menu = page.getByRole('button', { name: 'Open navigation', exact: true });
  await activate(menu, mobile);
  const sidebar = page.locator('.sidebar');
  await expect(sidebar).toHaveAttribute('aria-hidden', 'false');
  await expect(sidebar).not.toHaveAttribute('inert');
  const bounds = await sidebar.boundingBox();
  expect(bounds!.x).toBe(0);
  expect(bounds!.width).toBeLessThanOrEqual(280);
  await audit(page);
  await page.keyboard.press('Escape');
  await expect(menu).toBeFocused();
  await expect(sidebar).toHaveAttribute('aria-hidden', 'true');
  await expect(sidebar).toHaveAttribute('inert', '');
  await activate(menu, mobile);
  await activate(page.getByRole('link', { name: 'Compare countries', exact: true }), mobile);
  await expect(page.locator('#main-content')).toBeFocused();
  await expect(resizer(page)).toHaveCount(0);
  await expect(page.getByTestId('mobile-matrix-KOR-IT.NET.USER.ZS')).toBeVisible();
  expect(await research(page)).toEqual(original);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await aligned(page, 360);
});

test('an invalid preference and blocked preference writes leave resizing usable and research storage intact', async ({
  page,
}) => {
  await page.addInitScript((key) => {
    localStorage.setItem(key, 'NaN');
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (name: string, value: string) {
      if (name === key)
        throw new DOMException('Preference storage blocked for test', 'QuotaExceededError');
      originalSetItem.call(this, name, value);
    };
  }, widthKey);
  await page.setViewportSize({ width: 1440, height: 1000 });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('./#notes');
  const facts = 'Research still saves when only the sidebar preference cannot be stored.';
  await page.getByRole('textbox', { name: 'Observed facts — your notes', exact: true }).fill(facts);
  await expect.poll(async () => (await research(page)).draft.facts).toBe(facts);
  const original = await research(page);
  await aligned(page, 248);
  await resizer(page).focus();
  await resizer(page).press('ArrowRight');
  await aligned(page, 258);
  expect(await research(page)).toEqual(original);
  await expect(page.locator('.storage-status')).toContainText('Saved on this device');
  await page.reload();
  await aligned(page, 248);
  await expect(
    page.getByRole('textbox', { name: 'Observed facts — your notes', exact: true }),
  ).toHaveValue(facts);
  expect(await research(page)).toEqual(original);
  expect(errors).toEqual([]);
});
