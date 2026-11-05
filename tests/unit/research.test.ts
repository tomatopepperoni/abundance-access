import { readFileSync } from 'node:fs';
import { it, expect } from 'vitest';
import { snapshotSchema } from '../../src/lib/schema';
import { createStore } from '../../src/lib/query';
import {
  defaultResearch,
  loadResearch,
  saveResearch,
  resetResearch,
  validateResearch,
  STORAGE_KEY,
  editDraft,
  addDraftNote,
  assignDraftContext,
} from '../../src/lib/research';
import { csvCell, exportCSV, exportMarkdown } from '../../src/lib/export';
const store = createStore(
  snapshotSchema.parse(
    JSON.parse(readFileSync(new URL('../../data/snapshots/latest.json', import.meta.url), 'utf8')),
  ),
);
function memory() {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (k: string) => values.get(k) ?? null,
    setItem: (k: string, v: string) => {
      values.set(k, v);
    },
    removeItem: (k: string) => {
      values.delete(k);
    },
  };
}
it('stores selection, notes and drafts with dataset context and preserves old project keys', () => {
  const storage = memory();
  storage.setItem('abundance-pathways:profile:v1', 'old');
  const data = defaultResearch(store);
  data.selection.year = 2021;
  data.draft.questions = 'What is the cost of connectivity?';
  data.notes.push({
    id: 'note-1',
    createdAt: '2026-11-04T12:00:00Z',
    datasetRunId: store.snapshot.runId,
    selection: structuredClone(data.selection),
    facts: 'A reported value.',
    questions: 'Investigate rural coverage.',
  });
  expect(saveResearch(data, storage, store)).toBe(true);
  expect(loadResearch(store, storage).data).toEqual(data);
  expect(resetResearch(storage)).toBe(true);
  expect(saveResearch(defaultResearch(store), storage, store)).toBe(true);
  expect(storage.values.has(STORAGE_KEY)).toBe(false);
  expect(storage.getItem('abundance-pathways:profile:v1')).toBe('old');
});
it('recovers corrupt or unsupported local data and degrades when storage is denied', () => {
  const storage = memory();
  storage.setItem(STORAGE_KEY, '{broken');
  expect(loadResearch(store, storage).status).toBe('invalid');
  const denied = {
    getItem() {
      throw new Error('denied');
    },
    setItem() {
      throw new Error('denied');
    },
    removeItem() {
      throw new Error('denied');
    },
  };
  expect(loadResearch(store, denied).status).toBe('unavailable');
  expect(saveResearch(defaultResearch(store), denied, store)).toBe(false);
});
it('rejects aggregate, duplicate, unknown indicator and out-of-range saved selections', () => {
  const data = defaultResearch(store);
  for (const selection of [
    { ...data.selection, countryCodes: ['WLD'] },
    { ...data.selection, countryCodes: ['KEN', 'KEN'] },
    { ...data.selection, indicatorCode: 'invented' },
    { ...data.selection, year: 2030 },
  ])
    expect(() => validateResearch({ ...data, selection }, store.snapshot)).toThrow();
});
it('exports original numeric values, explicit missing states, provenance and separate questions', () => {
  const data = defaultResearch(store);
  data.selection = { countryCodes: ['KEN', 'KOR'], year: 2022, indicatorCode: 'IT.NET.USER.ZS' };
  data.draft.facts = '=SUM(1,2)';
  data.draft.questions = 'Do rural learners have devices?';
  const csv = exportCSV(store, data, 'workspace'),
    md = exportMarkdown(store, data, 'workspace');
  expect(csv).toContain('29.40589905');
  expect(csv).toContain("'=SUM(1,2)");
  expect(csv).toContain('https://api.worldbank.org/v2/country/KEN');
  expect(csv).toContain('sourceOrganization');
  expect(md).toContain('Additional research questions — not established conclusions');
  expect(md).toContain(store.snapshot.runId);
  expect(md).toContain('No composite score');
  expect(csvCell('a,"b"')).toBe('"a,""b"""');
});

