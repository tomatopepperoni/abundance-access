import { readFile, writeFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import type { FeatureCollection, Geometry } from 'geojson';
const input = new URL('../data/raw/natural-earth-110m.geojson', import.meta.url);
const raw = await readFile(input, 'utf8');
const data = JSON.parse(raw) as FeatureCollection<Geometry, Record<string, string>>;
const snapshot = JSON.parse(
  await readFile(new URL('../data/snapshots/latest.json', import.meta.url), 'utf8'),
) as { countries: { code: string }[] };
const countryCodes = new Set(snapshot.countries.map((c) => c.code));
if (data.type !== 'FeatureCollection' || data.features.length < 150)
  throw new Error('Invalid Natural Earth data');
const mapped: FeatureCollection<Geometry, { code: string; name: string }> = {
  type: 'FeatureCollection',
  features: data.features
    .filter((f) => f.properties.ADM0_A3 !== 'ATA')
    .map((f) => {
      const p = f.properties;
      const candidates = [p.WB_A3, p.ISO_A3_EH, p.ISO_A3, p.ADM0_A3];
      const code =
        candidates.find((code) => countryCodes.has(code)) ??
        (['KOS', 'KSV'].some((code) => candidates.includes(code)) ? 'XKX' : p.ADM0_A3);
      return {
        type: 'Feature',
        properties: { code, name: p.NAME_EN || p.ADMIN },
        geometry: f.geometry,
      };
    }),
};
await writeFile(new URL('../src/content/world-map.json', import.meta.url), JSON.stringify(mapped));
await writeFile(
  new URL('../data/map-provenance.json', import.meta.url),
  JSON.stringify(
    {
      sourceUrl:
        'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson',
      fetchedAt: (await stat(input)).mtime.toISOString(),
      preparedAt: new Date().toISOString(),
      rawFile: 'data/raw/natural-earth-110m.geojson',
      sha256: createHash('sha256').update(raw).digest('hex'),
      license: 'Public domain',
      licenseUrl: 'https://www.naturalearthdata.com/about/terms-of-use/',
      transform:
        'Removed Antarctica; retained original polygon coordinates. Matched existing WB_A3, ISO_A3_EH, ISO_A3 and ADM0_A3 attributes against the World Bank country registry, in that order; KOS/KSV alias maps to XKX. Unmatched polygons retain ADM0_A3 and are labelled outside the registry.',
    },
    null,
    2,
  ),
);
console.log(`${mapped.features.length} map features prepared.`);
