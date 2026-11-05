import { z } from 'zod';
import { INDICATOR_CODES, indicatorCodeSchema, observationSchema, yearSchema } from './schema';
import { indicator, observation, type DataStore } from './query';
import type { Selection } from './research';

const countryCodesSchema = z
  .array(z.string().regex(/^[A-Z0-9]{3}$/))
  .min(2)
  .max(3)
  .refine((codes) => new Set(codes).size === codes.length, 'Duplicate country code');

function validateCountries(store: DataStore, countryCodes: string[]) {
  const codes = countryCodesSchema.parse(countryCodes);
  if (codes.some((code) => !store.countryByCode.has(code)))
    throw new Error('Unknown country/economy code; aggregate codes are excluded.');
  return codes;
}

export type YearCompleteness = {
  year: number;
  observed: number;
  missing: number;
  total: number;
  complete: boolean;
};

/** Completeness always covers all three indicators, not just the chart's indicator. */
export function yearCompleteness(store: DataStore, countryCodes: string[]) {
  const codes = validateCountries(store, countryCodes);
  const total = codes.length * INDICATOR_CODES.length;
  const years: YearCompleteness[] = Array.from(
    { length: store.snapshot.period.end - store.snapshot.period.start + 1 },
    (_, index) => {
      const year = store.snapshot.period.start + index;
      const observed = codes.reduce(
        (count, code) =>
          count +
          INDICATOR_CODES.filter(
            (indicatorCode) => observation(store, code, indicatorCode, year).value !== null,
          ).length,
        0,
      );
      return { year, observed, missing: total - observed, total, complete: observed === total };
    },
  );
  return {
    years,
    latestCompleteYear: years.filter((year) => year.complete).at(-1)?.year ?? null,
  };
}

const pairSchema = z.object({
  leftCountryCode: z.string(),
  rightCountryCode: z.string(),
  difference: z.number().finite().nullable(),
  unit: z.literal('percentage points'),
});

/** Retains source observations so saved calculations remain inspectable after filters change. */
export const comparisonSummarySchema = z
  .object({
    schemaVersion: z.literal(1),
    snapshotRunId: z.string().min(1).max(200),
    indicatorCode: indicatorCodeSchema,
    year: yearSchema,
    countryCodes: countryCodesSchema,
    observations: z.array(observationSchema).min(2).max(3),
    pairs: z.array(pairSchema).min(1).max(3),
  })
  .superRefine((summary, ctx) => {
    const definition = indicator(summary.indicatorCode);
    const rowsMatch =
      summary.observations.length === summary.countryCodes.length &&
      summary.observations.every(
        (row, index) =>
          row.countryCode === summary.countryCodes[index] &&
          row.indicatorCode === summary.indicatorCode &&
          row.year === summary.year &&
          row.unit === definition.unit,
      );
    if (!rowsMatch) {
      ctx.addIssue({ code: 'custom', message: 'Summary observations do not match their context' });
      return;
    }
    if (
      summary.observations.some((row) => {
        try {
          const source = new URL(row.sourceUrl);
          return source.protocol !== 'https:' || source.hostname !== 'api.worldbank.org';
        } catch {
          return true;
        }
      })
    )
      ctx.addIssue({
        code: 'custom',
        message: 'Summary source must remain a World Bank HTTPS URL',
      });
    let pairIndex = 0;
    summary.observations.forEach((left, index) => {
      summary.observations.slice(index + 1).forEach((right) => {
        const pair = summary.pairs[pairIndex++];
        const expected =
          left.value === null || right.value === null ? null : left.value - right.value;
        if (
          !pair ||
          pair.leftCountryCode !== left.countryCode ||
          pair.rightCountryCode !== right.countryCode ||
          pair.difference !== expected
        )
          ctx.addIssue({ code: 'custom', message: 'Summary calculation or pair context mismatch' });
      });
    });
    if (pairIndex !== summary.pairs.length)
      ctx.addIssue({ code: 'custom', message: 'Unexpected comparison pairs' });
  });

export type ComparisonSummary = z.infer<typeof comparisonSummarySchema>;

/** Signed, same-year differences only. No ranking, causal inference or missing-value fill. */
export function comparisonSummary(store: DataStore, selection: Selection): ComparisonSummary {
  const countryCodes = validateCountries(store, selection.countryCodes);
  const year = yearSchema.parse(selection.year);
  const indicatorCode = indicatorCodeSchema.parse(selection.indicatorCode);
  const observations = countryCodes.map((code) => observation(store, code, indicatorCode, year));
  const pairs = observations.flatMap((left, index) =>
    observations.slice(index + 1).map((right) => ({
      leftCountryCode: left.countryCode,
      rightCountryCode: right.countryCode,
      difference: left.value === null || right.value === null ? null : left.value - right.value,
      unit: 'percentage points' as const,
    })),
  );
  // Parsing also returns an independent copy, rather than references into the live store.
  return comparisonSummarySchema.parse({
    schemaVersion: 1,
    snapshotRunId: store.snapshot.runId,
    indicatorCode,
    year,
    countryCodes,
    observations,
    pairs,
  });
}

export function formatDifference(value: number | null) {
  if (value === null) return 'Not calculated';
  return `${new Intl.NumberFormat('en', {
    maximumFractionDigits: 1,
    signDisplay: 'exceptZero',
  }).format(value)} pp`;
}
