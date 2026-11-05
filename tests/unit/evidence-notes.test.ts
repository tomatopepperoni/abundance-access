import { readFileSync } from 'node:fs';
import { it, expect } from 'vitest';
import { snapshotSchema } from '../../src/lib/schema';
import { createStore } from '../../src/lib/query';
import { comparisonSummary } from '../../src/lib/analysis';
import {
  addDraftNote,
  attachCalculatedEvidence,
  defaultResearch,
  editDraft,
  hasDraftContent,
  removeCalculatedEvidence,
  validateResearch,
} from '../../src/lib/research';
import { exportCSV, exportMarkdown } from '../../src/lib/export';
const store = createStore(
  snapshotSchema.parse(
    JSON.parse(readFileSync(new URL('../../data/snapshots/latest.json', import.meta.url), 'utf8')),
  ),
);
const summary = comparisonSummary(store, defaultResearch(store).selection);
it('stores readonly evidence separately and preserves matching user-authored text', () => {
  const original = editDraft(
    defaultResearch(store),
    { facts: 'An interpretation to investigate.', questions: 'What local evidence is missing?' },
    store.snapshot.runId,
  );
  const withEvidence = attachCalculatedEvidence(original, summary);
  expect(withEvidence.draft.facts).toBe(original.draft.facts);
  expect(withEvidence.draft.questions).toBe(original.draft.questions);
  expect(validateResearch(withEvidence, store.snapshot)).toEqual(withEvidence);
  expect(removeCalculatedEvidence(withEvidence).draft.facts).toBe(original.draft.facts);
});
it('blocks conflicting and unassigned drafts instead of relabelling or overwriting them', () => {
  const data = editDraft(
    defaultResearch(store),
    { facts: 'Preserve my original research context.' },
    store.snapshot.runId,
  );
  data.selection = { ...data.selection, year: 2025 };
  const different = comparisonSummary(store, data.selection);
  expect(attachCalculatedEvidence(data, different)).toBe(data);
  data.draft.context = null;
  expect(attachCalculatedEvidence(data, different)).toBe(data);
});
it('saves evidence-only notes and keeps recorded values and exports after filters change', () => {
  const draft = attachCalculatedEvidence(defaultResearch(store), summary);
  expect(hasDraftContent(draft.draft)).toBe(true);
  const saved = addDraftNote(draft, 'evidence-note', '2026-11-05T12:00:00Z');
  expect(saved.notes).toHaveLength(1);
  expect(hasDraftContent(saved.draft)).toBe(false);
  saved.selection = { countryCodes: ['USA', 'IND'], indicatorCode: 'EG.ELC.ACCS.ZS', year: 2025 };
  const validated = validateResearch(saved, store.snapshot);
  expect(validated.notes[0].evidence).toEqual(summary);
  const csv = exportCSV(store, validated, 'workspace'),
    md = exportMarkdown(store, validated, 'workspace');
  expect(csv).toContain('"calculated-comparison"');
  expect(csv).toContain('"evidence-observation"');
  expect(csv).toContain('differencePercentagePoints');
  expect(csv).toContain('"rawFile"');
  expect(csv).toContain('"rawRow"');
  expect(csv).toContain('"sourceUpdatedAt"');
  expect(csv).toContain(summary.observations[0].rawFile);
  expect(md).toContain('- Selected year: 2025');
  expect(md).toContain(`year: ${summary.year}`);
  expect(md).toContain(summary.observations[0].sourceUrl);
  expect(md).toContain('User-authored observations');
});
it('rejects saved evidence with a different note context or a tampered current source row', () => {
  const saved = addDraftNote(
    attachCalculatedEvidence(defaultResearch(store), summary),
    'note',
    '2026-11-05T12:00:00Z',
  );
  const wrong = structuredClone(saved);
  wrong.notes[0].selection.year = 2021;
  expect(() => validateResearch(wrong, store.snapshot)).toThrow();
  const tampered = structuredClone(saved);
  tampered.notes[0].evidence!.observations[0].fetchedAt = '2026-01-01T00:00:00Z';
  expect(() => validateResearch(tampered, store.snapshot)).toThrow();
});
