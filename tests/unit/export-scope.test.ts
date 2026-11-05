import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { comparisonSummary } from '../../src/lib/analysis';
import { canExport, exportCSV, exportMarkdown, exportSelection } from '../../src/lib/export';
import { createStore } from '../../src/lib/query';
import { defaultResearch, type Research, type ResearchNote } from '../../src/lib/research';
import { snapshotSchema } from '../../src/lib/schema';

const store = createStore(
  snapshotSchema.parse(
    JSON.parse(readFileSync(new URL('../../data/snapshots/latest.json', import.meta.url), 'utf8')),
  ),
);
const makeNote = (data: Research, id: string, patch: Partial<ResearchNote> = {}): ResearchNote => ({
  id,
  createdAt: '2026-11-05T12:00:00Z',
  datasetRunId: store.snapshot.runId,
  selection: structuredClone(data.selection),
  facts: `PRIVATE_${id}`,
  questions: `QUESTION_${id}`,
  ...patch,
});
const plan: NonNullable<Research['draft']['investigation']> = {
  topic: 'devices',
  targetGroup: 'Adult learners at a proposed study centre',
  locality: 'Location still to be identified',
  evidenceNeeded: 'User-authored device access survey question',
  sourceToCheck: 'Proposed local partner, not contacted',
  status: 'unverified',
  decisionToInform: 'Whether shared equipment needs investigation',
};

