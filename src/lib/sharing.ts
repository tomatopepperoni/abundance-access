import { z } from 'zod';
import { indicatorCodeSchema, yearSchema } from './schema';
import type { DataStore } from './query';
import type { Selection } from './research';

const shareSchema = z
  .object({
    v: z.literal('1'),
    countries: z
      .array(z.string().regex(/^[A-Z0-9]{3}$/))
      .min(2)
      .max(3),
    year: yearSchema,
    indicator: indicatorCodeSchema,
    snapshot: z
      .string()
      .min(1)
      .max(200)
      .regex(/^[A-Za-z0-9._:-]+$/),
  })
  .strict();
export type SharedComparison =
  | { status: 'none' | 'invalid' }
  | { status: 'ready' | 'mismatch'; selection: Selection; snapshotRunId: string };
const allowed = ['v', 'countries', 'year', 'indicator', 'snapshot'];

function validateCountries(codes: string[], store: DataStore) {
  if (new Set(codes).size !== codes.length || codes.some((code) => !store.countryByCode.has(code)))
    throw new Error('Unknown, aggregate or duplicate country');
}

export function readSharedComparison(hash: string, store: DataStore): SharedComparison {
  if (!hash.startsWith('#compare?')) return { status: 'none' };
  try {
    if (hash.length > 2000) throw new Error('Oversized comparison link');
    const params = new URLSearchParams(hash.slice('#compare?'.length));
    if (
      [...params.keys()].some((key) => !allowed.includes(key)) ||
      allowed.some((key) => params.getAll(key).length !== 1) ||
      !/^\d{4}$/.test(params.get('year') ?? '')
    )
      throw new Error('Invalid parameters');
    const data = shareSchema.parse({
      v: params.get('v'),
      countries: params.get('countries')?.split(','),
      year: Number(params.get('year')),
      indicator: params.get('indicator'),
      snapshot: params.get('snapshot'),
    });
    validateCountries(data.countries, store);
    return {
      status: data.snapshot === store.snapshot.runId ? 'ready' : 'mismatch',
      selection: { countryCodes: data.countries, indicatorCode: data.indicator, year: data.year },
      snapshotRunId: data.snapshot,
    };
  } catch {
    return { status: 'invalid' };
  }
}

export function createComparisonLink(baseUrl: string, selection: Selection, store: DataStore) {
  const data = shareSchema.parse({
    v: '1',
    countries: selection.countryCodes,
    year: selection.year,
    indicator: selection.indicatorCode,
    snapshot: store.snapshot.runId,
  });
  validateCountries(data.countries, store);
  const url = new URL(baseUrl);
  url.search = '';
  url.hash = `compare?${new URLSearchParams({
    v: data.v,
    countries: data.countries.join(','),
    year: String(data.year),
    indicator: data.indicator,
    snapshot: data.snapshot,
  })}`;
  return url.toString();
}
