import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { snapshotSchema } from '../../src/lib/schema';
import { createStore } from '../../src/lib/query';
import { comparisonSummary } from '../../src/lib/analysis';
import { emptyInvestigation } from '../../src/lib/investigation';
import {
  addDraftNote,
  assignDraftContext,
  attachCalculatedEvidence,
  defaultResearch,
  editDraft,
  hasDraftContent,
  loadResearch,
  removeCalculatedEvidence,
  saveResearch,
  startInvestigation,
  validateResearch,
} from '../../src/lib/research';

const store = createStore(
  snapshotSchema.parse(
    JSON.parse(readFileSync(new URL('../../data/snapshots/latest.json', import.meta.url), 'utf8')),
  ),
);

it('starts a plan with its own context and no fabricated evidence or answered questions', () => {
  const original = defaultResearch(store);
  const data = startInvestigation(original, 'connection-costs', store.snapshot.runId);
  expect(data.draft.investigation).toEqual(emptyInvestigation('connection-costs'));
  expect(data.draft.facts).toBe('');
  expect(data.draft.questions).toBe('');
  expect(data.draft.evidence).toBeUndefined();
  expect(data.draft.context).toEqual({
    selection: original.selection,
    datasetRunId: store.snapshot.runId,
  });
  expect(hasDraftContent(data.draft)).toBe(true);
  expect(validateResearch(data, store.snapshot)).toEqual(data);
});

it('preserves matching draft text, and blocks replacing plans or relabelling conflicting drafts', () => {
  const original = editDraft(
    defaultResearch(store),
    { facts: 'A recorded observation.', questions: 'What local evidence is missing?' },
    store.snapshot.runId,
  );
  const data = startInvestigation(original, 'devices', store.snapshot.runId);
  expect(data.draft.facts).toBe(original.draft.facts);
  expect(data.draft.questions).toBe(original.draft.questions);
  expect(startInvestigation(data, 'power-reliability', store.snapshot.runId)).toBe(data);
  const changed = { ...original, selection: { ...original.selection, year: 2025 } };
  expect(startInvestigation(changed, 'devices', store.snapshot.runId)).toBe(changed);
  const unassigned = { ...original, draft: { ...original.draft, context: null } };
  expect(startInvestigation(unassigned, 'devices', store.snapshot.runId)).toBe(unassigned);
  expect(startInvestigation(original, 'devices', 'another-snapshot')).toBe(original);
});

it('saves and restores a plan-only note without changing its country-year context', () => {
  let data = startInvestigation(defaultResearch(store), 'learning-support', store.snapshot.runId);
  const recordedSelection = structuredClone(data.selection);
  data = editDraft(
    data,
    {
      investigation: {
        ...data.draft.investigation!,
        targetGroup: 'Adult learners in a proposed programme',
        locality: 'Site to be selected',
        evidenceNeeded: 'Interview questions about language and accessibility needs',
        sourceToCheck: 'A local programme partner',
        decisionToInform: 'Which support resources to investigate before choosing delivery',
        status: 'checking',
      },
    },
    store.snapshot.runId,
  );
  data.selection = { countryCodes: ['USA', 'IND'], year: 2025, indicatorCode: 'EG.ELC.ACCS.ZS' };
  const saved = addDraftNote(data, 'plan-note', '2026-11-05T12:00:00Z');
  expect(saved.notes[0].selection).toEqual(recordedSelection);
  expect(saved.notes[0].investigation).toEqual(data.draft.investigation);
  expect(hasDraftContent(saved.draft)).toBe(false);
  let stored = '';
  const storage = {
    getItem: () => stored || null,
    setItem: (_key: string, value: string) => {
      stored = value;
    },
    removeItem: () => {
      stored = '';
    },
  };
  expect(saveResearch(saved, storage, store)).toBe(true);
  expect(loadResearch(store, storage).data).toEqual(saved);
});

it('preserves a plan when calculated evidence is removed and clears an otherwise empty removed plan', () => {
  let data = startInvestigation(defaultResearch(store), 'devices', store.snapshot.runId);
  const evidence = comparisonSummary(store, data.selection);
  data = attachCalculatedEvidence(data, evidence);
  const removed = removeCalculatedEvidence(data);
  expect(removed.draft.investigation).toEqual(data.draft.investigation);
  expect(removed.draft.context).toEqual(data.draft.context);
  expect(editDraft(removed, { investigation: undefined }, store.snapshot.runId).draft).toEqual({
    facts: '',
    questions: '',
    context: null,
  });
});

it('keeps an unassigned plan until context is explicitly assigned and rejects invalid saved plans', () => {
  let data = defaultResearch(store);
  data.selection.countryCodes = [];
  expect(startInvestigation(data, 'devices', store.snapshot.runId)).toBe(data);
  data = editDraft(data, { investigation: emptyInvestigation('devices') }, store.snapshot.runId);
  expect(data.draft.context).toBeNull();
  data.selection.countryCodes = ['KEN'];
  const assigned = assignDraftContext(data, store.snapshot.runId);
  expect(assigned.draft.context?.selection.countryCodes).toEqual(['KEN']);
  for (const invalid of [
    { ...emptyInvestigation('devices'), topic: 'invented' },
    { ...emptyInvestigation('devices'), status: 'proven-by-tool' },
    { ...emptyInvestigation('devices'), locality: 'x'.repeat(301) },
  ])
    expect(() =>
      validateResearch(
        { ...assigned, draft: { ...assigned.draft, investigation: invalid } },
        store.snapshot,
      ),
    ).toThrow();
});

it('continues to restore earlier version-two and version-one notes without adding plan fields', () => {
  const earlier = defaultResearch(store);
  expect(validateResearch(earlier, store.snapshot)).toEqual(earlier);
  const legacy = { ...earlier, schemaVersion: 1, draft: { facts: 'Earlier text', questions: '' } };
  const restored = validateResearch(legacy, store.snapshot);
  expect(restored.draft.investigation).toBeUndefined();
  expect(restored.draft.context).toBeNull();
  expect(restored.draft.facts).toBe('Earlier text');
});
