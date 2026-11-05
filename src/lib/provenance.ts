import type { DataStore } from './query';
import type { Observation } from './schema';

// Add a revision only after its raw files and manifest hashes have been verified.
// A new collection is not automatically an archived, published source.
export const PUBLISHED_SNAPSHOTS: Readonly<Record<string, string>> = Object.freeze({
  '2026-11-05T00-19-21-915Z': '4793ce437ffa71f53217504de3b3ab69132254e7',
});
const repository = 'https://github.com/tomatopepperoni/abundance-access';

export function frozenSourceReference(store: DataStore, observation: Observation) {
  const revision = Object.hasOwn(PUBLISHED_SNAPSHOTS, store.snapshot.runId)
    ? PUBLISHED_SNAPSHOTS[store.snapshot.runId]
    : undefined;
  const { rawFile, rawRow } = observation;
  if (!revision || !rawFile || rawRow === null || !Number.isSafeInteger(rawRow) || rawRow < 0)
    return null;
  const prefix = `data/raw/${store.snapshot.runId}/`;
  if (!rawFile.startsWith(prefix)) return null;
  const filename = rawFile.slice(prefix.length);
  if (
    !/^observations-(?:IT\.NET\.USER\.ZS|EG\.ELC\.ACCS\.ZS|SE\.SEC\.CMPT\.LO\.ZS)-[1-3]\.json$/.test(
      filename,
    )
  )
    return null;
  if (!filename.startsWith(`observations-${observation.indicatorCode}-`)) return null;
  const manifest = store.snapshot.rawManifest.find((entry) => entry.file === rawFile);
  const source = store.byKey.get(
    `${observation.countryCode}:${observation.indicatorCode}:${observation.year}`,
  );
  if (
    !manifest ||
    !/^[a-f0-9]{64}$/.test(manifest.sha256) ||
    !source ||
    source.rawFile !== rawFile ||
    source.rawRow !== rawRow ||
    source.value !== observation.value
  )
    return null;
  return {
    file: rawFile,
    rawRecordIndex: rawRow,
    sha256: manifest.sha256,
    collectedAt: manifest.fetchedAt,
    revision,
    url: `${repository}/blob/${revision}/${rawFile.split('/').map(encodeURIComponent).join('/')}`,
  };
}
