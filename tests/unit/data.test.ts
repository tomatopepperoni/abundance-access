import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { snapshotSchema, observationSchema, type Country } from '../../src/lib/schema';
import {
  createStore,
  compare,
  coverage,
  definitions,
  findCountries,
  formatValue,
  latest,
  observation,
  series,
  valueBand,
} from '../../src/lib/query';
import {
  normalizeCountries,
  normalizeObservations,
  parsePage,
  makeRequester,
} from '../../scripts/world-bank';

const snapshot = snapshotSchema.parse(
  JSON.parse(readFileSync(new URL('../../data/snapshots/latest.json', import.meta.url), 'utf8')),
);
const store = createStore(snapshot);
describe('official source normalization and country statistics', () => {
  it('keeps the complete explicit grid and excludes all aggregate codes', () => {
    expect(snapshot.observations).toHaveLength(snapshot.countries.length * 3 * 11);
    expect(snapshot.countries.every((c) => !c.isAggregate)).toBe(true);
    expect(snapshot.aggregates.some((c) => c.code === 'WLD')).toBe(true);
    expect(() => observation(store, 'WLD', 'IT.NET.USER.ZS', 2022)).toThrow();
  });
  it('retains actual sample values and compares a common observation year', () => {
    const rows = compare(store, ['KOR', 'IND', 'KEN'], ['IT.NET.USER.ZS'], 2022);
    expect(rows.map((o) => o.value)).toEqual([97.16855335, 55.9, 29.40589905]);
    expect(rows.every((o) => o.year === 2022 && o.sourceUrl.includes('date=2022'))).toBe(true);
    expect(() => compare(store, ['KEN', 'KEN'], ['IT.NET.USER.ZS'], 2022)).toThrow();
  });
  it('preserves missing values rather than returning zero or the latest value', () => {
    const missing = snapshot.observations.find((o) => o.value === null)!;
    expect(
      observation(store, missing.countryCode, missing.indicatorCode, missing.year).value,
    ).toBeNull();
    expect(formatValue(null)).toBe('No observation');
    expect(valueBand(null)).toBe('missing');
    expect(valueBand(0)).toBe('lowest');
    const count = coverage(store, 'IT.NET.USER.ZS', 2025);
    expect(count.observed + count.missing).toBe(snapshot.countries.length);
  });
  it('keeps years and gaps when preparing trends and finds latest values explicitly', () => {
    const rows = series(store, 'KEN', 'EG.ELC.ACCS.ZS');
    expect(rows.map((o) => o.year)).toEqual(Array.from({ length: 11 }, (_, i) => 2015 + i));
    const last = latest(store, 'KEN', 'EG.ELC.ACCS.ZS')!;
    expect(rows.filter((o) => o.value !== null).at(-1)).toEqual(last);
    expect(last.year).toBeLessThanOrEqual(2025);
  });
  it('allows reported education values above 100 and rejects invalid population shares', () => {
    const above = snapshot.observations.find((o) => o.value !== null && o.value > 100)!;
    expect(above.indicatorCode).toBe('SE.SEC.CMPT.LO.ZS');
    expect(observationSchema.safeParse(above).success).toBe(true);
    expect(observationSchema.safeParse({ ...above, indicatorCode: 'IT.NET.USER.ZS' }).success).toBe(
      false,
    );
    expect(valueBand(above.value)).toBe('above');
  });
  it('rejects duplicate records, broken raw references, unknown codes and incomplete grids', () => {
    const first = snapshot.observations[0];
    expect(
      snapshotSchema.safeParse({ ...snapshot, observations: [first, ...snapshot.observations] })
        .success,
    ).toBe(false);
    expect(
      snapshotSchema.safeParse({
        ...snapshot,
        observations: [{ ...first, rawFile: 'invented.json' }, ...snapshot.observations.slice(1)],
      }).success,
    ).toBe(false);
    expect(
      snapshotSchema.safeParse({
        ...snapshot,
        observations: [{ ...first, countryCode: 'FAKE' }, ...snapshot.observations.slice(1)],
      }).success,
    ).toBe(false);
    expect(
      snapshotSchema.safeParse({ ...snapshot, observations: snapshot.observations.slice(1) })
        .success,
    ).toBe(false);
  });
  it('filters names, ISO codes and regions without treating absent results as absent countries', () => {
    expect(findCountries(snapshot.countries, 'kEnYa').map((c) => c.code)).toEqual(['KEN']);
    expect(findCountries(snapshot.countries, 'KOR').map((c) => c.code)).toEqual(['KOR']);
    expect(
      findCountries(snapshot.countries, '', store.countryByCode.get('KEN')!.region).some(
        (c) => c.code === 'KOR',
      ),
    ).toBe(false);
    expect(findCountries(snapshot.countries, 'not-a-country')).toEqual([]);
  });
});
describe('API boundary and retry policy', () => {
  const country: Country = {
    code: 'KEN',
    iso2: 'KE',
    name: 'Kenya',
    region: 'Sub-Saharan Africa',
    incomeLevel: 'Lower middle income',
    isAggregate: false,
  };
  const row = {
    indicator: { id: 'IT.NET.USER.ZS' },
    country: { value: 'Kenya' },
    countryiso3code: 'KEN',
    date: '2022',
    value: 29.40589905,
    obs_status: '',
  };
  it('separates source aggregates and rejects malformed API pages', () => {
    const normalized = normalizeCountries([
      {
        id: 'WLD',
        iso2Code: '1W',
        name: 'World',
        region: { id: 'NA', value: 'Aggregates' },
        incomeLevel: { value: 'Aggregates' },
      },
    ]);
    expect(normalized[0].isAggregate).toBe(true);
    expect(parsePage([{ page: 1, pages: 1, total: 0 }, null]).rows).toEqual([]);
    expect(() => parsePage([{ message: [{ id: '120', value: 'Invalid value' }] }])).toThrow();
  });
  it('distinguishes reported-null and not-returned records and rejects duplicate raw rows', () => {
    const page = {
      file: 'raw.json',
      fetchedAt: '2026-11-04T12:00:00Z',
      sourceUpdatedAt: '2026-10-08',
      rows: [row, { ...row, date: '2021', value: null }],
    };
    const result = normalizeObservations([country], definitions.indicators[0], [page]);
    expect(result.find((o) => o.year === 2022)).toMatchObject({
      value: 29.40589905,
      status: 'observed',
      rawRow: 0,
    });
    expect(result.find((o) => o.year === 2021)).toMatchObject({
      value: null,
      status: 'reported-null',
      rawRow: 1,
    });
    expect(result.find((o) => o.year === 2020)).toMatchObject({
      value: null,
      status: 'not-returned',
      rawFile: null,
    });
    expect(() =>
      normalizeObservations([country], definitions.indicators[0], [{ ...page, rows: [row, row] }]),
    ).toThrow('Duplicate');
  });
  it('retries a rate limit within a bounded policy and honors the capped Retry-After', async () => {
    let calls = 0;
    const waits: number[] = [];
    const request = (async () =>
      ++calls === 1
        ? new Response('', { status: 429, headers: { 'Retry-After': '1000' } })
        : new Response('[]', { status: 200 })) as typeof fetch;
    const get = makeRequester(
      { timeoutMs: 100, attempts: 3, minIntervalMs: 0 },
      request,
      async (ms) => {
        waits.push(ms);
      },
    );
    expect(await get('https://api.worldbank.org/test')).toBe('[]');
    expect(calls).toBe(2);
    expect(waits).toContain(10000);
  });
  it('does not retry a definitive client error and limits transient retries', async () => {
    let calls = 0;
    const bad = (async () => {
      calls++;
      return new Response('', { status: 403 });
    }) as typeof fetch;
    await expect(
      makeRequester({ timeoutMs: 100, attempts: 3, minIntervalMs: 0 }, bad, async () => {})(
        'https://api.worldbank.org/test',
      ),
    ).rejects.toThrow('403');
    expect(calls).toBe(1);
    calls = 0;
    const transient = (async () => {
      calls++;
      throw new Error('temporary network failure');
    }) as typeof fetch;
    await expect(
      makeRequester({ timeoutMs: 100, attempts: 2, minIntervalMs: 0 }, transient, async () => {})(
        'https://api.worldbank.org/test',
      ),
    ).rejects.toThrow();
    expect(calls).toBe(2);
  });
});
