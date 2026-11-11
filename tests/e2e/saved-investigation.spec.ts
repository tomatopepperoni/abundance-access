import { expect, test, type Locator, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import type { Snapshot } from '../../src/lib/schema';

const snapshot = JSON.parse(
  readFileSync(new URL('../../data/snapshots/latest.json', import.meta.url), 'utf8'),
) as Snapshot;

async function nav(page: Page, name: string) {
  const menu = page.getByRole('button', { name: 'Open navigation', exact: true });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole('link', { name, exact: true }).click();
}

test('resume unfinished findings and export only the original saved investigation', async ({
  page,
}, testInfo) => {
  const activate = async (action: Locator) => {
    if (testInfo.project.use.hasTouch) await action.tap();
    else await action.press('Enter');
  };
  const download = async (action: Locator) => {
    const pending = page.waitForEvent('download');
    await activate(action);
    return readFile((await (await pending).path())!, 'utf8');
  };
  const question = 'TEST ONLY question for the selected 2022 investigation';
  const recorded = 'TEST ONLY recorded findings from the selected note';
  const unfinished = 'TEST ONLY unfinished result should not appear in the exported note';
  const unrelated = 'TEST ONLY unrelated note from the 2025 comparison';
  const privateDraft = 'TEST ONLY private draft for the current comparison';
  const partialUrl = 'https://';
  const year = page.getByRole('combobox', { name: 'Observation year', exact: true });
  const facts = page.getByRole('textbox', { name: 'Observed facts — your notes', exact: true });
  const saveNote = page.getByRole('button', {
    name: 'Add note with recorded context',
    exact: true,
  });

  await page.goto('./#overview');
  await page
    .getByRole('button', { name: 'Try Korea, India and Kenya (2022)', exact: true })
    .click();
  await page.getByRole('button', { name: 'Connection costs', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Additional research questions', exact: true })
    .fill(question);
  await saveNote.click();

  const target = page.locator('.saved-note').filter({ hasText: question });
  const summary = target.getByRole('textbox', { name: 'What you found', exact: true });
  const source = target.getByRole('textbox', { name: 'Source URL (optional)', exact: true });
  const outcome = target.getByRole('combobox', { name: 'Outcome', exact: true });
  const edit = target.getByRole('button', { name: 'Edit findings', exact: true });
  const resume = target.getByRole('button', { name: 'Resume findings', exact: true });
  await activate(target.getByRole('button', { name: 'Record findings', exact: true }));
  await outcome.selectOption('deferred');
  await target.getByLabel('Date checked', { exact: true }).fill('2026-11-06');
  await summary.fill(recorded);
  await activate(target.getByRole('button', { name: 'Save findings', exact: true }));
  await expect(target).toContainText(recorded);

  await activate(edit);
  await summary.fill(unfinished);
  await source.fill(partialUrl);
  await nav(page, 'Compare countries');
  await year.selectOption('2025');
  await nav(page, 'Research notebook');
  await facts.fill(unrelated);
  await saveNote.click();
  await facts.fill(privateDraft);

  await expect(target).toContainText(recorded);
  await activate(resume);
  await expect(outcome).toBeFocused();
  await expect(summary).toHaveValue(unfinished);
  await expect(source).toHaveValue(partialUrl);
  await page.reload();
  await expect(year).toHaveValue('2025');
  await expect(page.locator('.saved-note')).toHaveCount(2);
  await expect(facts).toHaveValue(privateDraft);
  await activate(resume);
  await expect(summary).toHaveValue(unfinished);
  await expect(source).toHaveValue(partialUrl);

  await activate(target.getByText('Export this note', { exact: true }));
  const csv = await download(target.getByRole('button', { name: 'Export note CSV', exact: true }));
  const md = await download(
    target.getByRole('button', { name: 'Export note Markdown', exact: true }),
  );
  expect(csv).toContain('"saved-note","note"');
  expect(csv).toContain('"evidence-observation","note"');
  expect(csv).toContain('"investigation-findings","note"');
  expect(csv.match(/"saved-note","note"/g)).toHaveLength(1);
  expect(md).toContain('Saved note only');
  expect(md).not.toContain('## Current comparison');
  const originalKenya = snapshot.observations.find(
    (row) =>
      row.countryCode === 'KEN' && row.year === 2022 && row.indicatorCode === 'IT.NET.USER.ZS',
  )!;
  for (const content of [csv, md]) {
    expect(content).toContain(question);
    expect(content).toContain(recorded);
    expect(content).toContain('IT.NET.USER.ZS');
    expect(content).toContain(snapshot.runId);
    expect(content).toContain(String(originalKenya.value));
    expect(content).toContain(originalKenya.sourceUrl);
    for (const excluded of [unfinished, unrelated, privateDraft]) {
      expect(content).not.toContain(excluded);
    }
  }
  await expect(year).toHaveValue('2025');
  await activate(target.getByRole('button', { name: 'Cancel', exact: true }));
  await expect(edit).toBeFocused();
  await page.reload();
  await expect(resume).toHaveCount(0);
  await activate(edit);
  await expect(summary).toHaveValue(recorded);
  await expect(source).toHaveValue('');
});
