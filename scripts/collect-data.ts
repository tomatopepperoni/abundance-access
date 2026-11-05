import { readFile, mkdir, writeFile, rename } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { definitionsSchema, snapshotSchema } from '../src/lib/schema';
import {
  makeRequester,
  normalizeCountries,
  normalizeObservations,
  parsePage,
  type PageRows,
} from './world-bank';

const root = fileURLToPath(new URL('../', import.meta.url));
const definitions = definitionsSchema.parse(
  JSON.parse(await readFile(new URL('../src/content/indicators.json', import.meta.url), 'utf8')),
);
const runId = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');
const rawDir = `data/raw/${runId}`;
const get = makeRequester();
const manifest: { file: string; url: string; fetchedAt: string; sha256: string; bytes: number }[] =
  [];
const report: {
  runId: string;
  startedAt: string;
  finishedAt?: string;
  status: string;
  pilot?: unknown;
  counts?: unknown;
  requests: unknown[];
  errors: string[];
  fallbacks: unknown[];
} = {
  runId,
  startedAt: new Date().toISOString(),
  status: 'running',
  requests: [],
  errors: [],
  fallbacks: [],
};
await mkdir(`${root}${rawDir}`, { recursive: true });
await mkdir(`${root}reports/data-collection`, { recursive: true });
async function raw(url: string, name: string) {
  const attempts: unknown[] = [];
  try {
    const text = await get(url, (attempt, status) => attempts.push({ attempt, status }));
    const fetchedAt = new Date().toISOString(),
      file = `${rawDir}/${name}`;
    await writeFile(`${root}${file}`, text);
    manifest.push({
      file,
      url,
      fetchedAt,
      sha256: createHash('sha256').update(text).digest('hex'),
      bytes: Buffer.byteLength(text),
    });
    report.requests.push({ url, file, fetchedAt, attempts, status: 'success' });
    return { text, file, fetchedAt };
  } catch (error) {
    report.requests.push({ url, attempts, status: 'failed', error: String(error) });
    throw error;
  }
}
async function pages(path: string, name: string) {
  const result: PageRows[] = [];
  let page = 1,
    totalPages = 1,
    total = 0;
  do {
    const separator = path.includes('?') ? '&' : '?';
    const response = await raw(
      `https://api.worldbank.org/v2/${path}${separator}format=json&per_page=1000&page=${page}`,
      `${name}-${page}.json`,
    );
    const parsed = parsePage(JSON.parse(response.text));
    if (parsed.meta.page !== page || parsed.meta.pages > 100)
      throw new Error('Invalid pagination metadata');
    totalPages = parsed.meta.pages;
    total = parsed.meta.total;
    result.push({
      rows: parsed.rows,
      file: response.file,
      fetchedAt: response.fetchedAt,
      sourceUpdatedAt: parsed.meta.lastupdated ?? null,
    });
    page++;
  } while (page <= totalPages);
  if (result.reduce((n, p) => n + p.rows.length, 0) !== total)
    throw new Error(`Pagination row count mismatch for ${name}`);
  return result;
}
try {
  const pilot = await pages(
    'country/KOR;IND;KEN/indicator/IT.NET.USER.ZS?date=2022',
    'pilot-internet',
  );
  if (!pilot.flatMap((p) => p.rows).some((r) => (r as { value: unknown }).value !== null))
    throw new Error('Pilot returned no numeric observations');
  report.pilot = {
    countries: ['KOR', 'IND', 'KEN'],
    year: 2022,
    rows: pilot.flatMap((p) => p.rows).length,
    status: 'success',
  };
  console.log('Pilot successful; collecting countries and three indicators.');
  const all = normalizeCountries((await pages('country', 'countries')).flatMap((p) => p.rows));
  const countries = all.filter((c) => !c.isAggregate),
    aggregates = all.filter((c) => c.isAggregate);
  const indicatorMetadata = [];
  const observations = [];
  for (const definition of definitions.indicators) {
    const info = await pages(`indicator/${definition.code}`, 'metadata-' + definition.code);
    const meta = info[0].rows[0] as {
      id: string;
      name: string;
      sourceNote: string;
      sourceOrganization: string;
    };
    if (meta.id !== definition.code || !meta.sourceOrganization || !meta.sourceNote)
      throw new Error('Invalid source indicator metadata');
    const rows = await pages(
      `country/all/indicator/${definition.code}?date=2015:2025`,
      'observations-' + definition.code,
    );
    indicatorMetadata.push({
      code: definition.code,
      apiName: meta.name,
      apiSourceNote: meta.sourceNote,
      apiSourceOrganization: meta.sourceOrganization,
      sourceUpdatedAt: rows[0].sourceUpdatedAt,
    });
    observations.push(...normalizeObservations(countries, definition, rows));
    console.log(
      `${definition.code}: ${rows.reduce((n, p) => n + p.rows.length, 0)} source rows retained.`,
    );
  }
  const snapshot = snapshotSchema.parse({
    schemaVersion: 1,
    mode: 'official-statistics-snapshot',
    runId,
    fetchedAt: new Date().toISOString(),
    period: { start: 2015, end: 2025 },
    countries,
    aggregates,
    indicatorMetadata,
    observations,
    rawManifest: manifest,
  });
  await mkdir(`${root}data/snapshots`, { recursive: true });
  const text = JSON.stringify(snapshot);
  await writeFile(`${root}data/snapshots/${runId}.json`, text);
  await writeFile(`${root}data/snapshots/latest.json.tmp`, text);
  await rename(`${root}data/snapshots/latest.json.tmp`, `${root}data/snapshots/latest.json`);
  report.status = 'success';
  report.counts = {
    countries: countries.length,
    aggregates: aggregates.length,
    observations: observations.length,
    observed: observations.filter((o) => o.value !== null).length,
    missing: observations.filter((o) => o.value === null).length,
  };
  console.log(JSON.stringify(report.counts));
} catch (error) {
  report.status = 'failed';
  report.errors.push(String(error));
  process.exitCode = 1;
  console.error(
    'Collection failed. Existing latest snapshot has not been replaced:',
    String(error),
  );
  // A failed API run never creates a fake snapshot. Record official CSV fallback access separately.
  for (const indicator of definitions.indicators) {
    const url = `https://api.worldbank.org/v2/en/indicator/${indicator.code}?downloadformat=csv`;
    try {
      await new Promise((resolve) => setTimeout(resolve, 1100));
      const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
      report.fallbacks.push({
        url,
        status: r.status,
        contentType: r.headers.get('content-type'),
        note: 'Official CSV fallback availability check only; not normalized or substituted.',
      });
      await r.body?.cancel();
    } catch (e) {
      report.fallbacks.push({ url, error: String(e) });
    }
  }
} finally {
  report.finishedAt = new Date().toISOString();
  await writeFile(`${root}reports/data-collection/${runId}.json`, JSON.stringify(report, null, 2));
}
