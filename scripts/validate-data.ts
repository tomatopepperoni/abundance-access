import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { snapshotSchema, definitionsSchema } from '../src/lib/schema';
import type { FeatureCollection } from 'geojson';
const root = new URL('../', import.meta.url);
const definitions = definitionsSchema.parse(
  JSON.parse(await readFile(new URL('src/content/indicators.json', root), 'utf8')),
);
const snapshot = snapshotSchema.parse(
  JSON.parse(await readFile(new URL('data/snapshots/latest.json', root), 'utf8')),
);
for (const o of snapshot.observations) {
  const def = definitions.indicators.find((i) => i.code === o.indicatorCode)!;
  if (o.unit !== def.unit || o.sourceOrganization !== def.provider)
    throw new Error('Definition/observation provenance mismatch');
}
const pages = new Map<string, unknown[]>();
for (const file of snapshot.rawManifest) {
  const raw = await readFile(new URL(file.file, root));
  if (createHash('sha256').update(raw).digest('hex') !== file.sha256 || raw.length !== file.bytes)
    throw new Error(`Raw integrity mismatch: ${file.file}`);
  const parsed = JSON.parse(raw.toString());
  pages.set(file.file, parsed[1] ?? []);
}
for (const o of snapshot.observations) {
  if (o.rawFile === null) continue;
  const row = pages.get(o.rawFile)![o.rawRow!] as {
    value: number | null;
    countryiso3code: string;
    indicator: { id: string };
    date: string;
  };
  if (
    row.value !== o.value ||
    row.countryiso3code !== o.countryCode ||
    row.indicator.id !== o.indicatorCode ||
    Number(row.date) !== o.year
  )
    throw new Error('Normalized value differs from raw source');
}
const map = JSON.parse(
  await readFile(new URL('src/content/world-map.json', root), 'utf8'),
) as FeatureCollection;
if (map.type !== 'FeatureCollection' || map.features.length < 150) throw new Error('Invalid map');
const provenance = JSON.parse(await readFile(new URL('data/map-provenance.json', root), 'utf8'));
if (
  createHash('sha256')
    .update(await readFile(new URL(provenance.rawFile, root)))
    .digest('hex') !== provenance.sha256
)
  throw new Error('Map integrity mismatch');
console.log(
  JSON.stringify(
    {
      countries: snapshot.countries.length,
      aggregates: snapshot.aggregates.length,
      observations: snapshot.observations.length,
      observed: snapshot.observations.filter((o) => o.value !== null).length,
      rawFiles: pages.size,
      mapFeatures: map.features.length,
      manualReview: definitions.reviewedAt,
    },
    null,
    2,
  ),
);
