import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile, mkdir } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import type { Snapshot } from '../../src/lib/schema';

const snapshot = JSON.parse(
  readFileSync(new URL('../../data/snapshots/latest.json', import.meta.url), 'utf8'),
) as Snapshot;
const storageKey = 'abundance-access:research:v1';
const selected = ['KOR', 'IND', 'KEN'];
const getValue = (countryCode: string, indicatorCode: string, year: number) =>
  snapshot.observations.find(
    (row) =>
      row.countryCode === countryCode && row.indicatorCode === indicatorCode && row.year === year,
  )!.value;
const display = (value: number | null) =>
  value === null
    ? 'No observation'
    : `${new Intl.NumberFormat('en', { maximumFractionDigits: 1 }).format(value)}%`;
const signedDifference = (left: number, right: number) =>
  `${new Intl.NumberFormat('en', { maximumFractionDigits: 1, signDisplay: 'exceptZero' }).format(left - right)} pp`;

async function nav(page: Page, name: string) {
  const menu = page.getByRole('button', { name: 'Open navigation', exact: true });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole('link', { name, exact: true }).click();
}

async function example(page: Page) {
  await page.goto('./#overview');
  await page
    .getByRole('button', { name: 'Try Korea, India and Kenya (2022)', exact: true })
    .click();
}

function sharedHash(patch: Record<string, string> = {}) {
  return `#compare?${new URLSearchParams({
    v: '1',
    countries: 'KOR,IND,KEN',
    year: '2022',
    indicator: 'IT.NET.USER.ZS',
    snapshot: snapshot.runId,
    ...patch,
  })}`;
}

async function download(page: Page, name: string) {
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name, exact: true }).click();
  const path = await (await pending).path();
  return readFile(path!, 'utf8');
}

async function audit(page: Page) {
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(
    result.violations.map((v) => ({ id: v.id, targets: v.nodes.map((node) => node.target) })),
  ).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

test('share links reproduce the exact comparison in a new browser without leaking or replacing private notes', async ({
  page,
  browser,
}, testInfo) => {
  const privateSaved = 'PRIVATE saved research note: investigate local device access.';
  const privateDraft = 'PRIVATE unfinished interpretation: keep the recorded 2022 context.';
  await page.goto('./#notes');
  await page
    .getByRole('textbox', { name: 'Observed facts — your notes', exact: true })
    .fill(privateSaved);
  await page.getByRole('button', { name: 'Add note with recorded context', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Observed facts — your notes', exact: true })
    .fill(privateDraft);
  await nav(page, 'Overview');
  await page
    .getByRole('button', { name: 'Try Korea, India and Kenya (2022)', exact: true })
    .click();
  await page.getByRole('combobox', { name: 'Observation year', exact: true }).selectOption('2021');
  await page
    .getByRole('combobox', { name: 'Chart indicator', exact: true })
    .selectOption('EG.ELC.ACCS.ZS');
  await page.getByRole('button', { name: 'Share this comparison', exact: true }).click();
  const linkInput = page.getByRole('textbox', { name: 'Comparison link', exact: true });
  const link = await linkInput.inputValue();
  await expect(linkInput).toHaveAttribute('readonly', '');
  const url = new URL(link);
  expect(url.pathname).toBe('/abundance-access/');
  const parameters = new URLSearchParams(url.hash.split('?')[1]);
  expect([...parameters.keys()].sort()).toEqual([
    'countries',
    'indicator',
    'snapshot',
    'v',
    'year',
  ]);
  expect(parameters.get('countries')).toBe('KOR,IND,KEN');
  expect(parameters.get('year')).toBe('2021');
  expect(parameters.get('indicator')).toBe('EG.ELC.ACCS.ZS');
  expect(parameters.get('snapshot')).toBe(snapshot.runId);
  expect(link).not.toContain('PRIVATE');
  expect(link).not.toContain('facts');
  expect(link).not.toContain('questions');
  await audit(page);

  const recipientContext = await browser.newContext({
    viewport: testInfo.project.use.viewport,
    isMobile: Boolean(testInfo.project.use.isMobile),
    hasTouch: Boolean(testInfo.project.use.hasTouch),
  });
  try {
    const recipient = await recipientContext.newPage();
    await recipient.goto(link);
    await expect(
      recipient.getByRole('combobox', { name: 'Observation year', exact: true }),
    ).toHaveValue('2021');
    await expect(
      recipient.getByRole('combobox', { name: 'Chart indicator', exact: true }),
    ).toHaveValue('EG.ELC.ACCS.ZS');
    await expect(recipient.locator('.country-chips .country-chip')).toHaveCount(3);
    for (const code of selected) {
      await expect(recipient.getByTestId(`compare-value-${code}`)).toHaveText(
        display(getValue(code, 'EG.ELC.ACCS.ZS', 2021)),
      );
    }
    await recipient.reload();
    await expect(
      recipient.getByRole('combobox', { name: 'Observation year', exact: true }),
    ).toHaveValue('2021');
    await nav(recipient, 'Research notebook');
    await expect(recipient.locator('.saved-note')).toHaveCount(0);
    await expect(
      recipient.getByRole('textbox', { name: 'Observed facts — your notes', exact: true }),
    ).toHaveValue('');
    await audit(recipient);
  } finally {
    await recipientContext.close();
  }

  // Loading an incoming selection in an existing workspace must not relabel its draft.
  await page.goto(link);
  await nav(page, 'Research notebook');
  await expect(
    page.getByRole('textbox', { name: 'Observed facts — your notes', exact: true }),
  ).toHaveValue(privateDraft);
  await expect(page.getByTestId('draft-context')).toHaveText('Internet use · 2022');
  await expect(page.locator('.saved-note')).toHaveCount(1);
  await expect(page.locator('.saved-note')).toContainText(privateSaved);
  await page.reload();
  await expect(
    page.getByRole('textbox', { name: 'Observed facts — your notes', exact: true }),
  ).toHaveValue(privateDraft);
});

test('clipboard rejection leaves a readable keyboard-selectable comparison link', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async () => {
          throw new DOMException('Clipboard blocked', 'NotAllowedError');
        },
      },
    });
  });
  await example(page);
  await page.getByRole('button', { name: 'Share this comparison', exact: true }).click();
  const input = page.getByRole('textbox', { name: 'Comparison link', exact: true });
  const link = await input.inputValue();
  await page.getByRole('button', { name: 'Copy comparison link', exact: true }).click();
  await expect(input).toHaveValue(link);
  await expect(
    page.getByText('Clipboard unavailable. Select and copy the comparison link.', { exact: true }),
  ).toBeVisible();
  await expect(page.getByText('Comparison link copied.', { exact: true })).toHaveCount(0);
  await input.focus();
  await expect(input).toBeFocused();
  expect(new URL(link).hash).toContain('snapshot=');
  await audit(page);
});

