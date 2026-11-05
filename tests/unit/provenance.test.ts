import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createStore, definitions, observation } from '../../src/lib/query';
import { frozenSourceReference, PUBLISHED_SNAPSHOTS } from '../../src/lib/provenance';
import { snapshotSchema } from '../../src/lib/schema';

const snapshot = snapshotSchema.parse(
  JSON.parse(readFileSync(new URL('../../data/snapshots/latest.json', import.meta.url), 'utf8')),
);
const store = createStore(snapshot);
const row = observation(store, 'KOR', 'IT.NET.USER.ZS', 2022);

describe('published source provenance', () => {
  it('links the exact archived response at its verified revision and zero-based record index', () => {
    const ref = frozenSourceReference(store, row)!;
    expect(ref.url).toBe(
      `https://github.com/tomatopepperoni/abundance-access/blob/${PUBLISHED_SNAPSHOTS[snapshot.runId]}/${row.rawFile}`,
    );
    expect(ref.url).not.toContain('/main/');
    expect(ref.url).not.toContain('#L');
    expect(ref.rawRecordIndex).toBe(row.rawRow);
    const raw = readFileSync(new URL(`../../${row.rawFile}`, import.meta.url));
    expect(ref.sha256).toBe(createHash('sha256').update(raw).digest('hex'));
    const sourceRow = JSON.parse(raw.toString())[1][ref.rawRecordIndex];
    expect(sourceRow.value).toBe(row.value);
    expect(sourceRow.countryiso3code).toBe(row.countryCode);
    expect(sourceRow.date).toBe(String(row.year));
  });

  it('retains matching hashes for all archived response files', () => {
    for (const entry of snapshot.rawManifest) {
      const archived = readFileSync(new URL(`../../${entry.file}`, import.meta.url));
      expect(createHash('sha256').update(archived).digest('hex')).toBe(entry.sha256);
    }
  });

  it('does not substitute a current source for an unpublished snapshot or unreturned record', () => {
    for (const runId of ['unpublished-snapshot', '__proto__', 'constructor']) {
      const changed = createStore({ ...snapshot, runId });
      expect(frozenSourceReference(changed, row)).toBeNull();
    }
    expect(
      frozenSourceReference(store, {
        ...row,
        rawFile: null,
        rawRow: null,
        value: null,
        status: 'not-returned',
      }),
    ).toBeNull();
  });

  it('rejects foreign paths, records, mismatched values and malformed manifest hashes', () => {
    for (const rawFile of [
      '../../private.json',
      `${row.rawFile}/../private.json`,
      row.rawFile!.replace('IT.NET.USER.ZS', 'EG.ELC.ACCS.ZS'),
      'https://example.com/private.json',
    ])
      expect(frozenSourceReference(store, { ...row, rawFile })).toBeNull();
    expect(frozenSourceReference(store, { ...row, rawRow: row.rawRow! + 1 })).toBeNull();
    expect(frozenSourceReference(store, { ...row, value: 42 })).toBeNull();
    const changed = createStore({
      ...snapshot,
      rawManifest: snapshot.rawManifest.map((entry) =>
        entry.file === row.rawFile ? { ...entry, sha256: 'not-a-hash'.padEnd(64, '-') } : entry,
      ),
    });
    expect(frozenSourceReference(changed, row)).toBeNull();
  });

  it('makes the school-education proxy explicit without claiming a new manual review', () => {
    const education = definitions.indicators.find((entry) => entry.code === 'SE.SEC.CMPT.LO.ZS')!;
    expect(education.shortName).toBe('Lower secondary completion proxy');
    expect(education.context).toContain('School-age');
    expect(education.limitation).toContain('adult readiness');
    expect(definitions.reviewedAt).toBe('2026-11-04');
  });
});
