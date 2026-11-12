import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir, readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import type { Snapshot } from '../../src/lib/schema';
const snapshot = JSON.parse(
  readFileSync(new URL('../../data/snapshots/latest.json', import.meta.url), 'utf8'),
) as Snapshot;
const key = 'abundance-access:research:v1';
const sourceValue = (code: string, indicator: string, year: number) =>
  snapshot.observations.find(
    (o) => o.countryCode === code && o.indicatorCode === indicator && o.year === year,
  )!.value;
const display = (value: number | null) =>
  value === null
    ? 'No observation'
    : `${new Intl.NumberFormat('en', { maximumFractionDigits: 1 }).format(value)}%`;
async function nav(page: Page, name: string) {
  const menu = page.getByRole('button', { name: 'Open navigation', exact: true });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole('link', { name, exact: true }).click();
}
async function resetDialog(page: Page) {
  const menu = page.getByRole('button', { name: 'Open navigation', exact: true });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole('button', { name: 'Reset research workspace', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Reset research workspace?', exact: true });
  await expect(dialog).toBeVisible();
  return dialog;
}
async function audit(page: Page) {
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(result.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) }))).toEqual(
    [],
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
}

test('clear introduction and example comparison preserve research notes and use readable text', async ({
  page,
}) => {
  await page.goto('./#notes');
  await page
    .getByRole('textbox', { name: 'Observed facts — your notes', exact: true })
    .fill('Follow up on local connectivity before planning support.');
  await page.getByRole('button', { name: 'Add note with recorded context', exact: true }).click();
  await nav(page, 'Overview');
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'Compare countries. Plan what to investigate.',
    }),
  ).toBeVisible();
  const preview = page.getByRole('region', { name: 'Internet use in 2022', exact: true });
  await expect(preview).toContainText('World Bank');
  await expect(preview).toContainText(/Kenya[^?]*\?/);
  for (const code of ['KOR', 'IND', 'KEN']) {
    await expect(
      preview.getByText(display(sourceValue(code, 'IT.NET.USER.ZS', 2022)), { exact: true }),
    ).toBeVisible();
  }
  await expect(page.locator('.start-guide li')).toHaveCount(3);
  await expect(page.locator('.dataset-dots')).toHaveCount(0);
  expect(
    await page.locator('body').evaluate((e) => parseFloat(getComputedStyle(e).fontSize)),
  ).toBeGreaterThanOrEqual(16);
  await audit(page);
  const example = page.getByRole('button', {
    name: 'Try Korea, India and Kenya (2022)',
    exact: true,
  });
  await expect(example).toBeInViewport();
  await example.click();
  await expect(page).toHaveURL(/#compare$/);
  await expect(page.getByRole('combobox', { name: 'Observation year', exact: true })).toHaveValue(
    '2022',
  );
  await expect(page.locator('.country-chips')).toContainText('KOR');
  await expect(page.locator('.country-chips')).toContainText('IND');
  await expect(page.locator('.country-chips')).toContainText('KEN');
  await expect(page.getByTestId('compare-value-IND')).toHaveText('55.9%');
  await expect(page.locator('.comparison-scope')).toContainText('Up to 3 countries');
  await expect(page.locator('.research-guide')).toContainText('not established findings');
  await expect(page.locator('.research-guide')).toContainText('these three indicators only');
  const measures = page.locator('.measures-panel');
  await expect(measures).toContainText('can exceed 100%');
  const followUp = measures.getByRole('region', {
    name: 'Choose what to investigate next',
    exact: true,
  });
  await expect(followUp).toContainText('Starting evidence · Internet use · 2022');
  expect(
    await followUp.evaluate((element) => {
      const comesBefore = (a: Element, b: Element) =>
        Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
      return {
        afterDesktopMatrix: comesBefore(
          document.querySelector('.comparison-matrix-table')!,
          element,
        ),
        afterMobileMatrix: comesBefore(
          document.querySelector('.mobile-comparison-matrix')!,
          element,
        ),
        beforeCoverage: comesBefore(element, document.querySelector('.comparison-completeness')!),
        beforeChart: comesBefore(element, document.querySelector('.same-year')!),
      };
    }),
  ).toEqual({
    afterDesktopMatrix: true,
    afterMobileMatrix: true,
    beforeCoverage: true,
    beforeChart: true,
  });
  const controlSize = await page
    .getByRole('combobox', { name: 'Observation year', exact: true })
    .evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
  expect(controlSize).toBeGreaterThanOrEqual(14);
  const labelSize = await page
    .locator('.filter-fields label>span')
    .first()
    .evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
  expect(labelSize).toBeGreaterThanOrEqual(12);
  await nav(page, 'Research notebook');
  await expect(page.locator('.saved-note')).toContainText('Follow up on local connectivity');
});

