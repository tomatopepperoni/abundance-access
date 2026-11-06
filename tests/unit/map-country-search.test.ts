import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { searchMapCountries, MAP_SEARCH_LIMIT } from '../../src/lib/map-country-search';
import { snapshotSchema } from '../../src/lib/schema';
import mapData from '../../src/content/world-map.json';
import { createStore, observation } from '../../src/lib/query';

const snapshot = snapshotSchema.parse(
  JSON.parse(readFileSync(new URL('../../data/snapshots/latest.json', import.meta.url), 'utf8')),
);
const store = createStore(snapshot);
const mapped = new Set(mapData.features.map((feature) => feature.properties.code));

describe('map country discovery', () => {
  it('leaves the initial map uncluttered and bounds broad-search results with an honest count', () => {
    expect(searchMapCountries(snapshot.countries, '   ')).toEqual({
      countries: [],
      total: 0,
      remaining: 0,
    });
    const broad = searchMapCountries(snapshot.countries, 'a');
    expect(broad.total).toBeGreaterThan(MAP_SEARCH_LIMIT);
    expect(broad.countries).toHaveLength(MAP_SEARCH_LIMIT);
    expect(broad.remaining).toBe(broad.total - MAP_SEARCH_LIMIT);
    expect(broad.countries.map((country) => country.name)).toEqual(
      broad.countries.map((country) => country.name).sort((a, b) => a.localeCompare(b, 'en')),
    );
  });

  it('supports exact ISO2/ISO3 lookup, country names and whitespace without unrelated partial matches', () => {
    for (const query of ['sg', 'SGP', '  Singapore ']) {
      const result = searchMapCountries(snapshot.countries, query);
      expect(result.total).toBe(1);
      expect(result.countries[0].code).toBe('SGP');
    }
    expect(searchMapCountries(snapshot.countries, 'LUX').countries[0].code).toBe('LUX');
    expect(searchMapCountries(snapshot.countries, 'not-a-country')).toEqual({
      countries: [],
      total: 0,
      remaining: 0,
    });
  });

  it('finds every registry economy by code including those not drawn on the low-resolution map', () => {
    expect(snapshot.countries).toHaveLength(217);
    const unmapped = snapshot.countries.filter((country) => !mapped.has(country.code));
    expect(unmapped.length).toBeGreaterThan(0);
    expect(mapped.has('SGP')).toBe(false);
    for (const country of snapshot.countries) {
      const result = searchMapCountries(snapshot.countries, country.code);
      expect(result.total).toBe(1);
      expect(result.countries[0]).toEqual(country);
    }
    expect(searchMapCountries(snapshot.countries, 'WLD').total).toBe(0);
  });

  it('retains the registry identity needed to show real selected-year values and explicit missing values', () => {
    const singapore = searchMapCountries(snapshot.countries, 'SGP').countries[0];
    const missing = observation(store, singapore.code, 'EG.ELC.ACCS.ZS', 2025);
    expect(missing.value).toBeNull();
    const actual = observation(store, singapore.code, 'IT.NET.USER.ZS', 2022);
    expect(actual.countryCode).toBe('SGP');
    expect(actual.year).toBe(2022);
    expect(actual.value).not.toBeNull();
  });
});
