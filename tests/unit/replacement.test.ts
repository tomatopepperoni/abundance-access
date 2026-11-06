import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { snapshotSchema } from '../../src/lib/schema';
import { createStore } from '../../src/lib/query';
import { comparisonSummary } from '../../src/lib/analysis';
import { exportSelection } from '../../src/lib/export';
import {
  addDraftNote,
  attachCalculatedEvidence,
  defaultResearch,
  editDraft,
  replaceComparisonCountry,
  startInvestigation,
  validateResearch,
} from '../../src/lib/research';

const store = createStore(
  snapshotSchema.parse(
    JSON.parse(readFileSync(new URL('../../data/snapshots/latest.json', import.meta.url), 'utf8')),
  ),
);

it('replaces one of two selected countries without an intermediate removal or filter changes', () => {
  const original = defaultResearch(store);
  original.selection.year = 2025;
  original.selection.indicatorCode = 'EG.ELC.ACCS.ZS';
  Object.freeze(original.selection.countryCodes);
  Object.freeze(original.selection);
  const next = replaceComparisonCountry(original, 'KEN', 'IND', store.snapshot);
  expect(next).not.toBe(original);
  expect(next.selection).toEqual({
    countryCodes: ['KOR', 'IND'],
    year: 2025,
    indicatorCode: 'EG.ELC.ACCS.ZS',
  });
  expect(original.selection.countryCodes).toEqual(['KOR', 'KEN']);
  expect(next.draft).toBe(original.draft);
  expect(next.notes).toBe(original.notes);
  expect(next.search).toBe(original.search);
  expect(next.region).toBe(original.region);
});

it('keeps all three slots and the original slot order when a full comparison is replaced', () => {
  const original = defaultResearch(store);
  original.selection.countryCodes = ['KOR', 'IND', 'KEN'];
  const next = replaceComparisonCountry(original, 'IND', 'LUX', store.snapshot);
  expect(next.selection.countryCodes).toEqual(['KOR', 'LUX', 'KEN']);
  expect(next.selection.countryCodes).toHaveLength(3);
  expect(validateResearch(next, store.snapshot)).toEqual(next);
});

it('allows a registered country without a map boundary and a one-country selection', () => {
  const original = defaultResearch(store);
  original.selection.countryCodes = ['KEN'];
  const next = replaceComparisonCountry(original, 'KEN', 'SGP', store.snapshot);
  expect(next.selection.countryCodes).toEqual(['SGP']);
  expect(validateResearch(next, store.snapshot)).toEqual(next);
});

it('rejects stale, already selected, aggregate, invalid and unchanged choices without altering state', () => {
  const original = defaultResearch(store);
  for (const [oldCode, newCode] of [
    ['IND', 'LUX'],
    ['KOR', 'KEN'],
    ['KOR', 'KOR'],
    ['KOR', 'WLD'],
    ['WLD', 'LUX'],
    ['KOR', 'ZZZ'],
    ['ZZZ', 'LUX'],
    ['KOR', 'sgp'],
  ])
    expect(replaceComparisonCountry(original, oldCode, newCode, store.snapshot)).toBe(original);
});

it('does not apply a replacement to an invalid, empty or over-limit existing selection', () => {
  for (const countryCodes of [[], ['KOR', 'KOR'], ['KOR', 'ZZZ'], ['KOR', 'IND', 'KEN', 'LUX']]) {
    const original = defaultResearch(store);
    original.selection.countryCodes = countryCodes;
    expect(replaceComparisonCountry(original, 'KOR', 'SGP', store.snapshot)).toBe(original);
  }
});

it('preserves recorded drafts, plans, source evidence and matching-export context after a replacement', () => {
  let original = startInvestigation(defaultResearch(store), 'devices', store.snapshot.runId);
  original = attachCalculatedEvidence(original, comparisonSummary(store, original.selection));
  original = editDraft(
    original,
    { facts: 'Keep the original country context.' },
    store.snapshot.runId,
  );
  original = addDraftNote(original, 'recorded-note', '2026-11-06T12:00:00Z');
  original = startInvestigation(original, 'connection-costs', store.snapshot.runId);
  original = attachCalculatedEvidence(original, comparisonSummary(store, original.selection));
  original = editDraft(
    original,
    { questions: 'Keep this unfinished investigation.' },
    store.snapshot.runId,
  );
  expect(exportSelection(store, original, 'related').notes).toHaveLength(1);
  expect(exportSelection(store, original, 'related').draft).toBe(original.draft);

  const next = replaceComparisonCountry(original, 'KEN', 'SGP', store.snapshot);
  expect(next.draft).toBe(original.draft);
  expect(next.draft.context).toBe(original.draft.context);
  expect(next.draft.investigation).toBe(original.draft.investigation);
  expect(next.draft.evidence).toBe(original.draft.evidence);
  expect(next.notes).toBe(original.notes);
  expect(next.notes[0].selection.countryCodes).toEqual(['KOR', 'KEN']);
  expect(next.draft.context?.selection.countryCodes).toEqual(['KOR', 'KEN']);
  expect(exportSelection(store, next, 'related')).toMatchObject({ draft: null, notes: [] });
  expect(exportSelection(store, next, 'workspace').notes).toBe(original.notes);
  expect(validateResearch(next, store.snapshot)).toEqual(next);

  const restored = replaceComparisonCountry(next, 'SGP', 'KEN', store.snapshot);
  expect(exportSelection(store, restored, 'related').notes).toHaveLength(1);
  expect(exportSelection(store, restored, 'related').draft).toBe(original.draft);
});