test('countries outside the example can be compared while the three-country chart limit is explicit', async ({
  page,
}) => {
  await page.goto('./#overview');
  await page
    .getByRole('button', { name: 'Try Korea, India and Kenya (2022)', exact: true })
    .click();
  await nav(page, 'Country explorer');
  await page
    .getByRole('textbox', { name: 'Search countries or economies', exact: true })
    .fill('USA');
  const replaceUSA = page
    .getByTestId('country-row-USA')
    .getByRole('button', { name: 'Replace a country with United States', exact: true });
  await expect(replaceUSA).toBeEnabled();
  await expect(page.locator('.filter-note')).toContainText('Three countries selected');
  await replaceUSA.click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Replace India with United States', exact: true })
    .click();
  await page.getByRole('button', { name: 'Compare selected countries', exact: true }).click();
  for (const code of ['IT.NET.USER.ZS', 'EG.ELC.ACCS.ZS', 'SE.SEC.CMPT.LO.ZS']) {
    await expect(page.getByTestId(`matrix-USA-${code}`)).toContainText(
      display(sourceValue('USA', code, 2022)),
    );
  }
  await page.locator('.research-guide > summary').click();
  await page
    .getByRole('button', { name: 'Write observations and follow-up questions', exact: true })
    .click();
  await expect(page).toHaveURL(/#notes$/);
  await expect(page.locator('.country-chips')).toContainText('USA');
  await expect(page.getByRole('combobox', { name: 'Observation year', exact: true })).toHaveValue(
    '2022',
  );
  await audit(page);
});

test('comparison starts with data and country changes, and chart selection updates an adjacent visible result', async ({
  page,
}, testInfo) => {
  await page.goto('./#compare');
  const changeCountries = page.getByRole('button', { name: 'Change countries', exact: true });
  await expect(changeCountries).toBeInViewport();
  const matrix = page.locator('.measures-panel');
  const matrixTop = await matrix.evaluate((element) => element.getBoundingClientRect().top);
  expect(matrixTop).toBeLessThan(testInfo.project.name === 'mobile' ? 450 : 400);
  const visibleValue = page.getByTestId(
    `${testInfo.project.name === 'mobile' ? 'mobile-' : ''}matrix-KOR-IT.NET.USER.ZS`,
  );
  await expect(visibleValue).toHaveText('97.2%');
  await expect(visibleValue).toBeInViewport();
  const chartSelect = page.getByRole('combobox', { name: 'Chart indicator', exact: true });
  await chartSelect.scrollIntoViewIfNeeded();
  await chartSelect.selectOption('EG.ELC.ACCS.ZS');
  await expect(page.getByTestId('compare-value-KOR')).toHaveText('100%');
  await expect(page.getByTestId('compare-value-KOR')).toBeInViewport();
  const gap = await page.evaluate(
    () =>
      document.querySelector('.bar-chart')!.getBoundingClientRect().top -
      document.querySelector('.chart-indicator-field select')!.getBoundingClientRect().bottom,
  );
  expect(gap).toBeLessThan(180);
  await chartSelect.focus();
  await chartSelect.press('l');
  await chartSelect.press('Tab');
  await expect(chartSelect).toHaveValue('SE.SEC.CMPT.LO.ZS');
  await expect(page.getByTestId('compare-value-KOR')).toHaveText(
    display(sourceValue('KOR', 'SE.SEC.CMPT.LO.ZS', 2022)),
  );
  await expect(page.locator('.same-year')).toContainText('Lower secondary completion');
  await audit(page);
  await changeCountries.click();
  await expect(page).toHaveURL(/#explore$/);
});

test('real-data country selection → same-year comparison → notebook → exports → restore → reset', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() =>
    localStorage.setItem('abundance-pathways:profile:v1', 'old-project-selection'),
  );
  await page.goto('./#overview');
  await expect(
    page.getByRole('heading', { name: 'Compare countries. Plan what to investigate.' }),
  ).toBeVisible();
  await mkdir('reports/screenshots', { recursive: true });
  await page.screenshot({
    path: `reports/screenshots/${testInfo.project.name}-access-overview.png`,
    fullPage: false,
  });
  await page.getByRole('button', { name: 'Choose other countries', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Search countries or economies', exact: true })
    .fill('India');
  await page
    .getByTestId('country-row-IND')
    .getByRole('button', { name: 'Add India', exact: true })
    .click();
  await expect(page.locator('.country-chips .country-chip')).toHaveCount(3);
  await page.getByRole('combobox', { name: 'Observation year', exact: true }).selectOption('2022');
  await expect(page.getByTestId('table-value-IND')).toHaveText('55.9%');
  await expect(page.locator('[data-country="IND"]')).toHaveAttribute('data-value', '55.9');
  await page
    .locator('.explorer-layout')
    .screenshot({ path: `reports/screenshots/${testInfo.project.name}-access-explorer.png` });
  await page.getByRole('button', { name: 'Compare selected countries', exact: true }).click();
  await expect(page).toHaveURL(/\/abundance-access\/#compare$/);
  const visibleValue = page.getByTestId(
    `${testInfo.project.name === 'mobile' ? 'mobile-' : ''}matrix-KOR-IT.NET.USER.ZS`,
  );
  await expect(visibleValue).toHaveText('97.2%');
  await expect(visibleValue).toBeInViewport();
  await expect(page.getByTestId('compare-value-KEN')).toHaveText('29.4%');
  await expect(page.getByTestId('compare-value-KOR')).toHaveText('97.2%');
  await page.getByRole('combobox', { name: 'Observation year', exact: true }).selectOption('2021');
  await expect(page.getByTestId('compare-value-KEN')).toHaveText(
    display(sourceValue('KEN', 'IT.NET.USER.ZS', 2021)),
  );
  await page.getByRole('combobox', { name: 'Observation year', exact: true }).selectOption('2022');
  await page.getByText('Read annual values as a table', { exact: true }).click();
  await expect(page.locator('.trend-data')).toContainText('2015');
  await audit(page);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await page.screenshot({
    path: `reports/screenshots/${testInfo.project.name}-access-comparison.png`,
    fullPage: false,
  });
  await page.getByRole('button', { name: 'Record observations & questions', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Observed facts — your notes', exact: true })
    .fill('Kenya has a reported Internet-use value of 29.40589905% for 2022.');
  await page
    .getByRole('textbox', { name: 'Additional research questions', exact: true })
    .fill('How does affordability differ between urban and rural learners?');
  await page.getByRole('button', { name: 'Add note with recorded context', exact: true }).click();
  await expect(page.locator('.saved-note')).toHaveCount(1);
  await expect(page.locator('.saved-note')).toContainText('KOR · KEN · IND · 2022');
  await page.getByRole('combobox', { name: 'Export scope', exact: true }).selectOption('related');
  const download1 = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV', exact: true }).click();
  const csv = await readFile((await (await download1).path())!, 'utf8');
  expect(csv).toContain('29.40589905');
  expect(csv).toContain('affordability');
  expect(csv).toContain('https://api.worldbank.org/v2/country/KEN');
  const download2 = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export Markdown', exact: true }).click();
  const md = await readFile((await (await download2).path())!, 'utf8');
  expect(md).toContain('Additional research questions');
  expect(md).toContain('2022');
  expect(md).toContain(snapshot.runId);
  await page.reload();
  await expect(page.locator('.saved-note')).toHaveCount(1);
  await expect(page.getByRole('combobox', { name: 'Observation year', exact: true })).toHaveValue(
    '2022',
  );
  await audit(page);
  const readWorkspace = () => page.evaluate((k) => localStorage.getItem(k), key);
  const original = await readWorkspace();
  expect(original).toContain('29.40589905');
  const dialog = await resetDialog(page);
  await expect(dialog.getByRole('button', { name: 'Cancel', exact: true })).toBeFocused();
  await audit(page);
  await page.keyboard.press('Enter');
  await expect(dialog).toBeHidden();
  expect(await readWorkspace()).toBe(original);
  await resetDialog(page);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(page.locator('.saved-note')).toHaveCount(1);
  expect(await readWorkspace()).toBe(original);

  await resetDialog(page);
  await dialog.getByRole('button', { name: 'Reset workspace', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Compare countries. Plan what to investigate.' }),
  ).toBeVisible();
  await expect.poll(() => page.evaluate((k) => localStorage.getItem(k), key)).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem('abundance-pathways:profile:v1'))).toBe(
    'old-project-selection',
  );
  expect(errors).toEqual([]);
});

test('unreadable workspace stays byte-for-byte intact through browsing and has a download', async ({
  page,
}) => {
  const original = '{\n  "schemaVersion": 999,\n  "privateText": "TEST ONLY: 연구 노트"\n}\n';
  await page.addInitScript(
    ({ storageKey, value }) => {
      if (sessionStorage.getItem('test:unreadable-workspace-seeded')) return;
      localStorage.setItem(storageKey, value);
      sessionStorage.setItem('test:unreadable-workspace-seeded', 'true');
    },
    { storageKey: key, value: original },
  );
  const readWorkspace = () => page.evaluate((k) => localStorage.getItem(k), key);
  const protectedMessage = page.getByText(
    'Your saved workspace could not be read. The original data is preserved in this browser. Changes are kept for this session.',
    { exact: true },
  );
  await page.goto('./#overview');
  await expect(protectedMessage).toBeVisible();
  expect(await readWorkspace()).toBe(original);

  const query = new URLSearchParams({
    v: '1',
    countries: 'KOR,IND,KEN',
    year: '2023',
    indicator: 'IT.NET.USER.ZS',
    snapshot: snapshot.runId,
  });
  await page.goto(`./#compare?${query}`);
  await page.reload();
  const year = page.getByRole('combobox', { name: 'Observation year', exact: true });
  await expect(year).toHaveValue('2023');
  await expect(protectedMessage).toBeVisible();
  expect(await readWorkspace()).toBe(original);
  await year.selectOption('2025');
  await nav(page, 'Research notebook');
  const sessionNote = 'TEST ONLY note created while the original workspace was protected';
  await page
    .getByRole('textbox', { name: 'Observed facts — your notes', exact: true })
    .fill(sessionNote);
  await page.getByRole('button', { name: 'Add note with recorded context', exact: true }).click();
  await expect(page.locator('.saved-note')).toContainText(sessionNote);
  await expect(protectedMessage).toBeVisible();
  expect(await readWorkspace()).toBe(original);

  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download preserved workspace', exact: true }).click();
  expect(await readFile((await (await pending).path())!)).toEqual(Buffer.from(original, 'utf8'));
  await page.reload();
  await expect(protectedMessage).toBeVisible();
  await expect(page.locator('.saved-note')).toHaveCount(0);
  expect(await readWorkspace()).toBe(original);

  const dialog = await resetDialog(page);
  await expect(dialog).toContainText(/original|preserved/i);
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(dialog).toBeHidden();
  expect(await readWorkspace()).toBe(original);
});

test('reset cannot delete an original workspace when reading is blocked', async ({ page }) => {
  const original = 'TEST ONLY saved workspace hidden behind a read failure';
  await page.addInitScript(
    ({ storageKey, value }) => {
      localStorage.setItem(storageKey, value);
      const getItem = Storage.prototype.getItem;
      Storage.prototype.getItem = function (name: string) {
        if (name === storageKey) throw new DOMException('Test read blocked', 'SecurityError');
        return getItem.call(this, name);
      };
    },
    { storageKey: key, value: original },
  );
  const readWorkspace = () => page.evaluate((k) => Reflect.get(localStorage, k), key);
  await page.goto('./#notes');
  await expect(page.locator('.storage-status')).toContainText('Session only');
  await page
    .getByRole('textbox', { name: 'Observed facts — your notes', exact: true })
    .fill('TEST ONLY session note while reading is blocked');
  await page.getByRole('button', { name: 'Add note with recorded context', exact: true }).click();
  await expect(page.locator('.saved-note')).toHaveCount(1);
  expect(await readWorkspace()).toBe(original);
  const dialog = await resetDialog(page);
  await expect(dialog).toContainText(/session/i);
  await dialog.getByRole('button', { name: 'Reset workspace', exact: true }).click();
  await expect(dialog).toBeHidden();
  await nav(page, 'Research notebook');
  await expect(page.locator('.saved-note')).toHaveCount(0);
  expect(await readWorkspace()).toBe(original);
});

test('map and table agree for every mapped country across measures, years and missing values', async ({
  page,
}) => {
  await page.goto('./#explore');
  await expect(
    page.getByRole('heading', { name: 'Choose countries and a year to compare.' }),
  ).toBeVisible();
  for (const indicator of ['IT.NET.USER.ZS', 'EG.ELC.ACCS.ZS', 'SE.SEC.CMPT.LO.ZS']) {
    await page.getByRole('combobox', { name: 'Indicator', exact: true }).selectOption(indicator);
    for (const year of [2022, 2025]) {
      await page
        .getByRole('combobox', { name: 'Observation year', exact: true })
        .selectOption(String(year));
      const values = await page.locator('.country-shape[data-country]').evaluateAll((elements) =>
        elements.map((e) => ({
          code: e.getAttribute('data-country')!,
          value: e.getAttribute('data-value')!,
        })),
      );
      expect(values.length).toBeGreaterThan(150);
      for (const point of values)
        expect(point.value).toBe(
          sourceValue(point.code, indicator, year) === null
            ? 'missing'
            : String(sourceValue(point.code, indicator, year)),
        );
      await page
        .getByRole('textbox', { name: 'Search countries or economies', exact: true })
        .fill('KEN');
      await expect(page.getByTestId('table-value-KEN')).toHaveText(
        display(sourceValue('KEN', indicator, year)),
      );
    }
  }
  await page
    .getByRole('textbox', { name: 'Search countries or economies', exact: true })
    .fill('not-a-country');
  await expect(
    page.getByText('No matching countries or economies.', { exact: true }),
  ).toBeVisible();
  await page
    .getByRole('textbox', { name: 'Search countries or economies', exact: true })
    .fill('KEN');
  await audit(page);
});

test('source definitions, above-100 values, latest-year labels and static subpath reload remain honest', async ({
  page,
}) => {
  await page.goto('./#compare');
  await expect(page.getByRole('heading', { name: 'Compare countries' })).toBeVisible();
  await page
    .getByRole('combobox', { name: 'Chart indicator', exact: true })
    .selectOption('SE.SEC.CMPT.LO.ZS');
  await expect(
    page.getByText(
      'The education completion proxy can exceed 100%. Values are retained as reported.',
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Most recent value for each country' }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByRole('combobox', { name: 'Chart indicator', exact: true })).toHaveValue(
    'SE.SEC.CMPT.LO.ZS',
  );
  await nav(page, 'Sources & methods');
  await expect(
    page.getByRole('heading', { name: 'Data sources, definitions and limitations.' }),
  ).toBeVisible();
  await expect(page.getByText(/It can exceed 100% because entrants/)).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'The same evidence, available to AI tools.' }),
  ).toBeVisible();
  await expect(page.getByText(/He did not create or endorse/)).toBeVisible();
  await audit(page);
});

test('keyboard navigation reaches the menu, map and country selections', async ({
  page,
}, testInfo) => {
  await page.goto('./#explore');
  await expect(
    page.getByRole('heading', { name: 'Choose countries and a year to compare.' }),
  ).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to main content', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main-content')).toBeFocused();
  if (testInfo.project.name === 'mobile') {
    const menu = page.getByRole('button', { name: 'Open navigation', exact: true });
    await menu.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('link', { name: 'Country explorer', exact: true })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Open navigation', exact: true })).toBeFocused();
  }
  const kenya = page.locator('.country-shape[data-country="KEN"]');
  await kenya.focus();
  await expect(kenya).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(kenya).toHaveAttribute('aria-pressed', 'false');
  await page.keyboard.press('ArrowRight');
  expect(await page.locator('.country-shape:focus').getAttribute('data-country')).not.toBe('KEN');
  await page.keyboard.press('Enter');
  await expect(page.locator('.country-chips .country-chip')).toHaveCount(2);
  await audit(page);
});

test('storage denial keeps the dashboard usable and an unavailable snapshot is not replaced with fake data', async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new Error('Storage denied for test');
      },
    }),
  );
  await page.goto('./#overview');
  await expect(page.getByText('Session only — storage unavailable', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Choose other countries', exact: true }).click();
  await page.getByRole('combobox', { name: 'Observation year', exact: true }).selectOption('2025');
  await expect(page.getByRole('combobox', { name: 'Observation year', exact: true })).toHaveValue(
    '2025',
  );
  await page.route('**/assets/latest-*.json', (route) =>
    route.fulfill({ status: 503, body: 'unavailable' }),
  );
  await page.reload();
  await expect(
    page.getByRole('heading', {
      name: 'The statistics snapshot could not be loaded. No substitute values are displayed.',
    }),
  ).toBeVisible();
  await page.unroute('**/assets/latest-*.json');
  await page.getByRole('button', { name: 'Try loading again', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Choose countries and a year to compare.' }),
  ).toBeVisible();
});
