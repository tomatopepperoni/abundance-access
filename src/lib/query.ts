import type { Country, Indicator, IndicatorCode, Observation, Snapshot } from './schema';
import { definitionsSchema } from './schema';
import rawDefinitions from '../content/indicators.json';

export const definitions = definitionsSchema.parse(rawDefinitions);
export const indicatorByCode = new Map(definitions.indicators.map((i) => [i.code, i]));
export type DataStore = ReturnType<typeof createStore>;
export function createStore(snapshot: Snapshot) {
  const countryByCode = new Map(snapshot.countries.map((c) => [c.code, c]));
  const byKey = new Map(
    snapshot.observations.map((o) => [`${o.countryCode}:${o.indicatorCode}:${o.year}`, o]),
  );
  return { snapshot, countryByCode, byKey };
}
export function observation(
  store: DataStore,
  countryCode: string,
  indicatorCode: IndicatorCode,
  year: number,
): Observation {
  const value = store.byKey.get(`${countryCode}:${indicatorCode}:${year}`);
  if (!value) throw new Error('Observation outside the validated country/indicator/year grid');
  return value;
}
export function series(store: DataStore, countryCode: string, indicatorCode: IndicatorCode) {
  return Array.from({ length: 11 }, (_, i) =>
    observation(store, countryCode, indicatorCode, 2015 + i),
  );
}
export function latest(store: DataStore, countryCode: string, indicatorCode: IndicatorCode) {
  return (
    series(store, countryCode, indicatorCode)
      .filter((o) => o.value !== null)
      .at(-1) ?? null
  );
}
export function compare(
  store: DataStore,
  countryCodes: string[],
  indicatorCodes: IndicatorCode[],
  year: number,
) {
  if (new Set(countryCodes).size !== countryCodes.length)
    throw new Error('Duplicate country selection');
  return countryCodes.flatMap((code) =>
    indicatorCodes.map((indicator) => observation(store, code, indicator, year)),
  );
}
export function coverage(store: DataStore, indicatorCode: IndicatorCode, year: number) {
  const rows = store.snapshot.countries.map((c) => observation(store, c.code, indicatorCode, year));
  return {
    observed: rows.filter((o) => o.value !== null).length,
    missing: rows.filter((o) => o.value === null).length,
    total: rows.length,
  };
}
export function defaultYear(store: DataStore) {
  // A fixed, clearly labelled common-year starting point; never silently mix latest years.
  return store.snapshot.period.start <= 2022 && store.snapshot.period.end >= 2022
    ? 2022
    : store.snapshot.period.start;
}
export function findCountries(countries: Country[], search: string, region = 'all') {
  const query = search.trim().toLocaleLowerCase('en');
  const exactCode = countries.some(
    (c) => c.code.toLocaleLowerCase('en') === query || c.iso2.toLocaleLowerCase('en') === query,
  );
  return countries.filter(
    (c) =>
      (region === 'all' || c.region === region) &&
      (!query ||
        (exactCode
          ? c.code.toLocaleLowerCase('en') === query || c.iso2.toLocaleLowerCase('en') === query
          : `${c.name} ${c.code} ${c.iso2}`.toLocaleLowerCase('en').includes(query))),
  );
}
export function formatValue(value: number | null, digits = 1) {
  return value === null
    ? 'No observation'
    : `${new Intl.NumberFormat('en', { maximumFractionDigits: digits }).format(value)}%`;
}
export function valueBand(value: number | null) {
  return value === null
    ? 'missing'
    : value > 100
      ? 'above'
      : value >= 75
        ? 'high'
        : value >= 50
          ? 'medium'
          : value >= 25
            ? 'low'
            : 'lowest';
}
export function indicator(code: IndicatorCode): Indicator {
  return indicatorByCode.get(code)!;
}
export function compactObservation(o: Observation) {
  return {
    ...o,
    missing: o.value === null,
    interpretation:
      'An annual national statistic; not an individual assessment or a causal explanation.',
  };
}
