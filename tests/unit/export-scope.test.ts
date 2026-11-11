import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { comparisonSummary } from '../../src/lib/analysis';
import {
  canExport,
  exportCSV,
  exportMarkdown,
  exportNoteCSV,
  exportNoteMarkdown,
  exportSelection,
} from '../../src/lib/export';
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
function readCsvRecords(csv: string) {
  const [headers, ...rows] = csv
    .slice(1)
    .split('\r\n')
    .map((line) =>
      line.match(/"(?:[^"]|"")*"/g)!.map((cell) => cell.slice(1, -1).replaceAll('""', '"')),
    );
  return rows.map((row) =>
    Object.fromEntries(headers.map((header, index) => [header, row[index]])),
  );
}

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

  it('exports user-recorded findings only with their saved note and protects user text', () => {
    const data = defaultResearch(store);
    const findings: NonNullable<ResearchNote['findings']> = {
      status: 'found',
      sourceTitle: '  =test-only-source',
      sourceUrl: 'https://example.org/test-source',
      checkedOn: '2026-11-05',
      referencePeriod: '2025 pilot',
      locality: 'Example locality',
      targetGroup: 'Example learners',
      summary: 'Test-only result\n### [Unsafe heading](javascript:alert(1))',
      uncertainty: 'Synthetic fixture for export verification',
    };
    const note = makeNote(data, 'with-findings', { investigation: plan, findings });
    data.notes = [note];
    const relatedCsv = exportCSV(store, data, 'related');
    const matchingRows = readCsvRecords(relatedCsv).filter(
      (row) => row.recordType === 'investigation-findings',
    );
    expect(matchingRows).toHaveLength(1);
    expect(matchingRows[0]).toMatchObject({
      noteId: note.id,
      noteCountryCodes: note.selection.countryCodes.join(';'),
      noteYear: '2022',
      noteIndicator: note.selection.indicatorCode,
      noteDatasetRunId: note.datasetRunId,
      sourceUrl: '',
      findingsStatus: findings.status,
      findingsSourceTitle: `'${findings.sourceTitle}`,
      findingsSourceUrl: findings.sourceUrl,
      findingsCheckedOn: findings.checkedOn,
      findingsReferencePeriod: findings.referencePeriod,
      findingsLocality: findings.locality,
      findingsTargetGroup: findings.targetGroup,
      findingsSummary: findings.summary,
      findingsUncertainty: findings.uncertainty,
    });
    const markdown = exportMarkdown(store, data, 'related');
    expect(markdown).toContain('### Your recorded findings');
    expect(markdown).toContain('Test-only result ### \\[Unsafe heading\\]');
    expect(markdown).not.toContain('\n### [Unsafe heading]');
    expect(markdown).toContain(findings.sourceUrl);
    expect(exportCSV(store, data)).not.toContain(findings.sourceUrl);
    expect(exportMarkdown(store, data)).not.toContain(findings.sourceUrl);

    data.selection.year = 2025;
    expect(exportCSV(store, data, 'related')).not.toContain(findings.sourceUrl);
    expect(exportMarkdown(store, data, 'related')).not.toContain(findings.sourceUrl);
    const workspace = readCsvRecords(exportCSV(store, data, 'workspace')).find(
      (row) => row.recordType === 'investigation-findings',
    );
    expect(workspace).toMatchObject({ noteYear: '2022', findingsSourceUrl: findings.sourceUrl });
    expect(exportMarkdown(store, data, 'workspace')).toContain(findings.uncertainty);
  });

  it('requires workspace scope for dashboard exports without an active comparison', () => {
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
    const records = readCsvRecords(exportCSV(store, data, 'workspace'));
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

describe('single saved note export', () => {
  it('exports one note with recorded evidence, findings and raw source links', () => {
    const data = defaultResearch(store);
    const evidence = comparisonSummary(store, data.selection);
    const findings: NonNullable<ResearchNote['findings']> = {
      status: 'deferred',
      sourceTitle: 'Test-only source description',
      sourceUrl: '',
      checkedOn: '2026-11-05',
      referencePeriod: 'Test-only reference period',
      locality: 'Test-only study area',
      targetGroup: 'Test-only group',
      summary: 'Test-only follow-up result',
      uncertainty: 'Test-only unresolved finding',
    };
    data.notes = [
      makeNote(data, 'selected', { evidence, investigation: plan, findings }),
      makeNote(data, 'unrelated'),
    ];
    data.draft = { ...data.draft, facts: 'PRIVATE_DRAFT' };
    data.selection = { countryCodes: ['USA'], year: 2025, indicatorCode: 'EG.ELC.ACCS.ZS' };
    const [selected] = data.notes;
    const csv = exportNoteCSV(store, selected);
    const md = exportNoteMarkdown(store, selected);
    const rows = readCsvRecords(csv);
    expect(new Set(rows.map((row) => row.exportScope))).toEqual(new Set(['note']));
    expect(new Set(rows.map((row) => row.noteId).filter(Boolean))).toEqual(new Set(['selected']));
    expect(rows.find((row) => row.recordType === 'saved-note')).toMatchObject({
      status: 'recorded-evidence',
      noteYear: '2022',
      noteIndicator: selected.selection.indicatorCode,
      noteDatasetRunId: selected.datasetRunId,
    });
    expect(rows.find((row) => row.recordType === 'evidence-observation')).toMatchObject({
      value: String(evidence.observations[0].value),
      sourceUrl: evidence.observations[0].sourceUrl,
      frozenSourceUrl: expect.stringContaining(
        'https://github.com/tomatopepperoni/abundance-access/blob/',
      ),
      rawSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect(rows.some((row) => row.recordType === 'observation' || row.recordType === 'draft')).toBe(
      false,
    );
    for (const file of [csv, md]) {
      expect(file).toContain(selected.questions);
      expect(file).toContain(plan.evidenceNeeded);
      expect(file).toContain(findings.summary);
      expect(file).not.toContain('PRIVATE_unrelated');
      expect(file).not.toContain('PRIVATE_DRAFT');
      expect(file).not.toContain('USA');
    }
    expect(md).toContain('Export scope: **Saved note only** (note)');
    expect(md).toContain('frozen raw response:');
    expect(md).not.toContain('## Current comparison');
  });

  it('preserves older recorded values without adding current snapshot provenance', () => {
    const data = defaultResearch(store);
    const evidence = comparisonSummary(store, data.selection);
    evidence.snapshotRunId = 'old-test-snapshot';
    const note = makeNote(data, 'old', { datasetRunId: evidence.snapshotRunId, evidence });
    const rows = readCsvRecords(exportNoteCSV(store, note));
    const md = exportNoteMarkdown(store, note);
    expect(rows[0]).toMatchObject({
      recordType: 'export-metadata',
      datasetRunId: evidence.snapshotRunId,
    });
    expect(rows.find((row) => row.recordType === 'evidence-observation')).toMatchObject({
      datasetRunId: evidence.snapshotRunId,
      value: String(evidence.observations[0].value),
      sourceUrl: evidence.observations[0].sourceUrl,
      frozenSourceUrl: '',
      rawSha256: '',
    });
    expect(md).toContain(evidence.snapshotRunId);
    expect(md).toContain(evidence.observations[0].sourceUrl);
    expect(md).not.toContain('frozen raw response:');
    expect(md).not.toContain('## Current comparison');
  });

  it('labels notes without recorded evidence and omits substitute values', () => {
    const data = defaultResearch(store);
    const note = makeNote(data, 'without-evidence', { datasetRunId: 'older-test-snapshot' });
    const rows = readCsvRecords(exportNoteCSV(store, note));
    expect(rows.map((row) => row.recordType)).toEqual(['export-metadata', 'saved-note']);
    expect(rows[1]).toMatchObject({
      status: 'no-recorded-evidence',
      noteYear: '2022',
      noteDatasetRunId: note.datasetRunId,
    });
    const md = exportNoteMarkdown(store, note);
    expect(md).toContain(note.facts);
    expect(md).toContain('No source observations were saved with this note.');
    expect(md).not.toContain('api.worldbank.org');
    expect(md).not.toContain('## Current comparison');
  });
});