it('pins a draft to its original country, year, indicator and snapshot through edits and restoration', () => {
  const original = defaultResearch(store);
  let data = editDraft(original, { facts: 'Kenya Internet use in 2022.' }, 'original-snapshot');
  data.selection = { countryCodes: ['IND', 'USA'], year: 2025, indicatorCode: 'EG.ELC.ACCS.ZS' };
  data = editDraft(data, { questions: 'What explains the observed difference?' }, 'newer-snapshot');
  expect(data.draft.context).toEqual({
    selection: original.selection,
    datasetRunId: 'original-snapshot',
  });
  const storage = memory();
  expect(saveResearch(data, storage, store)).toBe(true);
  data = loadResearch(store, storage).data;
  const saved = addDraftNote(data, 'pinned-note', '2026-11-04T12:00:00Z');
  expect(saved.notes[0]).toMatchObject({
    selection: original.selection,
    datasetRunId: 'original-snapshot',
    facts: 'Kenya Internet use in 2022.',
  });
  expect(saved.selection).toEqual(data.selection);
  expect(saved.draft).toEqual({ facts: '', questions: '', context: null });
});

it('preserves legacy text and saved notes without inventing a draft context', () => {
  const data = defaultResearch(store);
  data.notes.push({
    id: 'previous-note',
    createdAt: '2026-11-04T12:00:00Z',
    datasetRunId: 'older',
    selection: data.selection,
    facts: 'Kept note',
    questions: '',
  });
  const legacy = {
    ...data,
    schemaVersion: 1,
    draft: { facts: 'An older draft', questions: 'Still a question' },
  };
  const migrated = validateResearch(legacy, store.snapshot);
  expect(migrated.schemaVersion).toBe(2);
  expect(migrated.notes).toEqual(data.notes);
  expect(migrated.draft).toEqual({ ...legacy.draft, context: null });
  expect(addDraftNote(migrated, 'blocked', '2026-11-04T12:00:00Z')).toBe(migrated);
  const assigned = assignDraftContext(migrated, store.snapshot.runId);
  expect(addDraftNote(assigned, 'confirmed', '2026-11-04T12:00:00Z').notes[1].selection).toEqual(
    migrated.selection,
  );
});

it('requires explicit context after writing without countries and captures a fresh context after clearing', () => {
  let data = defaultResearch(store);
  data.selection.countryCodes = [];
  data = editDraft(data, { questions: 'Who should be studied?' }, store.snapshot.runId);
  data.selection.countryCodes = ['IND'];
  data = editDraft(data, { facts: 'Draft still needs a context' }, store.snapshot.runId);
  expect(data.draft.context).toBeNull();
  data = assignDraftContext(data, store.snapshot.runId);
  expect(data.draft.context?.selection.countryCodes).toEqual(['IND']);
  data = editDraft(data, { facts: '', questions: '' }, store.snapshot.runId);
  data.selection.year = 2025;
  data = editDraft(data, { facts: 'A new observation' }, store.snapshot.runId);
  expect(data.draft.context?.selection.year).toBe(2025);
});

it('exports comparison, draft and saved-note contexts separately without retagging text', () => {
  let data = editDraft(
    defaultResearch(store),
    { facts: '2022 observation' },
    'snapshot-at-writing',
  );
  data.selection = { countryCodes: ['IND'], year: 2025, indicatorCode: 'EG.ELC.ACCS.ZS' };
  const csv = exportCSV(store, data, 'workspace'),
    md = exportMarkdown(store, data, 'workspace');
  const parseRow = (line: string) =>
    line.match(/"(?:[^"]|"")*"/g)!.map((cell) => cell.slice(1, -1).replaceAll('""', '"'));
  const [headers, ...rows] = csv.slice(1).split('\r\n').map(parseRow);
  const records = rows.map((row) =>
    Object.fromEntries(headers.map((header, i) => [header, row[i]])),
  );
  expect(
    records
      .filter((r) => r.recordType === 'observation')
      .every((r) => r.year === '2025' && r.observedFacts === ''),
  ).toBe(true);
  expect(records.find((r) => r.recordType === 'draft')).toMatchObject({
    noteYear: '2022',
    noteCountryCodes: 'KOR;KEN',
    noteIndicator: 'IT.NET.USER.ZS',
    noteDatasetRunId: 'snapshot-at-writing',
    observedFacts: '2022 observation',
  });
  expect(md).toContain('Selected year: 2025');
  expect(md).toContain('Draft year: 2022');
  expect(md).toContain('Draft dataset: snapshot-at-writing');
  data = { ...data, draft: { ...data.draft, context: null } };
  expect(exportCSV(store, data, 'workspace')).toContain('"unassigned"');
  expect(exportMarkdown(store, data, 'workspace')).toContain('Draft context: UNASSIGNED');
});
