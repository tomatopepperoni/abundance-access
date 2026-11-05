import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';

const key = 'abundance-access:research:v1';
const snapshot = JSON.parse(
  readFileSync(new URL('../../data/snapshots/latest.json', import.meta.url), 'utf8'),
) as { runId: string };

async function nav(page: Page, name: string) {
  const menu = page.getByRole('button', { name: 'Open navigation', exact: true });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole('link', { name, exact: true }).click();
}

async function download(page: Page, name: string) {
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name, exact: true }).click();
  return readFile((await (await pending).path())!, 'utf8');
}

function csvRows(csv: string): Record<string, string>[] {
  // Read the quoted cells in these single-line test records, including escaped quotes.
  const rows = csv
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) =>
      Array.from(line.matchAll(/"((?:[^"]|"")*)"(?:,|$)/g), (match) =>
        match[1].replaceAll('""', '"'),
      ),
    );
  const [headers, ...records] = rows;
  return records.map((cells) => Object.fromEntries(headers.map((header, i) => [header, cells[i]])));
}

async function auditNotes(page: Page) {
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(result.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) }))).toEqual(
    [],
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

test('draft context survives country, year and indicator changes, reload and separate exports', async ({
  page,
}) => {
  const facts = 'Kenya Internet use was 29.4% in 2022; investigate local conditions.';
  await page.goto('./#notes');
  await page.getByRole('textbox', { name: 'Observed facts — your notes', exact: true }).fill(facts);
  await page
    .getByRole('textbox', { name: 'Additional research questions', exact: true })
    .fill('What did connectivity cost in the intended communities?');
  await expect(page.getByTestId('draft-context')).toHaveText('Internet use · 2022');

  await nav(page, 'Compare countries');
  await page.getByRole('combobox', { name: 'Observation year', exact: true }).selectOption('2025');
  await page
    .getByRole('combobox', { name: 'Chart indicator', exact: true })
    .selectOption('EG.ELC.ACCS.ZS');
  await page.getByRole('button', { name: 'Change countries', exact: true }).click();
  await page
    .locator('.country-chips')
    .getByRole('button', { name: 'Remove Korea, Rep.', exact: true })
    .click();
  await page
    .getByRole('textbox', { name: 'Search countries or economies', exact: true })
    .fill('USA');
  await page
    .getByTestId('country-row-USA')
    .getByRole('button', { name: 'Add United States', exact: true })
    .click();
  await page.getByRole('button', { name: 'Compare selected countries', exact: true }).click();
  await nav(page, 'Research notebook');
  await page.reload();

  await expect(page.getByRole('combobox', { name: 'Observation year', exact: true })).toHaveValue(
    '2025',
  );
  await expect(page.getByRole('combobox', { name: 'Indicator', exact: true })).toHaveValue(
    'EG.ELC.ACCS.ZS',
  );
  await expect(page.locator('.country-chips')).toContainText('USA');
  await expect(page.getByTestId('draft-context')).toHaveText('Internet use · 2022');
  await expect(page.locator('.notebook-composer .panel-heading')).toContainText(
    'Korea, Rep. (KOR)',
  );
  await expect(page.locator('.notebook-composer .panel-heading')).toContainText('Kenya (KEN)');
  await expect(page.locator('.draft-context-warning')).toContainText('Your filters changed.');
  await expect(
    page.getByRole('textbox', { name: 'Observed facts — your notes', exact: true }),
  ).toHaveValue(facts);

  await page.getByRole('combobox', { name: 'Export scope', exact: true }).selectOption('workspace');
  const csv = csvRows(await download(page, 'Export CSV'));
  expect(
    csv.find((row) => row.recordType === 'observation' && row.countryCode === 'USA'),
  ).toMatchObject({
    year: '2025',
    datasetRunId: snapshot.runId,
  });
  expect(csv.find((row) => row.recordType === 'draft')).toMatchObject({
    noteCountryCodes: 'KOR;KEN',
    noteYear: '2022',
    noteIndicator: 'IT.NET.USER.ZS',
    noteDatasetRunId: snapshot.runId,
    contextStatus: 'recorded',
    observedFacts: facts,
  });
  const md = await download(page, 'Export Markdown');
  expect(md).toContain('- Selected year: 2025');
  expect(md).toContain('- Focused indicator: EG.ELC.ACCS.ZS');
  expect(md).toContain('Draft countries/economies: KOR, KEN');
  expect(md).toContain('Draft indicator: IT.NET.USER.ZS');
  expect(md).toContain('Draft year: 2022');

  await page.getByRole('button', { name: 'Add note with recorded context', exact: true }).click();
  await expect(page.locator('.saved-note').first()).toContainText('KOR · KEN · 2022');
  await expect(page.locator('.saved-note').first()).toContainText(facts);
  await expect(page.locator('.saved-note').first().getByRole('heading', { level: 3 })).toHaveText(
    'Internet use',
  );
  await page
    .getByRole('textbox', { name: 'Observed facts — your notes', exact: true })
    .fill('A fresh note belongs to the current electricity comparison.');
  await expect(page.getByTestId('draft-context')).toHaveText('Electricity access · 2025');
  await expect(page.locator('.notebook-composer .panel-heading')).toContainText(
    'United States (USA)',
  );
  await page.getByRole('button', { name: 'Add note with recorded context', exact: true }).click();
  await expect(page.locator('.saved-note')).toHaveCount(2);
  await expect(page.locator('.saved-note').first()).toContainText('KEN · USA · 2025');
  await auditNotes(page);
});

test('legacy drafts keep their text and saved notes until their context is explicitly assigned', async ({
  page,
}) => {
  const legacy = {
    schemaVersion: 1,
    selection: { countryCodes: ['KOR', 'KEN'], indicatorCode: 'EG.ELC.ACCS.ZS', year: 2021 },
    search: '',
    region: 'all',
    draft: {
      facts: 'A preserved legacy draft with no recorded context.',
      questions: 'Check the original year.',
    },
    notes: [
      {
        id: 'legacy-note',
        createdAt: '2026-11-04T12:00:00Z',
        datasetRunId: snapshot.runId,
        selection: { countryCodes: ['KEN'], indicatorCode: 'IT.NET.USER.ZS', year: 2020 },
        facts: 'A previously saved observation remains intact.',
        questions: 'Investigate local differences.',
      },
    ],
  };
  await page.addInitScript(
    ({ storageKey, value }) => {
      if (!localStorage.getItem(storageKey))
        localStorage.setItem(storageKey, JSON.stringify(value));
    },
    { storageKey: key, value: legacy },
  );
  await page.goto('./#notes');
  await expect(page.getByTestId('draft-context')).toHaveText('Draft context not assigned');
  await expect(
    page.getByRole('button', { name: 'Add note with recorded context', exact: true }),
  ).toBeDisabled();
  await expect(page.locator('.saved-note')).toHaveCount(1);
  await expect(page.locator('.saved-note')).toContainText('KEN · 2020');
  await page.getByRole('combobox', { name: 'Observation year', exact: true }).selectOption('2023');
  await page.reload();
  await expect(page.getByTestId('draft-context')).toHaveText('Draft context not assigned');
  await expect(
    page.getByRole('textbox', { name: 'Observed facts — your notes', exact: true }),
  ).toHaveValue(legacy.draft.facts);
  await page.getByRole('combobox', { name: 'Export scope', exact: true }).selectOption('workspace');
  const unassigned = csvRows(await download(page, 'Export CSV')).find(
    (row) => row.recordType === 'draft',
  );
  expect(unassigned).toMatchObject({
    contextStatus: 'unassigned',
    noteYear: '',
    noteCountryCodes: '',
    observedFacts: legacy.draft.facts,
  });
  await page
    .getByRole('button', { name: 'Assign current selection to draft', exact: true })
    .click();
  await expect(page.getByTestId('draft-context')).toHaveText('Electricity access · 2023');
  await page.getByRole('button', { name: 'Add note with recorded context', exact: true }).click();
  await expect(page.locator('.saved-note')).toHaveCount(2);
  await expect(page.locator('.saved-note').first()).toContainText('KOR · KEN · 2023');
  await expect(page.locator('.saved-note').first()).toContainText(legacy.draft.facts);
  await expect(page.locator('.saved-note').last()).toContainText(
    'A previously saved observation remains intact.',
  );
  await auditNotes(page);
});

for (const storageFailure of ['get-denied', 'quota'] as const) {
  test(`${storageFailure} shows session-only status consistently while note creation and export still work`, async ({
    page,
  }) => {
    await page.addInitScript((failure) => {
      if (failure === 'get-denied') {
        Object.defineProperty(window, 'localStorage', {
          get() {
            throw new Error('Storage denied for regression test');
          },
        });
      } else {
        Storage.prototype.setItem = function () {
          throw new DOMException('Quota exceeded for regression test', 'QuotaExceededError');
        };
      }
    }, storageFailure);
    await page.goto('./#notes');
    const facts = `A session-only note during ${storageFailure}.`;
    await page
      .getByRole('textbox', { name: 'Observed facts — your notes', exact: true })
      .fill(facts);
    await expect(page.locator('.storage-status')).toContainText(
      'Session only — storage unavailable',
    );
    await expect(page.locator('.note-actions')).toContainText('Session only — storage unavailable');
    await expect(page.locator('.storage-status')).not.toContainText('Saved on this device');
    await expect(page.locator('.note-actions')).not.toContainText('Saved on this device');
    await expect(
      page.getByText('Notes are kept in this session only. Export them before closing this tab.', {
        exact: true,
      }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Add note with recorded context', exact: true }).click();
    await expect(page.locator('.saved-note')).toHaveCount(1);
    await expect(page.locator('.notice')).toContainText('Note added to workspace.');
    await expect(page.locator('.note-actions')).toContainText('Session only — storage unavailable');
    await page.getByRole('combobox', { name: 'Export scope', exact: true }).selectOption('related');
    const exported = csvRows(await download(page, 'Export CSV')).find(
      (row) => row.recordType === 'saved-note',
    );
    expect(exported).toMatchObject({
      observedFacts: facts,
      noteYear: '2022',
      noteCountryCodes: 'KOR;KEN',
      contextStatus: 'recorded',
    });
    await auditNotes(page);
  });
}
