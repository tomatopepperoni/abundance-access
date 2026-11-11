import { test, expect, type Locator, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile, mkdir } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import type { Research } from '../../src/lib/research';
import type { Snapshot } from '../../src/lib/schema';

const snapshot = JSON.parse(
  readFileSync(new URL('../../data/snapshots/latest.json', import.meta.url), 'utf8'),
) as Snapshot;
const key = 'abundance-access:research:v1';

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
async function download(page: Page, name: string) {
  const event = page.waitForEvent('download');
  await page.getByRole('button', { name, exact: true }).click();
  return readFile((await (await event).path())!, 'utf8');
}
async function audit(page: Page) {
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(result.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) }))).toEqual(
    [],
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

test('a comparison becomes a contextual investigation plan, survives reload and exports only by explicit scope', async ({
  page,
}, testInfo) => {
  await example(page);
  const next = page.getByRole('region', { name: 'Choose what to investigate next', exact: true });
  const topic = next.getByRole('button', { name: 'Connection costs', exact: true });
  await topic.focus();
  await topic.press('Enter');
  await expect(page).toHaveURL(/#notes$/);
  await expect(page.getByTestId('draft-context')).toHaveText('Internet use · 2022');
  await expect(page.getByTestId('draft-calculated-evidence')).toContainText('+41.3 pp');
  const plan = page.getByTestId('investigation-plan');
  await expect(
    plan.getByRole('combobox', { name: 'Your investigation status', exact: true }),
  ).toHaveValue('unverified');
  await plan
    .getByRole('textbox', { name: 'Target learners or group', exact: true })
    .fill('Adults considering the proposed free course');
  await plan
    .getByRole('textbox', { name: 'Target locality', exact: true })
    .fill('Candidate Kenyan community — locality to be confirmed');
  await plan
    .getByRole('textbox', { name: 'Evidence to collect', exact: true })
    .fill('Compare course data requirements with local mobile data tariffs.');
  await plan
    .getByRole('textbox', { name: 'Source to check', exact: true })
    .fill('Provider tariffs and interviews with intended learners — not yet collected');
  await plan
    .getByRole('textbox', { name: 'Decision this evidence would inform', exact: true })
    .fill('Whether to investigate an offline course option; no recommendation yet.');
  await plan
    .getByRole('combobox', { name: 'Your investigation status', exact: true })
    .selectOption('checking');
  await audit(page);
  await mkdir('reports/screenshots', { recursive: true });
  await plan.screenshot({
    path: `reports/screenshots/${testInfo.project.name}-investigation-plan.png`,
  });
  await page.reload();
  await expect(
    page.getByRole('textbox', { name: 'Target learners or group', exact: true }),
  ).toHaveValue('Adults considering the proposed free course');
  await page.getByRole('button', { name: 'Add note with recorded context', exact: true }).click();
  const saved = page.locator('.saved-note').first();
  await expect(saved.getByTestId('saved-investigation')).toContainText('Provider tariffs');
  await expect(saved).toContainText('KOR · IND · KEN · 2022');
  await expect(saved).toContainText('In progress');
  await saved.getByText('Inspect source values and calculation', { exact: true }).click();
  await expect(
    saved.getByRole('link', { name: 'Open saved raw response', exact: true }),
  ).toHaveCount(3);
  await nav(page, 'Compare countries');
  await page.getByRole('combobox', { name: 'Observation year', exact: true }).selectOption('2025');
  const scope = page.getByRole('combobox', { name: 'Export scope', exact: true });
  await expect(scope).toHaveValue('comparison');
  const current = await download(page, 'Export CSV');
  expect(current).not.toContain('Provider tariffs');
  expect(current).not.toContain('saved-note');
  expect(current).toContain('"comparison"');
  await scope.selectOption('related');
  expect(await download(page, 'Export Markdown')).not.toContain('Provider tariffs');
  await scope.selectOption('workspace');
  const workspace = await download(page, 'Export CSV');
  expect(workspace).toContain('Provider tariffs');
  expect(workspace).toContain('"2022"');
  expect(workspace).toContain('"checking"');
  expect(workspace).toContain('"investigation-plan"');
  expect(workspace).toContain('/blob/4793ce437ffa71f53217504de3b3ab69132254e7/data/raw/');
  const md = await download(page, 'Export Markdown');
  expect(md).toContain('Entire workspace');
  expect(md).toContain('Candidate Kenyan community');
  expect(md).toContain('not verification by this dashboard');
  await page.getByRole('combobox', { name: 'Observation year', exact: true }).selectOption('2022');
  await scope.selectOption('related');
  expect(await download(page, 'Export CSV')).toContain('Provider tariffs');
  await nav(page, 'Research notebook');
  await page.reload();
  await expect(page.locator('.saved-note')).toHaveCount(1);
  await audit(page);
  await nav(page, 'Overview');
  const menu = page.getByRole('button', { name: 'Open navigation', exact: true });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole('button', { name: 'Reset research workspace', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Reset research workspace?', exact: true })
    .getByRole('button', { name: 'Reset workspace', exact: true })
    .click();
  await nav(page, 'Research notebook');
  await expect(page.locator('.saved-note')).toHaveCount(0);
  await expect(page.getByTestId('investigation-plan')).toHaveCount(0);
});

test('findings stay with the saved investigation and are exported only with its note', async ({
  page,
}, testInfo) => {
  const activate = async (action: Locator) => {
    if (testInfo.project.use.hasTouch) await action.tap();
    else {
      await action.focus();
      await page.keyboard.press('Enter');
    }
  };
  const stored = (): Promise<Research> =>
    page.evaluate((storageKey) => JSON.parse(localStorage.getItem(storageKey)!), key);
  const year = page.getByRole('combobox', { name: 'Observation year', exact: true });
  const locality = 'TEST ONLY Kenyan study site';
  const plannedEvidence = 'TEST ONLY Check mobile data costs for the proposed course';
  const notFound = 'TEST ONLY No relevant tariff record located';
  const findings = {
    status: 'found',
    sourceTitle: 'TEST ONLY Sample provider tariff sheet',
    sourceUrl: 'https://example.invalid/test-only-tariffs',
    checkedOn: '2026-11-06',
    referencePeriod: 'TEST ONLY October 2026',
    locality,
    targetGroup: 'TEST ONLY Adult learners at the study site',
    summary: 'TEST ONLY Sample tariffs were listed per prepaid plan',
    uncertainty: 'TEST ONLY Learner costs still need to be checked',
  };

  await example(page);
  await expect(year).toHaveValue('2022');
  await activate(
    page
      .getByRole('region', { name: 'Choose what to investigate next', exact: true })
      .getByRole('button', { name: 'Connection costs', exact: true }),
  );
  const plan = page.getByTestId('investigation-plan');
  await plan.getByRole('textbox', { name: 'Target locality', exact: true }).fill(locality);
  await plan
    .getByRole('textbox', { name: 'Evidence to collect', exact: true })
    .fill(plannedEvidence);
  await activate(page.getByRole('button', { name: 'Add note with recorded context', exact: true }));
  const saved = page.locator('.saved-note');
  await expect(saved).toHaveCount(1);
  await expect.poll(async () => (await stored()).notes.length).toBe(1);
  const original = (await stored()).notes[0];
  expect(original.selection).toEqual({
    countryCodes: ['KOR', 'IND', 'KEN'],
    indicatorCode: 'IT.NET.USER.ZS',
    year: 2022,
  });
  expect(original.datasetRunId).toBe(snapshot.runId);
  const originalRows = original.selection.countryCodes.map((code) =>
    snapshot.observations.find(
      (row) =>
        row.countryCode === code && row.indicatorCode === 'IT.NET.USER.ZS' && row.year === 2022,
    ),
  );
  expect(original.evidence?.observations).toEqual(originalRows);

  await nav(page, 'Compare countries');
  await year.selectOption('2025');
  await nav(page, 'Research notebook');
  const draftText = 'TEST ONLY Unfinished observation for 2025';
  await page
    .getByRole('textbox', { name: 'Observed facts — your notes', exact: true })
    .fill(draftText);
  await expect.poll(async () => (await stored()).draft.facts).toBe(draftText);
  const draft = (await stored()).draft;
  expect(draft.context?.selection.year).toBe(2025);
  const record = saved.getByRole('button', { name: 'Record findings', exact: true });
  const edit = saved.getByRole('button', { name: 'Edit findings', exact: true });
  const outcome = saved.getByRole('combobox', { name: 'Outcome', exact: true });
  const field = (name: string) => saved.getByLabel(name, { exact: true });
  const summary = saved.getByRole('textbox', { name: 'What you found', exact: true });
  const save = saved.getByRole('button', { name: 'Save findings', exact: true });

  await activate(record);
  await expect(outcome).toBeFocused();
  await expect(
    saved.getByRole('heading', { name: 'Your recorded findings', exact: true }),
  ).toBeVisible();
  await outcome.selectOption({ label: 'Evidence not found' });
  await field('Date checked').fill(findings.checkedOn);
  await summary.fill(notFound);
  await audit(page);
  await activate(save);
  await expect(edit).toBeFocused();
  await expect(saved).toContainText(notFound);
  await expect(saved).toContainText('Evidence not found');

  await activate(edit);
  await expect(outcome).toBeFocused();
  await outcome.selectOption({ label: 'Judgment deferred' });
  await activate(save);
  await expect(saved).toContainText('Judgment deferred');

  await activate(edit);
  await summary.fill('TEST ONLY Uncommitted findings edit');
  await activate(saved.getByRole('button', { name: 'Cancel', exact: true }));
  await expect(edit).toBeFocused();
  await expect(saved).toContainText(notFound);

  await activate(edit);
  await outcome.selectOption({ label: 'Evidence found' });
  await field('Source title or description').fill(findings.sourceTitle);
  await field('Source URL (optional)').fill(findings.sourceUrl);
  await field('Evidence reference period').fill(findings.referencePeriod);
  await field('Locality covered').fill(findings.locality);
  await field('Population covered').fill(findings.targetGroup);
  await summary.fill(findings.summary);
  await field('Remaining uncertainty').fill(findings.uncertainty);
  await activate(save);
  await expect(saved).toContainText(findings.summary);
  await expect.poll(async () => (await stored()).notes).toEqual([{ ...original, findings }]);
  expect((await stored()).draft).toEqual(draft);

  await page.reload();
  await expect(year).toHaveValue('2025');
  await expect(saved).toContainText('KOR · IND · KEN · 2022');
  await expect(saved.getByTestId('saved-investigation')).toContainText(plannedEvidence);
  await expect(saved.getByTestId('saved-investigation')).toContainText(
    'What would a learner pay for enough data to use the course?',
  );
  await expect(
    saved.getByRole('region', { name: 'Calculated observations', exact: true }),
  ).toContainText('World Bank WDI');
  await expect(saved).toContainText(findings.summary);
  await expect(saved).toContainText(findings.uncertainty);
  await expect(saved.locator(`a[href="${findings.sourceUrl}"]`)).toBeVisible();
  expect((await stored()).notes).toEqual([{ ...original, findings }]);
  await audit(page);

  const scope = page.getByRole('combobox', { name: 'Export scope', exact: true });
  await expect(scope).toHaveValue('comparison');
  expect(await download(page, 'Export CSV')).not.toContain(findings.summary);
  await scope.selectOption('related');
  expect(await download(page, 'Export Markdown')).not.toContain(findings.summary);
  await scope.selectOption('workspace');
  const csv = await download(page, 'Export CSV');
  const row = csv.split('\r\n').find((line) => line.startsWith('"investigation-findings"'));
  expect(row).toContain(
    `"${original.id}","${original.createdAt}","KOR;IND;KEN","2022","IT.NET.USER.ZS","${snapshot.runId}"`,
  );
  for (const value of Object.values(findings)) expect(row).toContain(`"${value}"`);
  const md = await download(page, 'Export Markdown');
  expect(md).toContain('### Your recorded findings');
  expect(md).toContain(findings.summary);
  expect(md).toContain(findings.uncertainty);
  expect(md).toContain(plannedEvidence);
  await year.selectOption('2022');
  await scope.selectOption('related');
  expect(await download(page, 'Export CSV')).toContain(findings.summary);
  expect(await download(page, 'Export Markdown')).toContain(findings.summary);
});

test('default and matching exports exclude unrelated saved notes and preview their scope', async ({
  page,
}) => {
  const selection = { countryCodes: ['KOR', 'IND'], year: 2022, indicatorCode: 'IT.NET.USER.ZS' };
  const state = {
    schemaVersion: 2,
    selection,
    search: '',
    region: 'all',
    draft: { facts: '', questions: '', context: null },
    notes: [
      {
        id: 'matching',
        createdAt: '2026-11-05T12:00:00Z',
        datasetRunId: snapshot.runId,
        selection,
        facts: 'MATCHING NOTE',
        questions: '',
      },
      {
        id: 'unrelated',
        createdAt: '2026-11-05T12:00:00Z',
        datasetRunId: snapshot.runId,
        selection: { countryCodes: ['KEN'], year: 2019, indicatorCode: 'EG.ELC.ACCS.ZS' },
        facts: 'UNRELATED KENYA 2019 NOTE',
        questions: '',
      },
    ],
  };
  await page.addInitScript(
    ({ key, state }) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(state));
    },
    { key, state },
  );
  await page.goto('./#compare');
  const scope = page.getByRole('combobox', { name: 'Export scope', exact: true });
  await expect(scope).toHaveValue('comparison');
  const defaults = await download(page, 'Export CSV');
  expect(defaults).not.toContain('MATCHING NOTE');
  expect(defaults).not.toContain('UNRELATED KENYA');
  await scope.selectOption('related');
  await expect(
    page.getByRole('region', { name: 'Choose what to export', exact: true }),
  ).toContainText('1 saved');
  const related = await download(page, 'Export CSV');
  expect(related).toContain('MATCHING NOTE');
  expect(related).not.toContain('UNRELATED KENYA');
  await scope.selectOption('workspace');
  await expect(
    page.getByRole('region', { name: 'Choose what to export', exact: true }),
  ).toContainText('2 saved');
  expect(await download(page, 'Export Markdown')).toContain('UNRELATED KENYA 2019 NOTE');
  await audit(page);
});

test('starting a new investigation preserves a conflicting draft and an existing plan', async ({
  page,
}) => {
  await page.goto('./#notes');
  await page
    .getByRole('textbox', { name: 'Observed facts — your notes', exact: true })
    .fill('Preserve this earlier two-country context.');
  await nav(page, 'Overview');
  await page
    .getByRole('button', { name: 'Try Korea, India and Kenya (2022)', exact: true })
    .click();
  await page
    .getByRole('region', { name: 'Choose what to investigate next', exact: true })
    .getByRole('button', { name: 'Device access', exact: true })
    .click();
  await expect(page).toHaveURL(/#notes$/);
  await expect(page.locator('.notice')).toContainText('preserved');
  await expect(
    page.getByRole('textbox', { name: 'Observed facts — your notes', exact: true }),
  ).toHaveValue('Preserve this earlier two-country context.');
  await expect(page.getByTestId('investigation-plan')).toHaveCount(0);
  await expect(page.getByTestId('draft-context')).toHaveText('Internet use · 2022');
  await expect(page.locator('.notebook-composer .panel-heading')).not.toContainText('India (IND)');
  await page.getByRole('button', { name: 'Return to draft selection', exact: true }).click();
  await page.getByRole('button', { name: 'Connection costs', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Target locality', exact: true })
    .fill('Keep this locality unchanged.');
  await nav(page, 'Compare countries');
  await page
    .getByRole('region', { name: 'Choose what to investigate next', exact: true })
    .getByRole('button', { name: 'Power reliability', exact: true })
    .click();
  await expect(page).toHaveURL(/#notes$/);
  await expect(
    page.getByRole('combobox', { name: 'Access condition to investigate', exact: true }),
  ).toHaveValue('connection-costs');
  await expect(page.getByRole('textbox', { name: 'Target locality', exact: true })).toHaveValue(
    'Keep this locality unchanged.',
  );
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Target locality', exact: true })).toHaveValue(
    'Keep this locality unchanged.',
  );
});

test('comparison distinguishes school proxy and method limits and links a frozen raw response with record index and hash', async ({
  page,
}) => {
  await example(page);
  await expect(page.locator('.measures-panel')).toContainText('Lower secondary completion proxy');
  await expect(page.locator('.comparability-notice')).toContainText('Country-specific');
  const source = page.locator('.source-trail details').first();
  await source.locator('summary').click();
  const link = source.getByRole('link', { name: 'Open saved raw response', exact: true });
  await expect(link).toHaveAttribute(
    'href',
    /\/blob\/4793ce437ffa71f53217504de3b3ab69132254e7\/data\/raw\/2026-11-05T00-19-21-915Z\/observations-IT\.NET\.USER\.ZS-[1-3]\.json$/,
  );
  await expect(source).toContainText('Record index (zero-based)');
  await expect(source.locator('.provenance-hash')).toHaveText(/^[a-f0-9]{64}$/);
  await expect(source).toContainText('not a file line number');
  await expect(
    source.getByRole('link', { name: 'Open observation source', exact: true }),
  ).toHaveAttribute('href', /api\.worldbank\.org/);
  await audit(page);
});
