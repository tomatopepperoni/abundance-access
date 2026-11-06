import { test, expect, type Page, type Locator } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
const snapshot = JSON.parse(
  readFileSync(new URL('../../data/snapshots/latest.json', import.meta.url), 'utf8'),
);
const key = 'abundance-access:research:v1';
const value = (code: string, indicator = 'IT.NET.USER.ZS', year = 2022) => {
  const o = snapshot.observations.find(
    (o: { countryCode: string; indicatorCode: string; year: number }) =>
      o.countryCode === code && o.indicatorCode === indicator && o.year === year,
  );
  return o.value === null
    ? 'No observation'
    : `${new Intl.NumberFormat('en', { maximumFractionDigits: 1 }).format(o.value)}%`;
};
async function nav(page: Page, name: string) {
  const menu = page.getByRole('button', { name: 'Open navigation', exact: true });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole('link', { name, exact: true }).click();
}
async function activate(locator: Locator, mobile: boolean) {
  if (mobile) await locator.tap();
  else await locator.click();
}
async function example(page: Page) {
  await page.goto('./#overview');
  await page
    .getByRole('button', { name: 'Try Korea, India and Kenya (2022)', exact: true })
    .click();
}
async function search(page: Page, text: string) {
  await page.getByRole('searchbox', { name: 'Find a country on the map', exact: true }).fill(text);
}
async function codes(page: Page) {
  return page.locator('.country-chips .country-chip .code').allTextContents();
}
async function state(page: Page) {
  return page.evaluate((k) => JSON.parse(localStorage.getItem(k)!), key);
}
async function audit(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(
    r.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => ({ target: n.target, reason: n.failureSummary })),
    })),
  ).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}
