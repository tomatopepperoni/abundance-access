import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';

const snapshot = JSON.parse(
  readFileSync(new URL('../../data/snapshots/latest.json', import.meta.url), 'utf8'),
);
const value = (code: string, indicator = 'IT.NET.USER.ZS', year = 2022) => {
  const row = snapshot.observations.find(
    (o: { countryCode: string; indicatorCode: string; year: number }) =>
      o.countryCode === code && o.indicatorCode === indicator && o.year === year,
  );
  return row.value === null
    ? 'No observation'
    : `${new Intl.NumberFormat('en', { maximumFractionDigits: 1 }).format(row.value)}%`;
};
async function find(page: Page, search: string) {
  await page
    .getByRole('searchbox', { name: 'Find a country on the map', exact: true })
    .fill(search);
}
async function audit(page: Page) {
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(
    result.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => ({ target: n.target, reason: n.failureSummary })),
    })),
  ).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

test('a tiny mapped country has full-size search actions, focus zoom, explicit selection and matching data', async ({
  page,
}, testInfo) => {
  await page.goto('./#explore');
  await find(page, 'LUX');
  const row = page.getByTestId('map-finder-LUX');
  await expect(row).toContainText('Shown on the map');
  await expect(page.getByTestId('map-finder-value-LUX')).toHaveText(value('LUX'));
  const show = row.getByRole('button', { name: 'Show Luxembourg on map', exact: true });
  await show.focus();
  await show.press('Enter');
  const map = page.locator('.world-map > svg');
  await expect(map).not.toHaveAttribute('data-zoom', '1');
  await expect(page.locator('.country-shape[data-country="LUX"]')).toBeFocused();
  await expect(page.locator('.country-detail')).toContainText('Luxembourg');
  await expect(page.locator('.country-chips')).not.toContainText('LUX');
  const add = row.getByRole('button', { name: 'Add Luxembourg to comparison', exact: true });
  const bounds = await add.boundingBox();
  expect(bounds!.height).toBeGreaterThanOrEqual(44);
  expect(bounds!.width).toBeGreaterThanOrEqual(44);
  await add.click();
  await expect(page.locator('.country-chips')).toContainText('LUX');
  await expect(page.getByTestId('table-value-LUX')).toHaveText(value('LUX'));
  await expect(page.locator('.country-shape[data-country="LUX"]')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await audit(page);
  await mkdir('reports/screenshots', { recursive: true });
  await page
    .locator('.map-panel')
    .screenshot({ path: `reports/screenshots/${testInfo.project.name}-small-country-map.png` });
  const previous = await map.getAttribute('viewBox');
  await page.getByRole('button', { name: 'Pan map right', exact: true }).click();
  await expect(map).not.toHaveAttribute('viewBox', previous!);
  await page.getByRole('button', { name: 'Reset world view', exact: true }).click();
  await expect(map).toHaveAttribute('data-zoom', '1');
  await expect(page.locator('.country-chips')).toContainText('LUX');
  await page.reload();
  await expect(page.locator('.country-chips')).toContainText('LUX');
  await expect(map).toHaveAttribute('data-zoom', '1');
});

test('an economy absent from the boundary file remains searchable, inspectable and selectable without a fake map shape', async ({
  page,
}) => {
  await page.goto('./#explore');
  await find(page, 'SG');
  const row = page.getByTestId('map-finder-SGP');
  await expect(row).toContainText('Not drawn at this map scale');
  await expect(page.getByTestId('map-finder-value-SGP')).toHaveText(value('SGP'));
  await expect(page.locator('.country-shape[data-country="SGP"]')).toHaveCount(0);
  await row.getByRole('button', { name: 'Inspect Singapore', exact: true }).click();
  const heading = page
    .locator('.country-detail')
    .getByRole('heading', { name: 'Singapore', exact: true });
  await expect(heading).toBeFocused();
  await expect(heading).toBeInViewport();
  await expect(page.getByTestId('inspected-value')).toHaveText(value('SGP'));
  await expect(page.locator('.world-map > svg')).toHaveAttribute('data-zoom', '1');
  await page.locator('.detail-raw-source > summary').click();
  await expect(
    page
      .locator('.country-detail')
      .getByRole('link', { name: 'Open saved raw response', exact: true }),
  ).toHaveAttribute('href', /\/blob\/4793ce437ffa71f53217504de3b3ab69132254e7\/data\/raw\//);
  await row.getByRole('button', { name: 'Add Singapore to comparison', exact: true }).click();
  await expect(page.locator('.country-chips')).toContainText('SGP');
  await expect(page.getByTestId('table-value-SGP')).toHaveText(value('SGP'));
  await audit(page);
});

test('a full comparison can replace a country while keeping map inspection and search available', async ({
  page,
}) => {
  await page.goto('./#explore');
  await find(page, 'SGP');
  await page.getByRole('button', { name: 'Add Singapore to comparison', exact: true }).click();
  await find(page, 'LUX');
  const row = page.getByTestId('map-finder-LUX');
  await expect(
    row.getByRole('button', { name: 'Replace a country with Luxembourg', exact: true }),
  ).toBeEnabled();
  await row.getByRole('button', { name: 'Show Luxembourg on map', exact: true }).click();
  await expect(page.locator('.country-detail')).toContainText('Luxembourg');
  await expect(page.locator('.world-map > svg')).not.toHaveAttribute('data-zoom', '1');
  await expect(page.locator('.country-chips .country-chip')).toHaveCount(3);
  await row.getByRole('button', { name: 'Replace a country with Luxembourg', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Replace Kenya with Luxembourg', exact: true })
    .click();
  await expect(page.locator('.country-chips .country-chip')).toHaveCount(3);
  await expect(
    row.getByRole('button', { name: 'Remove Luxembourg from comparison', exact: true }),
  ).toBeEnabled();
  await page.getByRole('button', { name: 'Clear map country search', exact: true }).click();
  await expect(
    page.getByRole('searchbox', { name: 'Find a country on the map', exact: true }),
  ).toBeFocused();
  await expect(
    page.getByRole('searchbox', { name: 'Find a country on the map', exact: true }),
  ).toHaveValue('');
  await expect(page.locator('.map-finder-result')).toHaveCount(0);
  await audit(page);
});

test('zoom, pan and keyboard navigation preserve missing values, country selection and ordinary page scrolling', async ({
  page,
}) => {
  await page.goto('./#explore');
  await page.getByRole('combobox', { name: 'Observation year', exact: true }).selectOption('2025');
  await page
    .getByRole('combobox', { name: 'Indicator', exact: true })
    .selectOption('EG.ELC.ACCS.ZS');
  await find(page, 'LUX');
  await expect(page.getByTestId('map-finder-value-LUX')).toHaveText('No observation');
  await page.getByRole('button', { name: 'Show Luxembourg on map', exact: true }).click();
  const lux = page.locator('.country-shape[data-country="LUX"]');
  await expect(lux).toHaveAttribute('data-value', 'missing');
  await expect(page.getByTestId('table-value-LUX')).toHaveText('No observation');
  await expect(page.getByTestId('inspected-value')).toHaveText('No observation');
  await lux.press('ArrowRight');
  const focused = page.locator('.country-shape:focus');
  await expect(focused).not.toHaveAttribute('data-country', 'LUX');
  await expect(focused).toBeInViewport();
  const map = page.locator('.world-map > svg');
  await page.getByRole('button', { name: 'Zoom out', exact: true }).click();
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await page.getByRole('button', { name: 'Pan map down', exact: true }).click();
  await page.getByRole('button', { name: 'Reset world view', exact: true }).click();
  await expect(map).toHaveAttribute('data-zoom', '1');
  await expect(page.getByRole('button', { name: 'Zoom out', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Pan map left', exact: true })).toBeDisabled();
  await expect(page.locator('.country-chips .country-chip')).toHaveCount(2);
  await map.scrollIntoViewIfNeeded();
  const box = await map.boundingBox();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  const scrollBefore = await page.evaluate(() => scrollY);
  await page.mouse.wheel(0, 250);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(scrollBefore);
  await expect(map).toHaveAttribute('data-zoom', '1');
  await audit(page);
});

test('mouse wheel zooms around the map pointer and scrolls the page outside the map or at a zoom limit', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Physical mouse wheel interaction');
  await page.goto('./#explore');
  const map = page.locator('.world-map > svg');
  const chips = page.locator('.country-chips .country-chip');
  await expect(chips).toHaveCount(2);
  const selection = await chips.allTextContents();
  const scrollY = () => page.evaluate(() => window.scrollY);
  const hoverMap = async () => {
    await map.scrollIntoViewIfNeeded();
    const box = (await map.boundingBox())!;
    const pointer = {
      x: Math.round(box.x + box.width * 0.67),
      y: Math.round(box.y + box.height * 0.37),
    };
    await page.mouse.move(pointer.x, pointer.y);
    return pointer;
  };

  const pointer = await hoverMap();
  const mapPoint = () =>
    map.evaluate((canvas: SVGSVGElement, { x, y }) => {
      const point = new DOMPoint(x, y).matrixTransform(canvas.getScreenCTM()!.inverse());
      return { x: point.x, y: point.y };
    }, pointer);
  const original = await mapPoint();
  const beforeZoom = await scrollY();
  await page.mouse.wheel(0, -300);
  await expect(map).toHaveAttribute('data-zoom', '2');
  expect(await scrollY()).toBe(beforeZoom);
  const anchored = await mapPoint();
  expect(anchored.x).toBeCloseTo(original.x, 1);
  expect(anchored.y).toBeCloseTo(original.y, 1);
  await page.mouse.wheel(0, 300);
  await expect(map).toHaveAttribute('data-zoom', '1');
  expect(await scrollY()).toBe(beforeZoom);

  await page.locator('.map-navigation').hover();
  const beforeOutside = await scrollY();
  await page.mouse.wheel(0, -180);
  await expect.poll(scrollY).toBeLessThan(beforeOutside);
  await expect(map).toHaveAttribute('data-zoom', '1');

  await hoverMap();
  await page.mouse.wheel(0, -1200);
  await expect(map).toHaveAttribute('data-zoom', '8');
  await expect(page.getByRole('button', { name: 'Zoom in', exact: true })).toBeDisabled();
  const beforeLimit = await scrollY();
  await page.mouse.wheel(0, -180);
  await expect.poll(scrollY).toBeLessThan(beforeLimit);
  await expect(map).toHaveAttribute('data-zoom', '8');
  expect(await chips.allTextContents()).toEqual(selection);
});

test('dragging a zoomed map never changes comparison selection and a table inspection focuses its heading', async ({
  page,
}) => {
  await page.goto('./#explore');
  await find(page, 'KEN');
  await page.getByRole('button', { name: 'Show Kenya on map', exact: true }).click();
  const map = page.locator('.world-map > svg');
  await map.scrollIntoViewIfNeeded();
  const before = await page.locator('.country-chips .country-chip').allTextContents();
  const viewBefore = await map.getAttribute('viewBox');
  const box = await page.locator('.country-shape[data-country="KEN"]').boundingBox();
  const x = box!.x + box!.width / 2,
    y = box!.y + box!.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 45, y + 20, { steps: 8 });
  await page.mouse.up();
  await expect(map).not.toHaveAttribute('viewBox', viewBefore!);
  expect(await page.locator('.country-chips .country-chip').allTextContents()).toEqual(before);
  const afterDrag = await map.getAttribute('viewBox');
  const canvas = await map.boundingBox();
  const edgeY = canvas!.y + canvas!.height / 2;
  await page.mouse.move(canvas!.x + 1, edgeY);
  await page.mouse.down();
  await page.mouse.move(canvas!.x - 1, edgeY);
  await page.mouse.up();
  await page.mouse.move(canvas!.x + canvas!.width / 2, edgeY);
  await expect(map).toHaveAttribute('viewBox', afterDrag!);
  expect(await page.locator('.country-chips .country-chip').allTextContents()).toEqual(before);
  await page.getByRole('button', { name: 'Reset world view', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Search countries or economies', exact: true })
    .fill('CYP');
  await page
    .getByTestId('country-row-CYP')
    .getByRole('button', { name: /Cyprus CYP/ })
    .click();
  await expect(
    page.locator('.country-detail').getByRole('heading', { name: 'Cyprus', exact: true }),
  ).toBeFocused();
  await expect(page.getByTestId('inspected-value')).toHaveText(value('CYP'));
  await audit(page);
});