describe('explicit export scope', () => {
  it('excludes every draft, note, calculation and plan by default while retaining current sources', () => {
    const data = defaultResearch(store);
    const evidence = comparisonSummary(store, data.selection);
    data.draft = {
      facts: 'PRIVATE_DRAFT',
      questions: 'PRIVATE_QUESTION',
      context: { selection: data.selection, datasetRunId: store.snapshot.runId },
      evidence,
      investigation: plan,
    };
    data.notes = [makeNote(data, 'saved', { evidence, investigation: plan })];
    const csv = exportCSV(store, data),
      md = exportMarkdown(store, data);
    for (const text of [csv, md]) {
      expect(text).not.toContain('PRIVATE_');
      expect(text).not.toContain('QUESTION_saved');
      expect(text).not.toContain(plan.evidenceNeeded);
      expect(text).toContain(store.snapshot.runId);
      expect(text).toContain('https://github.com/tomatopepperoni/abundance-access/blob/');
    }
    expect(csv).not.toContain('"calculated-comparison"');
    expect(csv).not.toContain('"investigation-plan"');
    expect(csv).toContain('"exportScope"');
    expect(csv).toContain('"export-metadata","comparison"');
    expect(csv).toContain('"frozenSourceUrl"');
    expect(csv).toContain('"rawSha256"');
    expect(md).toContain('Export scope: **Current comparison only** (comparison)');
  });

  it('includes related notes only for an exact country set, year, indicator and snapshot', () => {
    const data = defaultResearch(store);
    data.notes = [
      makeNote(data, 'matching'),
      makeNote(data, 'reordered', {
        selection: { ...data.selection, countryCodes: [...data.selection.countryCodes].reverse() },
      }),
      makeNote(data, 'year', { selection: { ...data.selection, year: 2021 } }),
      makeNote(data, 'indicator', {
        selection: { ...data.selection, indicatorCode: 'EG.ELC.ACCS.ZS' },
      }),
      makeNote(data, 'countries', {
        selection: { ...data.selection, countryCodes: ['IND', 'KEN'] },
      }),
      makeNote(data, 'snapshot', { datasetRunId: 'earlier-snapshot' }),
    ];
    data.draft = {
      facts: 'PRIVATE_RELATED_DRAFT',
      questions: '',
      context: { selection: structuredClone(data.selection), datasetRunId: store.snapshot.runId },
    };
    expect(exportSelection(store, data, 'related').notes.map((note) => note.id)).toEqual([
      'matching',
      'reordered',
    ]);
    expect(exportSelection(store, data, 'related').draft).toBe(data.draft);
    for (const text of [
      exportCSV(store, data, 'related'),
      exportMarkdown(store, data, 'related'),
    ]) {
      expect(text).toContain('PRIVATE_matching');
      expect(text).toContain('PRIVATE_reordered');
      expect(text).toContain('PRIVATE_RELATED_DRAFT');
      for (const id of ['year', 'indicator', 'countries', 'snapshot'])
        expect(text).not.toContain(`PRIVATE_${id}`);
    }
    data.draft.context!.datasetRunId = 'earlier-snapshot';
    expect(exportSelection(store, data, 'related').draft).toBeNull();
    data.draft.context = null;
    expect(exportSelection(store, data, 'related').draft).toBeNull();
  });

  it('requires Entire workspace to export unrelated or unassigned records without relabelling them', () => {
    const data = defaultResearch(store);
    data.selection = { countryCodes: ['KOR', 'IND'], year: 2022, indicatorCode: 'IT.NET.USER.ZS' };
    data.notes = [
      makeNote(data, 'kenya2019', {
        datasetRunId: 'historical-snapshot',
        selection: { countryCodes: ['KEN'], year: 2019, indicatorCode: 'EG.ELC.ACCS.ZS' },
      }),
    ];
    data.draft = { facts: 'PRIVATE_UNASSIGNED_DRAFT', questions: '', context: null };
    for (const text of [
      exportCSV(store, data),
      exportMarkdown(store, data),
      exportCSV(store, data, 'related'),
      exportMarkdown(store, data, 'related'),
    ]) {
      expect(text).not.toContain('PRIVATE_kenya2019');
      expect(text).not.toContain('PRIVATE_UNASSIGNED_DRAFT');
    }
    const csv = exportCSV(store, data, 'workspace'),
      md = exportMarkdown(store, data, 'workspace');
    for (const text of [csv, md]) {
      expect(text).toContain('PRIVATE_kenya2019');
      expect(text).toContain('PRIVATE_UNASSIGNED_DRAFT');
      expect(text).toContain('historical-snapshot');
      expect(text).toContain('2019');
    }
    expect(csv).toContain('"unassigned"');
    expect(md).toContain('Draft context: UNASSIGNED');
    expect(md).toContain('Entire workspace');
  });

  it('exports recorded evidence and user-authored plans only inside the selected note scope', () => {
    const data = defaultResearch(store);
    const evidence = comparisonSummary(store, data.selection);
    data.notes = [makeNote(data, 'matching', { evidence, investigation: plan })];
    for (const text of [
      exportCSV(store, data, 'related'),
      exportMarkdown(store, data, 'related'),
    ]) {
      expect(text).toContain(plan.targetGroup);
      expect(text).toContain(plan.evidenceNeeded);
      expect(text).toContain('unverified');
      expect(text).toContain('User-authored investigation status');
      expect(text).toContain(evidence.observations[0].sourceUrl);
    }
    const csv = exportCSV(store, data, 'related');
    expect(csv).toContain('"investigation-plan"');
    expect(csv).toContain('"calculated-comparison"');
    data.selection.year = 2025;
    expect(exportCSV(store, data, 'related')).not.toContain(plan.evidenceNeeded);
    expect(exportMarkdown(store, data, 'workspace')).toContain('year: 2022');
  });

  it('allows note-only exports only with explicit workspace scope and rejects unknown scopes', () => {
    const data = defaultResearch(store);
    data.notes = [makeNote(data, 'kept')];
    data.selection.countryCodes = [];
    expect(canExport(store, data, 'comparison')).toBe(false);
    expect(canExport(store, data, 'related')).toBe(false);
    expect(canExport(store, data, 'workspace')).toBe(true);
    data.notes = [];
    expect(canExport(store, data, 'workspace')).toBe(false);
    data.draft = { facts: 'Unassigned text', questions: '', context: null };
    expect(canExport(store, data, 'workspace')).toBe(true);
    expect(() => exportCSV(store, data, 'unknown' as 'workspace')).toThrow('Unknown export scope');
  });

  it('does not attach a current frozen archive to evidence recorded under an unknown snapshot', () => {
    const data = defaultResearch(store);
    const evidence = comparisonSummary(store, data.selection);
    evidence.snapshotRunId = 'unavailable-earlier-snapshot';
    data.notes = [
      makeNote(data, 'old-evidence', { datasetRunId: evidence.snapshotRunId, evidence }),
    ];
    const csvRows = exportCSV(store, data, 'workspace')
      .slice(1)
      .split('\r\n')
      .map((line) =>
        line.match(/"(?:[^"]|"")*"/g)!.map((cell) => cell.slice(1, -1).replaceAll('""', '"')),
      );
    const [headers, ...rows] = csvRows;
    const records = rows.map((row) =>
      Object.fromEntries(headers.map((header, index) => [header, row[index]])),
    );
    const recorded = records.filter((row) => row.recordType === 'evidence-observation');
    expect(recorded).toHaveLength(2);
    expect(recorded.every((row) => row.frozenSourceUrl === '' && row.rawSha256 === '')).toBe(true);
    expect(recorded[0].sourceUrl).toBe(evidence.observations[0].sourceUrl);
    const md = exportMarkdown(store, data, 'workspace');
    const evidenceSection = md
      .split('### Calculated observations')[1]
      .split('### User-authored observations')[0];
    expect(evidenceSection).toContain(evidence.snapshotRunId);
    expect(evidenceSection).not.toContain('frozen raw response:');
  });
});
