import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createStore, observation } from '../../src/lib/query';
import { snapshotSchema, type Snapshot } from '../../src/lib/schema';
import {
  comparisonSummary,
  comparisonSummarySchema,
  formatDifference,
  yearCompleteness,
} from '../../src/lib/analysis';

const snapshot = snapshotSchema.parse(
  JSON.parse(readFileSync(new URL('../../data/snapshots/latest.json', import.meta.url), 'utf8')),
);
const store = createStore(snapshot);
const selection = {
  countryCodes: ['KOR', 'IND', 'KEN'],
  indicatorCode: 'IT.NET.USER.ZS' as const,
  year: 2022,
};
const alteredStore = (transform: (data: Snapshot) => void) => {
  const data = structuredClone(snapshot);
  transform(data);
  return createStore(data);
};

describe('reproducible comparison calculations', () => {
  it('finds the latest year complete for all selected countries and all three indicators', () => {
    const completeness = yearCompleteness(store, selection.countryCodes);
    expect(completeness.latestCompleteYear).toBe(2023);
    expect(completeness.years.find((entry) => entry.year === 2022)).toEqual({
      year: 2022,
      observed: 9,
      missing: 0,
      total: 9,
      complete: true,
    });
    expect(completeness.years.find((entry) => entry.year === 2025)).toEqual({
      year: 2025,
      observed: 2,
      missing: 7,
      total: 9,
      complete: false,
    });
    expect(selection.year).toBe(2022);
  });

  it('reports no complete year when a country has no education observations, without filling gaps', () => {
    const sparse = alteredStore((data) =>
      data.observations.forEach((row) => {
        if (row.countryCode === 'KEN' && row.indicatorCode === 'SE.SEC.CMPT.LO.ZS') {
          row.value = null;
          row.status = 'reported-null';
        }
      }),
    );
    const result = yearCompleteness(sparse, ['KOR', 'KEN']);
    expect(result.latestCompleteYear).toBeNull();
    expect(result.years.every((entry) => entry.missing >= 1)).toBe(true);
  });

  it('calculates signed differences from full precision and retains source provenance in an independent copy', () => {
    const summary = comparisonSummary(store, selection);
    const left = observation(store, 'KOR', 'IT.NET.USER.ZS', 2022);
    const right = observation(store, 'IND', 'IT.NET.USER.ZS', 2022);
    expect(summary.pairs).toHaveLength(3);
    expect(summary.pairs[0].difference).toBe(left.value! - right.value!);
    expect(summary.pairs[0].difference).not.toBe(97.2 - 55.9);
    expect(formatDifference(summary.pairs[0].difference)).toBe('+41.3 pp');
    expect(summary.observations[0]).toEqual(left);
    expect(summary.observations[0]).not.toBe(left);
    expect(summary.snapshotRunId).toBe(snapshot.runId);
    expect(summary.observations.every((row) => row.sourceUrl.includes('date=2022'))).toBe(true);
  });

  it('marks missing differences as not calculated, including two missing observations', () => {
    const summary = comparisonSummary(store, { ...selection, year: 2025 });
    expect(summary.pairs.every((pair) => pair.difference === null)).toBe(true);
    expect(summary.observations.map((row) => row.value)).toEqual([null, 70, null]);
    expect(formatDifference(null)).toBe('Not calculated');
    const allMissing = comparisonSummary(store, {
      ...selection,
      countryCodes: ['KOR', 'KEN'],
      year: 2025,
    });
    expect(allMissing.observations.map((row) => row.value)).toEqual([null, null]);
    expect(allMissing.pairs[0].difference).toBeNull();
  });

  it('retains valid education values over 100 without clipping and supports negative differences', () => {
    const above = snapshot.observations.find((row) => row.value !== null && row.value > 100)!;
    const other = snapshot.countries.find(
      (country) =>
        country.code !== above.countryCode &&
        observation(store, country.code, above.indicatorCode, above.year).value !== null,
    )!;
    const summary = comparisonSummary(store, {
      countryCodes: [other.code, above.countryCode],
      indicatorCode: above.indicatorCode,
      year: above.year,
    });
    expect(summary.observations[1].value).toBe(above.value);
    expect(summary.pairs[0].difference).toBe(summary.observations[0].value! - above.value!);
    expect(formatDifference(-12.34)).toBe('-12.3 pp');
    expect(formatDifference(-0.000001)).toBe('0 pp');
    expect(formatDifference(0.15)).toBe('+0.2 pp');
  });

  it('rejects duplicate, aggregate, unknown country and invalid indicator/year inputs', () => {
    for (const countryCodes of [[], ['KEN'], ['KEN', 'KEN'], ['KEN', 'WLD'], ['KEN', 'FAKE']])
      expect(() => yearCompleteness(store, countryCodes)).toThrow();
    expect(() => comparisonSummary(store, { ...selection, year: 2026 })).toThrow();
    expect(() => comparisonSummary(store, { ...selection, year: 2022.5 })).toThrow();
    expect(() =>
      comparisonSummary(store, { ...selection, indicatorCode: 'FAKE' as never }),
    ).toThrow();
  });

  it('rejects tampered stored calculations and mixed observation years', () => {
    const summary = comparisonSummary(store, selection);
    expect(
      comparisonSummarySchema.safeParse({
        ...summary,
        pairs: [{ ...summary.pairs[0], difference: 90 }, ...summary.pairs.slice(1)],
      }).success,
    ).toBe(false);
    expect(
      comparisonSummarySchema.safeParse({
        ...summary,
        observations: [
          { ...summary.observations[0], sourceUrl: 'javascript:alert(1)' },
          ...summary.observations.slice(1),
        ],
      }).success,
    ).toBe(false);
    expect(
      comparisonSummarySchema.safeParse({
        ...summary,
        observations: [
          { ...summary.observations[0], year: 2021 },
          ...summary.observations.slice(1),
        ],
      }).success,
    ).toBe(false);
  });
});
