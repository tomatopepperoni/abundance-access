import { analysisCopy as a } from '../content/analysis-en';
import {
  comparisonSummary,
  formatDifference,
  yearCompleteness,
  type ComparisonSummary,
} from '../lib/analysis';
import { formatValue, indicator, type DataStore } from '../lib/query';
import type { Selection } from '../lib/research';
import { SourceReference } from './SourceReference';

export function CommonYearControl({
  store,
  selection,
  onYearChange,
}: {
  store: DataStore;
  selection: Selection;
  onYearChange: (year: number) => void;
}) {
  if (selection.countryCodes.length < 2) return null;
  const { years, latestCompleteYear } = yearCompleteness(store, selection.countryCodes);
  const current = years.find((entry) => entry.year === selection.year)!;
  return (
    <div className="comparison-completeness">
      <div className="completeness-actions">
        <span data-testid="comparison-completeness">
          <strong>{a.coverage}: </strong>
          {current.observed} / {current.total} · {selection.year}
        </span>
        <button
          className="button outline"
          disabled={latestCompleteYear === null || latestCompleteYear === selection.year}
          onClick={() => latestCompleteYear !== null && onYearChange(latestCompleteYear)}
        >
          {latestCompleteYear === null
            ? a.noCompleteYear
            : `${a.latestComplete} (${latestCompleteYear})`}
        </button>
      </div>
      <p className="small muted">
        {a.allThree}{' '}
        {latestCompleteYear === null
          ? a.noneComplete
          : latestCompleteYear === selection.year
            ? a.sameComplete
            : ''}
      </p>
      <details className="completeness-details">
        <summary>{a.availability}</summary>
        <table>
          <thead>
            <tr>
              <th scope="col">{a.year}</th>
              <th scope="col">{a.observed}</th>
              <th scope="col">{a.missing}</th>
            </tr>
          </thead>
          <tbody>
            {[...years].reverse().map((entry) => (
              <tr key={entry.year}>
                <th scope="row">{entry.year}</th>
                <td>
                  {entry.observed} / {entry.total}
                </td>
                <td>{entry.missing}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}

export function CalculatedComparison({
  store,
  selection,
  onRecord,
}: {
  store: DataStore;
  selection: Selection;
  onRecord: (summary: ComparisonSummary) => void;
}) {
  if (selection.countryCodes.length < 2) return null;
  const summary = comparisonSummary(store, selection);
  const definition = indicator(summary.indicatorCode);
  return (
    <section className="panel calculated-comparison" aria-labelledby="calculated-title">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">
            {definition.shortName} · {summary.year}
          </span>
          <h2 id="calculated-title">{a.calculated}</h2>
          <p>{a.calculatedBody}</p>
        </div>
      </div>
      <EvidenceBody summary={summary} store={store} />
      <div className="calculation-record">
        <button className="button outline" onClick={() => onRecord(summary)}>
          {a.record}
        </button>
        <p className="small muted">{a.recordHelp}</p>
      </div>
    </section>
  );
}

function EvidenceBody({
  summary,
  testPrefix = 'calculated-gap',
  store,
}: {
  summary: ComparisonSummary;
  testPrefix?: string;
  store?: DataStore;
}) {
  return (
    <>
      <ul className="calculated-pairs">
        {summary.pairs.map((pair) => (
          <li key={`${pair.leftCountryCode}-${pair.rightCountryCode}`}>
            <span>
              {
                summary.observations.find((row) => row.countryCode === pair.leftCountryCode)!
                  .countryName
              }
              {' − '}
              {
                summary.observations.find((row) => row.countryCode === pair.rightCountryCode)!
                  .countryName
              }
            </span>
            <strong data-testid={`${testPrefix}-${pair.leftCountryCode}-${pair.rightCountryCode}`}>
              {formatDifference(pair.difference)}
            </strong>
            {pair.difference === null && <span className="cell-note">{a.missingPair}</span>}
          </li>
        ))}
      </ul>
      <p className="small">{a.percentagePoints}</p>
      <details className="calculation-sources">
        <summary>{a.sourceDetails}</summary>
        <p className="small">{a.precision}</p>
        <p className="small mono">
          {a.snapshot}: {summary.snapshotRunId}
        </p>
        {summary.observations.map((row) => (
          <article key={row.countryCode}>
            <h3>
              {row.countryName} · {row.year} · {formatValue(row.value)}
            </h3>
            <dl className="source-facts">
              <div>
                <dt>{a.provider}</dt>
                <dd>{row.sourceOrganization}</dd>
              </div>
              <div>
                <dt>{a.referenceYear}</dt>
                <dd>{row.year}</dd>
              </div>
              <div>
                <dt>{a.collected}</dt>
                <dd>{row.fetchedAt}</dd>
              </div>
              <div>
                <dt>{a.raw}</dt>
                <dd>{row.rawFile === null ? row.status : `${row.rawFile}, row ${row.rawRow}`}</dd>
              </div>
              <div>
                <dt>{a.unrounded}</dt>
                <dd>{row.value === null ? a.noObservation : `${row.value} ${row.unit}`}</dd>
              </div>
            </dl>
            <a className="text-link" href={row.sourceUrl} target="_blank" rel="noreferrer">
              {a.source} · {row.countryCode}
            </a>
            {store && summary.snapshotRunId === store.snapshot.runId && (
              <SourceReference store={store} observation={row} />
            )}
          </article>
        ))}
      </details>
    </>
  );
}

export function RecordedComparison({
  summary,
  store,
}: {
  summary: ComparisonSummary;
  store?: DataStore;
}) {
  const definition = indicator(summary.indicatorCode);
  return (
    <section className="recorded-comparison" aria-label={a.calculated}>
      <h3>{a.calculated}</h3>
      <p className="small">
        {definition.shortName} · {summary.year}
      </p>
      <p className="small muted">{a.recordedBody}</p>
      <p className="small recorded-limit">{definition.limitation}</p>
      <EvidenceBody summary={summary} store={store} testPrefix="recorded-gap" />
    </section>
  );
}
