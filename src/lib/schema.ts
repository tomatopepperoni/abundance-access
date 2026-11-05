import { z } from 'zod';

export const INDICATOR_CODES = ['IT.NET.USER.ZS', 'EG.ELC.ACCS.ZS', 'SE.SEC.CMPT.LO.ZS'] as const;
export const indicatorCodeSchema = z.enum(INDICATOR_CODES);
export type IndicatorCode = z.infer<typeof indicatorCodeSchema>;
export const yearSchema = z.number().int().min(2015).max(2025);
const timestamp = z.iso.datetime();
export const countrySchema = z.object({
  code: z.string().regex(/^[A-Z0-9]{3}$/),
  iso2: z.string(),
  name: z.string().min(1),
  region: z.string(),
  incomeLevel: z.string(),
  isAggregate: z.boolean(),
});
export const indicatorSchema = z.object({
  code: indicatorCodeSchema,
  shortName: z.string(),
  name: z.string(),
  unit: z.string(),
  provider: z.string(),
  providerUrl: z.url(),
  definition: z.string(),
  methodology: z.string(),
  limitation: z.string(),
  question: z.string(),
  context: z.string(),
  canExceed100: z.boolean(),
  metadataUrl: z.url(),
});
export const definitionsSchema = z
  .object({
    reviewedAt: z.iso.date(),
    reviewMethod: z.string(),
    distributor: z.string(),
    license: z.string(),
    licenseUrl: z.url(),
    apiDocumentationUrl: z.url(),
    indicators: z.array(indicatorSchema).length(3),
    map: z.object({
      name: z.string(),
      sourceUrl: z.url(),
      documentationUrl: z.url(),
      license: z.string(),
      licenseUrl: z.url(),
      note: z.string(),
    }),
  })
  .superRefine((data, ctx) => {
    if (new Set(data.indicators.map((i) => i.code)).size !== 3)
      ctx.addIssue({ code: 'custom', message: 'Duplicate indicator definitions' });
  });
export const observationSchema = z
  .object({
    countryCode: z.string(),
    countryName: z.string(),
    indicatorCode: indicatorCodeSchema,
    year: yearSchema,
    value: z.number().finite().nonnegative().nullable(),
    unit: z.string(),
    sourceOrganization: z.string().min(1),
    distributor: z.literal('World Bank'),
    sourceUrl: z.url(),
    fetchedAt: timestamp,
    sourceUpdatedAt: z.string().nullable(),
    status: z.enum(['observed', 'reported-null', 'not-returned']),
    rawFile: z.string().nullable(),
    rawRow: z.number().int().nonnegative().nullable(),
    sourceStatus: z.string(),
  })
  .superRefine((o, ctx) => {
    if ((o.status === 'observed') !== (o.value !== null))
      ctx.addIssue({ code: 'custom', message: 'Status/value mismatch' });
    if (o.indicatorCode !== 'SE.SEC.CMPT.LO.ZS' && o.value !== null && o.value > 100)
      ctx.addIssue({ code: 'custom', message: 'Population share exceeds 100' });
    if (o.status !== 'not-returned' && (o.rawFile === null || o.rawRow === null))
      ctx.addIssue({ code: 'custom', message: 'Returned row must retain raw reference' });
  });
export const snapshotSchema = z
  .object({
    schemaVersion: z.literal(1),
    mode: z.literal('official-statistics-snapshot'),
    runId: z.string(),
    fetchedAt: timestamp,
    period: z.object({ start: z.literal(2015), end: z.literal(2025) }),
    countries: z.array(countrySchema).min(1),
    aggregates: z.array(countrySchema),
    indicatorMetadata: z
      .array(
        z.object({
          code: indicatorCodeSchema,
          apiName: z.string(),
          apiSourceNote: z.string(),
          apiSourceOrganization: z.string(),
          sourceUpdatedAt: z.string().nullable(),
        }),
      )
      .length(3),
    observations: z.array(observationSchema),
    rawManifest: z.array(
      z.object({
        file: z.string(),
        url: z.url(),
        fetchedAt: timestamp,
        sha256: z.string().length(64),
        bytes: z.number().int().positive(),
      }),
    ),
  })
  .superRefine((data, ctx) => {
    const ids = new Set(data.countries.map((c) => c.code));
    const aggregateIds = new Set(data.aggregates.map((c) => c.code));
    const metas = new Set(data.indicatorMetadata.map((i) => i.code));
    if (
      ids.size !== data.countries.length ||
      aggregateIds.size !== data.aggregates.length ||
      [...aggregateIds].some((id) => ids.has(id))
    )
      ctx.addIssue({ code: 'custom', message: 'Duplicate country/aggregate code' });
    if (data.countries.some((c) => c.isAggregate) || data.aggregates.some((c) => !c.isAggregate))
      ctx.addIssue({ code: 'custom', message: 'Aggregate mixed into country collection' });
    if (metas.size !== 3)
      ctx.addIssue({ code: 'custom', message: 'Duplicate/missing indicator metadata' });
    const rawFiles = new Set(data.rawManifest.map((f) => f.file));
    const keys = new Set<string>();
    for (const o of data.observations) {
      const key = `${o.countryCode}:${o.indicatorCode}:${o.year}`;
      if (keys.has(key)) ctx.addIssue({ code: 'custom', message: `Duplicate observation ${key}` });
      keys.add(key);
      if (!ids.has(o.countryCode))
        ctx.addIssue({ code: 'custom', message: `Unknown/aggregate country ${o.countryCode}` });
      if (data.countries.find((c) => c.code === o.countryCode)?.name !== o.countryName)
        ctx.addIssue({ code: 'custom', message: `Country name mismatch ${key}` });
      if (!metas.has(o.indicatorCode))
        ctx.addIssue({ code: 'custom', message: `Missing metadata ${key}` });
      if (o.rawFile !== null && !rawFiles.has(o.rawFile))
        ctx.addIssue({ code: 'custom', message: `Broken raw reference ${key}` });
    }
    if (keys.size !== ids.size * 3 * 11)
      ctx.addIssue({
        code: 'custom',
        message: 'Incomplete country × indicator × year grid (missing values must be explicit)',
      });
  });
export type Country = z.infer<typeof countrySchema>;
export type Indicator = z.infer<typeof indicatorSchema>;
export type Observation = z.infer<typeof observationSchema>;
export type Snapshot = z.infer<typeof snapshotSchema>;
