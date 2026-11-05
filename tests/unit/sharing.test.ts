import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { snapshotSchema } from '../../src/lib/schema';
import { createStore } from '../../src/lib/query';
import { createComparisonLink, readSharedComparison } from '../../src/lib/sharing';
const store = createStore(
  snapshotSchema.parse(
    JSON.parse(readFileSync(new URL('../../data/snapshots/latest.json', import.meta.url), 'utf8')),
  ),
);
const selection = {
  countryCodes: ['KOR', 'IND', 'KEN'],
  indicatorCode: 'IT.NET.USER.ZS' as const,
  year: 2022,
};
const link = createComparisonLink(
  'https://example.org/repository/?private=secret#notes',
  selection,
  store,
);
describe('validated comparison links', () => {
  it('roundtrips selection and snapshot on a repository subpath without unrelated data', () => {
    expect(new URL(link).pathname).toBe('/repository/');
    expect(new URL(link).search).toBe('');
    expect(link).not.toContain('private');
    expect(readSharedComparison(new URL(link).hash, store)).toEqual({
      status: 'ready',
      selection,
      snapshotRunId: store.snapshot.runId,
    });
  });
  it('rejects incomplete, aggregate, duplicate, malformed and unknown fields', () => {
    for (const patch of [
      'countries=WLD%2CIND',
      'countries=KEN%2CKEN',
      'countries=XXX%2CIND',
      'year=2030',
      'year=2022.0',
      'indicator=made-up',
      'v=2',
      'snapshot=',
      'countries=KEN',
    ]) {
      const url = new URL(link),
        params = new URLSearchParams(url.hash.split('?')[1]);
      const [key, value] = patch.split('=');
      params.set(key, decodeURIComponent(value));
      expect(readSharedComparison(`#compare?${params}`, store).status).toBe('invalid');
    }
    expect(readSharedComparison(`${new URL(link).hash}&year=2021`, store).status).toBe('invalid');
    expect(readSharedComparison(`${new URL(link).hash}&notes=private`, store).status).toBe(
      'invalid',
    );
    expect(readSharedComparison('#compare?year=2022', store).status).toBe('invalid');
    expect(readSharedComparison('#compare', store).status).toBe('none');
  });
  it('reports a snapshot mismatch instead of promising original values', () => {
    const hash = new URL(link).hash.replace(
      encodeURIComponent(store.snapshot.runId),
      'older-snapshot',
    );
    expect(readSharedComparison(hash, store)).toEqual({
      status: 'mismatch',
      selection,
      snapshotRunId: 'older-snapshot',
    });
  });
});
