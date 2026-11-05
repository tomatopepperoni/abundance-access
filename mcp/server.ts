import { readFile } from 'node:fs/promises';
import { McpServer } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { z } from 'zod';
import {
  snapshotSchema,
  indicatorCodeSchema,
  yearSchema,
  INDICATOR_CODES,
} from '../src/lib/schema';
import {
  createStore,
  definitions,
  findCountries,
  series,
  compare,
  compactObservation,
} from '../src/lib/query';

const snapshot = snapshotSchema.parse(
  JSON.parse(await readFile(new URL('../data/snapshots/latest.json', import.meta.url), 'utf8')),
);
const store = createStore(snapshot);
const countryCode = z
  .string()
  .regex(/^[A-Z0-9]{3}$/)
  .refine(
    (code) => store.countryByCode.has(code),
    'Unknown country/economy code; aggregates are excluded.',
  );
const codes = z
  .array(indicatorCodeSchema)
  .min(1)
  .max(3)
  .refine((v) => new Set(v).size === v.length, 'Duplicate indicator code');
const annotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};
const context = {
  mode: snapshot.mode,
  datasetRunId: snapshot.runId,
  collectionCompletedAt: snapshot.fetchedAt,
  metadataReviewedAt: definitions.reviewedAt,
  period: snapshot.period,
  note: 'Annual national statistics from a collected snapshot, not live conditions. Values are not an individual diagnosis, a composite score, or causal evidence.',
};
function result(data: Record<string, unknown>) {
  const payload = { ...context, ...data };
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(payload) }],
    structuredContent: payload,
  };
}
export function createServer() {
  const server = new McpServer(
    { name: 'abundance-access', version: '1.0.0' },
    {
      instructions:
        'Read-only, provenance-preserving country statistics. Report missing values and observation years. Never infer policy effects, individual ability, or educational effectiveness from these indicators.',
    },
  );
  server.registerTool(
    'list_countries',
    {
      title: 'List countries and economies',
      description:
        'Search the country/economy registry. Regional and income aggregates are excluded. Results are paginated.',
      inputSchema: z
        .object({
          query: z.string().max(200).default(''),
          offset: z.number().int().min(0).max(300).default(0),
          limit: z.number().int().min(1).max(100).default(50),
        })
        .strict(),
      annotations,
    },
    async ({ query, offset, limit }) => {
      const countries = findCountries(snapshot.countries, query);
      return result({
        total: countries.length,
        offset,
        limit,
        nextOffset: offset + limit < countries.length ? offset + limit : null,
        excludedAggregateCount: snapshot.aggregates.length,
        countries: countries.slice(offset, offset + limit),
      });
    },
  );
  server.registerTool(
    'get_indicator_metadata',
    {
      title: 'Get indicator definitions and limitations',
      description:
        'Return original-provider attribution, World Bank API metadata, manually reviewed methodology, units, and limitations.',
      inputSchema: z.object({ indicatorCode: indicatorCodeSchema }).strict(),
      annotations,
    },
    async ({ indicatorCode }) =>
      result({
        indicator: definitions.indicators.find((i) => i.code === indicatorCode),
        sourceMetadata: snapshot.indicatorMetadata.find((i) => i.code === indicatorCode),
        distributor: definitions.distributor,
        license: definitions.license,
        licenseUrl: definitions.licenseUrl,
      }),
  );
  server.registerTool(
    'get_country_metrics',
    {
      title: 'Get annual country metrics',
      description:
        'Return up to 33 country/indicator/year records with explicit missing values. No carry-forward or zero substitution.',
      inputSchema: z
        .object({
          countryCode,
          indicatorCodes: codes.default([...INDICATOR_CODES]),
          startYear: yearSchema.default(2015),
          endYear: yearSchema.default(2025),
        })
        .strict()
        .refine((v) => v.startYear <= v.endYear, 'startYear must not exceed endYear'),
      annotations,
    },
    async ({ countryCode: code, indicatorCodes, startYear, endYear }) =>
      result({
        country: store.countryByCode.get(code),
        records: indicatorCodes.flatMap((i) =>
          series(store, code, i)
            .filter((o) => o.year >= startYear && o.year <= endYear)
            .map(compactObservation),
        ),
      }),
  );
  server.registerTool(
    'compare_countries',
    {
      title: 'Compare countries in the same year',
      description:
        'Compare 2–3 distinct countries for one common observation year; preserve source URLs, collection dates, units, and missing states.',
      inputSchema: z
        .object({
          countryCodes: z
            .array(countryCode)
            .min(2)
            .max(3)
            .refine((v) => new Set(v).size === v.length, 'Duplicate country code'),
          indicatorCodes: codes.default([...INDICATOR_CODES]),
          year: yearSchema,
        })
        .strict(),
      annotations,
    },
    async ({ countryCodes, indicatorCodes, year }) =>
      result({
        year,
        countryCodes,
        indicatorCodes,
        records: compare(store, countryCodes, indicatorCodes, year).map(compactObservation),
      }),
  );
  return server;
}
serveStdio(createServer, { onerror: (error) => console.error(error.message) });
