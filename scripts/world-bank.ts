import { z } from 'zod';
import type { Country, Indicator, Observation } from '../src/lib/schema';

const apiMeta = z
  .object({
    page: z.coerce.number().int().positive(),
    pages: z.coerce.number().int().positive(),
    total: z.coerce.number().int().nonnegative(),
    lastupdated: z.string().optional(),
  })
  .passthrough();
export function parsePage(payload: unknown) {
  const data = z.tuple([apiMeta, z.array(z.unknown()).nullable()]).parse(payload);
  return { meta: data[0], rows: data[1] ?? [] };
}
export function normalizeCountries(rows: unknown[]): Country[] {
  const rowSchema = z
    .object({
      id: z.string().regex(/^[A-Z0-9]{3}$/),
      iso2Code: z.string(),
      name: z.string(),
      region: z.object({ id: z.string(), value: z.string() }),
      incomeLevel: z.object({ value: z.string() }),
    })
    .passthrough();
  const result = rows.map((raw) => {
    const row = rowSchema.parse(raw);
    return {
      code: row.id,
      iso2: row.iso2Code,
      name: row.name,
      region: row.region.value.trim(),
      incomeLevel: row.incomeLevel.value,
      isAggregate: row.region.id === 'NA',
    };
  });
  if (new Set(result.map((c) => c.code)).size !== result.length)
    throw new Error('Duplicate country code returned by source');
  return result.sort((a, b) => a.name.localeCompare(b.name, 'en'));
}
export type PageRows = {
  rows: unknown[];
  file: string;
  fetchedAt: string;
  sourceUpdatedAt: string | null;
};
export function normalizeObservations(
  countries: Country[],
  indicator: Indicator,
  pages: PageRows[],
): Observation[] {
  const schema = z
    .object({
      indicator: z.object({ id: z.string() }),
      country: z.object({ value: z.string() }),
      countryiso3code: z.string(),
      date: z.string(),
      value: z.number().finite().nullable(),
      obs_status: z.string().optional(),
    })
    .passthrough();
  const index = new Map<string, { row: z.infer<typeof schema>; page: PageRows; rawRow: number }>();
  const allIds = new Set(countries.map((c) => c.code));
  pages.forEach((page) =>
    page.rows.forEach((raw, rawRow) => {
      const row = schema.parse(raw);
      if (row.indicator.id !== indicator.code)
        throw new Error('API returned a different indicator');
      if (!allIds.has(row.countryiso3code)) return; // Aggregates are retained in raw data, never mixed into the country grid.
      const year = Number(row.date);
      if (!Number.isInteger(year) || year < 2015 || year > 2025)
        throw new Error('API returned an out-of-range year');
      const key = `${row.countryiso3code}:${year}`;
      if (index.has(key)) throw new Error(`Duplicate raw observation ${key}`);
      index.set(key, { row, page, rawRow });
    }),
  );
  if (!pages.length) throw new Error('No successful pages: cannot create a statistics snapshot');
  return countries.flatMap((country) =>
    Array.from({ length: 11 }, (_, i) => {
      const year = 2015 + i,
        found = index.get(`${country.code}:${year}`),
        page = found?.page ?? pages[0];
      const value = found?.row.value ?? null;
      return {
        countryCode: country.code,
        countryName: country.name,
        indicatorCode: indicator.code,
        year,
        value,
        unit: indicator.unit,
        sourceOrganization: indicator.provider,
        distributor: 'World Bank' as const,
        sourceUrl: `https://api.worldbank.org/v2/country/${country.code}/indicator/${indicator.code}?date=${year}&format=json`,
        fetchedAt: page.fetchedAt,
        sourceUpdatedAt: page.sourceUpdatedAt,
        status: found
          ? value === null
            ? ('reported-null' as const)
            : ('observed' as const)
          : ('not-returned' as const),
        rawFile: found ? page.file : null,
        rawRow: found ? found.rawRow : null,
        sourceStatus: found?.row.obs_status ?? '',
      };
    }),
  );
}
export type FetchPolicy = { timeoutMs: number; attempts: number; minIntervalMs: number };
export const defaultPolicy: FetchPolicy = { timeoutMs: 8000, attempts: 3, minIntervalMs: 1100 };
export function makeRequester(
  policy = defaultPolicy,
  request: typeof fetch = fetch,
  sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms)),
) {
  let lastStart = 0;
  return async function get(
    url: string,
    onAttempt?: (attempt: number, status: number | string) => void,
  ) {
    let failure: unknown;
    for (let attempt = 1; attempt <= policy.attempts; attempt++) {
      await sleep(Math.max(0, policy.minIntervalMs - (Date.now() - lastStart)));
      lastStart = Date.now();
      try {
        const response = await request(url, {
          signal: AbortSignal.timeout(policy.timeoutMs),
          headers: {
            Accept: 'application/json',
            'User-Agent': 'AbundanceAccess/1.0 (public statistics research)',
          },
        });
        onAttempt?.(attempt, response.status);
        if (response.ok) return await response.text();
        const retryable = response.status === 429 || response.status >= 500;
        if (!retryable) throw new Error(`Non-retryable HTTP ${response.status}`);
        const retryAfter = response.headers.get('retry-after');
        const seconds = retryAfter ? Number(retryAfter) : 0;
        const parsed = Number.isFinite(seconds)
          ? seconds * 1000
          : Math.max(0, Date.parse(retryAfter!) - Date.now());
        failure = new Error(`HTTP ${response.status}`);
        if (attempt < policy.attempts)
          await sleep(Math.min(10000, Math.max(1000 * 2 ** (attempt - 1), parsed || 0)));
      } catch (error) {
        failure = error;
        if (error instanceof Error && error.message.startsWith('Non-retryable')) throw error;
        onAttempt?.(attempt, 'network-or-timeout');
        if (attempt < policy.attempts) await sleep(1000 * 2 ** (attempt - 1));
      }
    }
    throw failure;
  };
}