test('copy confirmation follows the current selection and edited shared links do not reload stale filters', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async (_value: string) => {} },
    });
  });
  await page.goto(`./${sharedHash()}`);
  await page.getByRole('button', { name: 'Share this comparison', exact: true }).click();
  const input = page.getByRole('textbox', { name: 'Comparison link', exact: true });
  const original = await input.inputValue();
  await page.getByRole('button', { name: 'Copy comparison link', exact: true }).click();
  await expect(page.getByText('Comparison link copied.', { exact: true })).toBeVisible();
  await page.getByRole('combobox', { name: 'Observation year', exact: true }).selectOption('2021');
  await expect(page).toHaveURL(/#compare$/);
  await expect(input).not.toHaveValue(original);
  await expect(page.getByText('Comparison link copied.', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Copy comparison link', exact: true }).click();
  await expect(page.getByText('Comparison link copied.', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('combobox', { name: 'Observation year', exact: true })).toHaveValue(
    '2021',
  );
});

test('complete-year selection and source-linked calculations become a separate persisted evidence note and export', async ({
  page,
}, testInfo) => {
  await example(page);
  await expect(page.getByTestId('comparison-completeness')).toContainText(/9\s*\/\s*9/);
  const year = page.getByRole('combobox', { name: 'Observation year', exact: true });
  await expect(year).toHaveValue('2022');
  const latest = page.getByRole('button', { name: 'Use latest complete year (2023)', exact: true });
  await latest.focus();
  await latest.press('Enter');
  await expect(year).toHaveValue('2023');
  await expect(latest).toBeDisabled();
  await expect(page.getByTestId('comparison-completeness')).toContainText(/9\s*\/\s*9/);
  for (const code of selected) {
    await expect(page.getByTestId(`matrix-${code}-IT.NET.USER.ZS`)).toHaveText(
      display(getValue(code, 'IT.NET.USER.ZS', 2023)),
    );
  }
  const difference = signedDifference(
    getValue('KOR', 'IT.NET.USER.ZS', 2023)!,
    getValue('IND', 'IT.NET.USER.ZS', 2023)!,
  );
  const summary = page.getByRole('region', { name: 'Calculated observations', exact: true });
  await expect(summary.getByTestId('calculated-gap-KOR-IND')).toHaveText(difference);
  await expect(summary).toContainText('percentage points');
  await summary.getByText('Inspect source values and calculation', { exact: true }).click();
  for (const code of selected) {
    const hrefs = await summary
      .getByRole('link')
      .evaluateAll((links) => links.map((link) => (link as HTMLAnchorElement).href));
    expect(
      hrefs.some(
        (href) =>
          href.includes(`/country/${code}/indicator/IT.NET.USER.ZS`) && href.includes('date=2023'),
      ),
    ).toBe(true);
  }
  await page
    .getByRole('button', { name: 'Use calculated observations in notebook', exact: true })
    .click();
  await expect(page).toHaveURL(/#notes$/);
  await expect(page.getByTestId('draft-context')).toHaveText('Internet use · 2023');
  const facts = page.getByRole('textbox', { name: 'Observed facts — your notes', exact: true });
  const questions = page.getByRole('textbox', {
    name: 'Additional research questions',
    exact: true,
  });
  await expect(facts).toHaveValue('');
  await expect(questions).toHaveValue('');
  await expect(page.locator('.notebook-composer')).toContainText(difference);
  await facts.fill('My interpretation requires local evidence before recommending support.');
  await questions.fill('What are connection costs and device access in the intended communities?');
  await page.getByRole('button', { name: 'Add note with recorded context', exact: true }).click();
  const saved = page.locator('.saved-note').first();
  await expect(saved).toContainText('KOR · IND · KEN · 2023');
  await expect(saved).toContainText(difference);
  await expect(saved).toContainText('My interpretation requires local evidence');
  await expect(saved).toContainText('What are connection costs');

  await nav(page, 'Compare countries');
  await page.getByRole('combobox', { name: 'Observation year', exact: true }).selectOption('2025');
  await page
    .getByRole('combobox', { name: 'Chart indicator', exact: true })
    .selectOption('EG.ELC.ACCS.ZS');
  await nav(page, 'Research notebook');
  await page.reload();
  await expect(page.locator('.saved-note').first()).toContainText('KOR · IND · KEN · 2023');
  await expect(page.locator('.saved-note').first()).toContainText(difference);
  await page.getByRole('combobox', { name: 'Export scope', exact: true }).selectOption('workspace');
  const csv = await download(page, 'Export CSV');
  expect(csv).toContain('2025');
  expect(csv).toContain('2023');
  expect(csv).toContain('IT.NET.USER.ZS');
  expect(csv).toContain('"calculated-comparison"');
  expect(csv).toContain('"evidence-observation"');
  expect(csv).toContain('"differencePercentagePoints"');
  expect(csv).toContain(
    String(getValue('KOR', 'IT.NET.USER.ZS', 2023)! - getValue('IND', 'IT.NET.USER.ZS', 2023)!),
  );
  expect(csv).toContain('What are connection costs');
  expect(csv).toContain(snapshot.runId);
  expect(csv).toContain(
    'https://api.worldbank.org/v2/country/KOR/indicator/IT.NET.USER.ZS?date=2023',
  );
  const markdown = await download(page, 'Export Markdown');
  expect(markdown).toContain('Calculated observations');
  expect(markdown).toContain(difference);
  expect(markdown).toContain('User-authored observations');
  expect(markdown).toContain('Additional research questions');
  expect(markdown).toContain('date=2023');
  expect(markdown).toContain('- Selected year: 2025');
  await audit(page);
  await mkdir('reports/screenshots', { recursive: true });
  await page
    .locator('.saved-note')
    .first()
    .screenshot({
      path: `reports/screenshots/${testInfo.project.name}-calculated-evidence-note.png`,
    });
});

test('missing observations are counted and never converted into zero percentage-point differences', async ({
  page,
}) => {
  await example(page);
  await page.getByRole('combobox', { name: 'Observation year', exact: true }).selectOption('2025');
  await expect(page.getByTestId('comparison-completeness')).toContainText(/2\s*\/\s*9/);
  await expect(page.getByRole('combobox', { name: 'Observation year', exact: true })).toHaveValue(
    '2025',
  );
  for (const pair of ['KOR-IND', 'KOR-KEN', 'IND-KEN']) {
    await expect(page.getByTestId(`calculated-gap-${pair}`)).toHaveText('Not calculated');
  }
  await expect(page.getByTestId('compare-value-KOR')).toHaveText('No observation');
  await expect(page.getByTestId('compare-value-IND')).toHaveText('70%');
  await expect(page.getByTestId('compare-value-KEN')).toHaveText('No observation');
  const summary = page.getByRole('region', { name: 'Calculated observations', exact: true });
  await expect(summary).not.toContainText('0.0 pp');
  await page
    .getByRole('combobox', { name: 'Chart indicator', exact: true })
    .selectOption('EG.ELC.ACCS.ZS');
  for (const code of selected)
    await expect(page.getByTestId(`compare-value-${code}`)).toHaveText('No observation');
  await expect(summary.getByTestId('calculated-gap-KOR-IND')).toHaveText('Not calculated');
  await audit(page);
});

test('malformed shared comparisons are rejected without replacing the current selection', async ({
  page,
}) => {
  await page.goto('./#compare');
  await page.getByRole('combobox', { name: 'Observation year', exact: true }).selectOption('2021');
  const invalidLinks: Record<string, string>[] = [
    { countries: 'KOR,ZZZ' },
    { countries: 'KOR,WLD' },
    { countries: 'KEN,KEN' },
    { year: '2030' },
    { indicator: 'invented' },
    { notes: 'not-an-allowed-link-field' },
  ];
  for (const patch of invalidLinks) {
    await page.goto(`./${sharedHash(patch)}`);
    await expect(page.getByRole('alert')).toContainText('Invalid comparison link');
    await expect(page.getByRole('combobox', { name: 'Observation year', exact: true })).toHaveValue(
      '2021',
    );
    await expect(page.locator('.country-chips .country-chip')).toHaveCount(2);
  }
  await page.goto(`./${sharedHash()}&year=2023`);
  await expect(page.getByRole('alert')).toContainText('Invalid comparison link');
  await expect(page.getByRole('combobox', { name: 'Observation year', exact: true })).toHaveValue(
    '2021',
  );
  await audit(page);
});

test('a different snapshot requires an explicit choice rather than silently claiming to reproduce old values', async ({
  page,
}) => {
  await page.goto(
    `./${sharedHash({ snapshot: 'older-unavailable-snapshot', year: '2021', indicator: 'EG.ELC.ACCS.ZS' })}`,
  );
  await expect(page.getByRole('alert')).toContainText('different snapshot');
  await expect(page.getByRole('combobox', { name: 'Observation year', exact: true })).toHaveValue(
    '2022',
  );
  await expect(page.locator('.country-chips .country-chip')).toHaveCount(2);
  await page.getByRole('button', { name: 'Use current snapshot', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Observation year', exact: true })).toHaveValue(
    '2021',
  );
  await expect(page.getByRole('combobox', { name: 'Chart indicator', exact: true })).toHaveValue(
    'EG.ELC.ACCS.ZS',
  );
  await expect(page.locator('.country-chips .country-chip')).toHaveCount(3);
  await expect(page).toHaveURL(/#compare$/);
  await page.reload();
  await expect(page.getByRole('combobox', { name: 'Observation year', exact: true })).toHaveValue(
    '2021',
  );
  await audit(page);
});

test('taking calculated observations never overwrites an unfinished note with a different recorded context', async ({
  page,
}) => {
  const draft = 'Keep my unfinished two-country 2022 note exactly as written.';
  await page.goto('./#notes');
  await page.getByRole('textbox', { name: 'Observed facts — your notes', exact: true }).fill(draft);
  await nav(page, 'Overview');
  await page
    .getByRole('button', { name: 'Try Korea, India and Kenya (2022)', exact: true })
    .click();
  await page.getByRole('combobox', { name: 'Observation year', exact: true }).selectOption('2023');
  const record = page.getByRole('button', {
    name: 'Use calculated observations in notebook',
    exact: true,
  });
  if (await record.isEnabled()) await record.click();
  else await expect(record).toBeDisabled();
  await expect(page).toHaveURL(/#notes$/);
  await expect(page.locator('.notice')).toBeInViewport();
  await expect(
    page.getByText(/Your existing draft has a different recorded context/),
  ).toBeVisible();
  await nav(page, 'Research notebook');
  await expect(
    page.getByRole('textbox', { name: 'Observed facts — your notes', exact: true }),
  ).toHaveValue(draft);
  await expect(page.getByTestId('draft-context')).toHaveText('Internet use · 2022');
  await expect(page.locator('.notebook-composer .panel-heading')).toContainText(
    'Korea, Rep. (KOR)',
  );
  await expect(page.locator('.notebook-composer .panel-heading')).toContainText('Kenya (KEN)');
  await expect(page.locator('.notebook-composer .panel-heading')).not.toContainText('India (IND)');
  await expect(page.locator('.saved-note')).toHaveCount(0);
  const savedState = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    storageKey,
  );
  expect(savedState.draft.facts).toBe(draft);
  expect(savedState.draft.context.selection.countryCodes).toEqual(['KOR', 'KEN']);
  expect(savedState.draft.context.selection.year).toBe(2022);
});
