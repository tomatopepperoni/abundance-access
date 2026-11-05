import { provenanceCopy as p } from '../content/provenance-en';
import { frozenSourceReference } from '../lib/provenance';
import type { DataStore } from '../lib/query';
import type { Observation } from '../lib/schema';
import { Icon } from './Icon';

export function SourceReference({
  store,
  observation,
}: {
  store: DataStore;
  observation: Observation;
}) {
  const reference = frozenSourceReference(store, observation);
  if (!reference) return <p className="small muted">{p.unavailable}</p>;
  return (
    <div className="frozen-source-reference">
      <a className="text-link" href={reference.url} target="_blank" rel="noreferrer">
        {p.open}
        <Icon name="external" size={14} />
      </a>
      <dl className="source-facts">
        <div>
          <dt>{p.recordIndex}</dt>
          <dd>{reference.rawRecordIndex}</dd>
        </div>
        <div>
          <dt>{p.hash}</dt>
          <dd className="mono provenance-hash">{reference.sha256}</dd>
        </div>
      </dl>
      <p className="small muted">{p.recordHelp}</p>
      <p className="small muted">{p.archived}</p>
    </div>
  );
}

export function ComparabilityNotice() {
  return <p className="comparability-notice small">{p.comparability}</p>;
}