async function readableComparison(
  page: Page,
  countries: string[],
  indicator: string,
  year: number,
) {
  const narrow = page.viewportSize()!.width <= 650;
  for (const code of countries) {
    const desktopValue = page.getByTestId(`matrix-${code}-${indicator}`);
    const mobileValue = page.getByTestId(`mobile-matrix-${code}-${indicator}`);
    await expect(desktopValue).toHaveText(value(code, indicator, year));
    if (narrow) {
      await expect(desktopValue).toBeHidden();
      await expect(mobileValue).toBeVisible();
      await expect(mobileValue).toHaveText(value(code, indicator, year));
      const country = snapshot.countries.find(
        (item: { code: string; name: string }) => item.code === code,
      );
      await expect(mobileValue.locator('..').locator('dt')).toHaveText(country.name);
      // Each value must already fit horizontally; scrolling to read it can be vertical only.
      const box = await mobileValue.boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
      await mobileValue.scrollIntoViewIfNeeded();
      await expect(mobileValue).toBeInViewport();
    } else {
      await expect(desktopValue).toBeVisible();
      await expect(mobileValue).toBeHidden();
    }
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}
async function download(page: Page, name: string) {
  const event = page.waitForEvent('download');
  await page.getByRole('button', { name, exact: true }).click();
  return readFile((await (await event).path())!, 'utf8');
}

test('replacing the middle country in a full comparison preserves original notes, filters and recorded evidence', async ({
  page,
}, info) => {
  const mobile = info.project.name === 'mobile';
  await example(page);
  await page
    .getByRole('button', { name: 'Use calculated observations in notebook', exact: true })
    .click();
  await page
    .getByRole('textbox', { name: 'Observed facts — your notes', exact: true })
    .fill('Original three-country evidence, not retagged by later replacement.');
  await page.getByRole('button', { name: 'Add note with recorded context', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Observed facts — your notes', exact: true })
    .fill('Unfinished original comparison draft.');
  await nav(page, 'Country explorer');
  const before = await state(page);
  await search(page, 'SG');
  const row = page.getByTestId('map-finder-SGP');
  await activate(
    row.getByRole('button', { name: 'Replace a country with Singapore', exact: true }),
    mobile,
  );
  const dialog = page.getByRole('dialog', {
    name: 'Replace which country with Singapore?',
    exact: true,
  });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole('button', { name: 'Replace Korea, Rep. with Singapore', exact: true }),
  ).toBeFocused();
  await audit(page);
  await mkdir('reports/screenshots', { recursive: true });
  await page.screenshot({
    path: `reports/screenshots/${info.project.name}-country-replacement.png`,
  });
  const choice = dialog.getByRole('button', { name: 'Replace India with Singapore', exact: true });
  const bounds = await choice.boundingBox();
  expect(bounds!.width).toBeGreaterThanOrEqual(44);
  expect(bounds!.height).toBeGreaterThanOrEqual(44);
  await activate(choice, mobile);
  await expect(dialog).toBeHidden();
  const viewComparison = row.getByRole('button', { name: 'View comparison', exact: true });
  await expect(viewComparison).toBeFocused();
  await expect(viewComparison).toBeInViewport();
  await expect(
    page.getByRole('searchbox', { name: 'Find a country on the map', exact: true }),
  ).not.toBeFocused();
  await expect(row.locator('.map-replace-status')).toHaveText('Replaced India with Singapore.');
  expect(await codes(page)).toEqual(['KOR', 'SGP', 'KEN']);
  await expect
    .poll(async () => (await state(page)).selection.countryCodes)
    .toEqual(['KOR', 'SGP', 'KEN']);
  const after = await state(page);
  expect(after.selection.year).toBe(2022);
  expect(after.selection.indicatorCode).toBe('IT.NET.USER.ZS');
  expect(after.notes).toEqual(before.notes);
  expect(after.draft).toEqual(before.draft);
  await activate(viewComparison, mobile);
  await expect(page.locator('#main-content')).toBeFocused();
  await expect(page.getByTestId('matrix-SGP-IT.NET.USER.ZS')).toHaveText(value('SGP'));
  await page.getByRole('button', { name: 'Share this comparison', exact: true }).click();
  const link = await page
    .getByRole('textbox', { name: 'Comparison link', exact: true })
    .inputValue();
  expect(new URLSearchParams(new URL(link).hash.split('?')[1]).get('countries')).toBe(
    'KOR,SGP,KEN',
  );
  expect(link).not.toContain('Unfinished');
  await page.reload();
  await expect(page.locator('.country-chips .country-chip')).toHaveCount(3);
  expect(await codes(page)).toEqual(['KOR', 'SGP', 'KEN']);
  await nav(page, 'Research notebook');
  await expect(
    page.getByRole('textbox', { name: 'Observed facts — your notes', exact: true }),
  ).toHaveValue('Unfinished original comparison draft.');
  await expect(page.locator('.saved-note')).toContainText('KOR · IND · KEN · 2022');
  await expect(page.locator('.draft-context-warning')).toContainText('Your filters changed');
  await page.getByRole('combobox', { name: 'Export scope', exact: true }).selectOption('related');
  expect(await download(page, 'Export Markdown')).not.toContain('Original three-country evidence');
  await page.getByRole('combobox', { name: 'Export scope', exact: true }).selectOption('workspace');
  expect(await download(page, 'Export Markdown')).toContain('Original three-country evidence');
  await audit(page);
});

test('cancel, Escape and changing the search preserve selection; two-country replacement does not add a third', async ({
  page,
}, info) => {
  const mobile = info.project.name === 'mobile';
  await page.goto('./#explore');
  await search(page, 'LUX');
  const before = await state(page);
  const trigger = page
    .getByTestId('map-finder-LUX')
    .getByRole('button', { name: 'Replace a country with Luxembourg', exact: true });
  await trigger.focus();
  await trigger.press('Enter');
  let dialog = page.getByRole('dialog', {
    name: 'Replace which country with Luxembourg?',
    exact: true,
  });
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  expect(await state(page)).toEqual(before);
  await activate(trigger, mobile);
  await activate(dialog.getByRole('button', { name: 'Cancel replacement', exact: true }), mobile);
  await expect(trigger).toBeFocused();
  expect(await state(page)).toEqual(before);
  await search(page, 'CYP');
  await expect(page.getByTestId('map-finder-LUX')).toHaveCount(0);
  await activate(
    page
      .getByTestId('map-finder-CYP')
      .getByRole('button', { name: 'Replace a country with Cyprus', exact: true }),
    mobile,
  );
  dialog = page.getByRole('dialog', { name: 'Replace which country with Cyprus?', exact: true });
  await activate(
    dialog.getByRole('button', { name: 'Replace Kenya with Cyprus', exact: true }),
    mobile,
  );
  expect(await codes(page)).toEqual(['KOR', 'CYP']);
  await search(page, 'KOR');
  await expect(
    page.getByTestId('map-finder-KOR').getByRole('button', { name: /Replace a country/ }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Clear countries', exact: true }).click();
  await search(page, 'SGP');
  await expect(
    page.getByRole('button', { name: 'Add Singapore to comparison', exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByTestId('map-finder-SGP').getByRole('button', { name: /Replace a country/ }),
  ).toHaveCount(0);
  await audit(page);
});

test('search table and country details use the same replacement without removing a country first', async ({
  page,
}, info) => {
  const mobile = info.project.name === 'mobile';
  await example(page);
  await nav(page, 'Country explorer');
  await page
    .getByRole('textbox', { name: 'Search countries or economies', exact: true })
    .fill('LUX');
  const row = page.getByTestId('country-row-LUX');
  await expect(row.getByRole('button', { name: /Luxembourg LUX/ })).toBeVisible();
  await activate(
    row.getByRole('button', { name: 'Replace a country with Luxembourg', exact: true }),
    mobile,
  );
  await activate(
    page
      .getByRole('dialog')
      .getByRole('button', { name: 'Replace Korea, Rep. with Luxembourg', exact: true }),
    mobile,
  );
  expect(await codes(page)).toEqual(['LUX', 'IND', 'KEN']);
  await expect(row.getByRole('button', { name: 'View comparison', exact: true })).toBeFocused();
  await expect(
    page.locator('.country-detail').getByRole('heading', { name: 'Luxembourg', exact: true }),
  ).toBeVisible();
  await search(page, 'SGP');
  await activate(
    page
      .getByTestId('map-finder-SGP')
      .getByRole('button', { name: 'Inspect Singapore', exact: true }),
    mobile,
  );
  const detail = page.locator('.country-detail');
  await activate(
    detail.getByRole('button', { name: 'Replace a country with Singapore', exact: true }),
    mobile,
  );
  await activate(
    page
      .getByRole('dialog')
      .getByRole('button', { name: 'Replace Kenya with Singapore', exact: true }),
    mobile,
  );
  expect(await codes(page)).toEqual(['LUX', 'IND', 'SGP']);
  await expect(detail.getByRole('button', { name: 'View comparison', exact: true })).toBeFocused();
  await expect(page.locator('.country-shape[data-country="SGP"]')).toHaveCount(0);
  await audit(page);
});

test('replacement dialog keeps keyboard focus inside and fits a mobile viewport without changing missing data', async ({
  page,
}, info) => {
  const mobile = info.project.name === 'mobile';
  await example(page);
  await nav(page, 'Country explorer');
  await page.getByRole('combobox', { name: 'Observation year', exact: true }).selectOption('2025');
  await page
    .getByRole('combobox', { name: 'Indicator', exact: true })
    .selectOption('EG.ELC.ACCS.ZS');
  await search(page, 'LUX');
  await activate(
    page
      .getByTestId('map-finder-LUX')
      .getByRole('button', { name: 'Replace a country with Luxembourg', exact: true }),
    mobile,
  );
  const dialog = page.getByRole('dialog');
  const cancel = dialog.getByRole('button', { name: 'Cancel replacement', exact: true });
  await cancel.focus();
  await cancel.press('Tab');
  await expect(
    dialog.getByRole('button', { name: 'Replace Korea, Rep. with Luxembourg', exact: true }),
  ).toBeFocused();
  const rect = await dialog.boundingBox();
  const viewport = page.viewportSize()!;
  expect(rect!.width).toBeLessThanOrEqual(viewport.width - 30);
  expect(rect!.height).toBeLessThanOrEqual(viewport.height - 30);
  await audit(page);
  await activate(
    dialog.getByRole('button', { name: 'Replace Kenya with Luxembourg', exact: true }),
    mobile,
  );
  expect(await codes(page)).toEqual(['KOR', 'IND', 'LUX']);
  await expect(page.getByRole('combobox', { name: 'Observation year', exact: true })).toHaveValue(
    '2025',
  );
  await expect(page.getByRole('combobox', { name: 'Indicator', exact: true })).toHaveValue(
    'EG.ELC.ACCS.ZS',
  );
  await expect(page.getByTestId('map-finder-value-LUX')).toHaveText('No observation');
  await activate(
    page
      .getByTestId('map-finder-LUX')
      .getByRole('button', { name: 'View comparison', exact: true }),
    mobile,
  );
  await expect(page.getByTestId('matrix-LUX-EG.ELC.ACCS.ZS')).toHaveText('No observation');
  await audit(page);
});

test('changing countries leads directly to search and replacement leads to visible same-year comparison without opening navigation', async ({
  page,
}, info) => {
  const mobile = info.project.name === 'mobile';
  await example(page);
  await activate(page.getByRole('button', { name: 'Change countries', exact: true }), mobile);
  const input = page.getByRole('searchbox', { name: 'Find a country on the map', exact: true });
  await expect(input).toBeFocused();
  await expect(input).toBeInViewport();
  await search(page, 'SGP');
  const row = page.getByTestId('map-finder-SGP');
  await activate(
    row.getByRole('button', { name: 'Replace a country with Singapore', exact: true }),
    mobile,
  );
  await activate(
    page
      .getByRole('dialog')
      .getByRole('button', { name: 'Replace India with Singapore', exact: true }),
    mobile,
  );
  const next = row.getByRole('button', { name: 'View comparison', exact: true });
  await expect(next).toBeFocused();
  await expect(next).toBeInViewport();
  await expect(input).not.toBeFocused();
  const target = await next.boundingBox();
  expect(target!.height).toBeGreaterThanOrEqual(44);
  expect(target!.width).toBeGreaterThanOrEqual(44);
  await expect(page).toHaveURL(/#explore$/);
  await expect(
    page.locator('.country-detail').getByRole('heading', { name: 'Singapore', exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId('inspected-value')).toHaveText(value('SGP'));
  expect((await state(page)).selection).toEqual({
    countryCodes: ['KOR', 'SGP', 'KEN'],
    year: 2022,
    indicatorCode: 'IT.NET.USER.ZS',
  });
  await audit(page);
  await mkdir('reports/screenshots', { recursive: true });
  await page.screenshot({
    path: `reports/screenshots/${info.project.name}-replacement-next-step.png`,
  });
  await activate(next, mobile);
  await expect(page).toHaveURL(/#compare$/);
  await expect(page.locator('#main-content')).toBeFocused();
  await expect(page.getByTestId('matrix-SGP-IT.NET.USER.ZS')).toHaveText(value('SGP'));
  await expect(page.getByRole('combobox', { name: 'Observation year', exact: true })).toHaveValue(
    '2022',
  );
  await expect(
    page.getByRole('heading', { name: 'Internet use · 2022', exact: true }),
  ).toBeVisible();
  expect(await codes(page)).toEqual(['KOR', 'SGP', 'KEN']);
  await readableComparison(page, ['KOR', 'SGP', 'KEN'], 'IT.NET.USER.ZS', 2022);
  await audit(page);
});

test('a narrow screen supports cancel and consecutive replacements before viewing unchanged missing-data context', async ({
  page,
}, info) => {
  const mobile = info.project.name === 'mobile';
  await page.setViewportSize({ width: 320, height: 640 });
  await example(page);
  await page.getByRole('combobox', { name: 'Observation year', exact: true }).selectOption('2025');
  await page
    .getByRole('combobox', { name: 'Chart indicator', exact: true })
    .selectOption('EG.ELC.ACCS.ZS');
  await activate(page.getByRole('button', { name: 'Change countries', exact: true }), mobile);
  const input = page.getByRole('searchbox', { name: 'Find a country on the map', exact: true });
  await expect(input).toBeFocused();
  await expect(input).toBeInViewport();
  await search(page, 'LUX');
  let row = page.getByTestId('map-finder-LUX');
  const trigger = row.getByRole('button', {
    name: 'Replace a country with Luxembourg',
    exact: true,
  });
  const beforeCancel = await state(page);
  await activate(trigger, mobile);
  let dialog = page.getByRole('dialog');
  const dialogBox = await dialog.boundingBox();
  expect(dialogBox!.width).toBeLessThanOrEqual(290);
  expect(dialogBox!.height).toBeLessThanOrEqual(610);
  await activate(dialog.getByRole('button', { name: 'Cancel replacement', exact: true }), mobile);
  await expect(trigger).toBeFocused();
  expect(await state(page)).toEqual(beforeCancel);
  await activate(trigger, mobile);
  await activate(
    page
      .getByRole('dialog')
      .getByRole('button', { name: 'Replace Kenya with Luxembourg', exact: true }),
    mobile,
  );
  await expect(row.getByRole('button', { name: 'View comparison', exact: true })).toBeFocused();
  await expect(input).not.toBeFocused();
  await expect(page).toHaveURL(/#explore$/);
  expect(await codes(page)).toEqual(['KOR', 'IND', 'LUX']);
  await search(page, 'CYP');
  row = page.getByTestId('map-finder-CYP');
  await activate(
    row.getByRole('button', { name: 'Replace a country with Cyprus', exact: true }),
    mobile,
  );
  dialog = page.getByRole('dialog');
  await activate(
    dialog.getByRole('button', { name: 'Replace Luxembourg with Cyprus', exact: true }),
    mobile,
  );
  const next = row.getByRole('button', { name: 'View comparison', exact: true });
  await expect(next).toBeFocused();
  await expect(next).toBeInViewport();
  await expect(input).not.toBeFocused();
  await expect(
    page.locator('.country-detail').getByRole('heading', { name: 'Cyprus', exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId('map-finder-value-CYP')).toHaveText('No observation');
  expect((await state(page)).selection).toEqual({
    countryCodes: ['KOR', 'IND', 'CYP'],
    year: 2025,
    indicatorCode: 'EG.ELC.ACCS.ZS',
  });
  await audit(page);
  await activate(next, mobile);
  await expect(page).toHaveURL(/#compare$/);
  await expect(page.locator('#main-content')).toBeFocused();
  await expect(page.getByTestId('matrix-CYP-EG.ELC.ACCS.ZS')).toHaveText('No observation');
  await expect(page.getByRole('combobox', { name: 'Observation year', exact: true })).toHaveValue(
    '2025',
  );
  await expect(page.getByRole('combobox', { name: 'Chart indicator', exact: true })).toHaveValue(
    'EG.ELC.ACCS.ZS',
  );
  await readableComparison(page, ['KOR', 'IND', 'CYP'], 'EG.ELC.ACCS.ZS', 2025);
  await audit(page);
});
