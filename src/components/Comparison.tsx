import { useId, useRef } from 'react';
import { c } from '../content/en';
import { definitions, formatValue, indicator, latest, observation, series } from '../lib/query';
import type { DataStore } from '../lib/query';
import type { Research, Selection } from '../lib/research';
import type { IndicatorCode } from '../lib/schema';
import { Controls } from './Controls';
import { Icon } from './Icon';
import { ShareComparison } from './ShareComparison';
import { CommonYearControl, CalculatedComparison } from './ComparisonEvidence';
import type { ComparisonSummary } from '../lib/analysis';
import type { ExportScope } from '../lib/export';
import type { InvestigationTopic } from '../lib/investigation';
import { ExportControls } from './ExportControls';
import { NextInvestigation } from './Investigation';
import { ComparabilityNotice, SourceReference } from './SourceReference';
export const chartColors = ['#15645f', '#9c542e', '#575391'];
const markers = ['circle', 'square', 'triangle'];
export function Comparison({
  store,
  research,
  onSelection,
  onToggle,
  onNavigate,
  onExport,
  onRecordSummary,
  onInvestigate,
}: {
  store: DataStore;
  research: Research;
  onSelection: (patch: Partial<Selection>) => void;
  onToggle: (code: string) => void;
  onNavigate: (view: 'explore' | 'notes') => void;
  onExport: (type: 'csv' | 'md', scope: ExportScope) => void;
  onRecordSummary: (summary: ComparisonSummary) => void;
  onInvestigate: (topic: InvestigationTopic) => void;
}) {
  const { selection } = research;
  const matrixId = useId();
  const chartPanel = useRef<HTMLElement>(null);
  const countries = selection.countryCodes.map((code) => store.countryByCode.get(code)!);
  const def = indicator(selection.indicatorCode),
    rows = countries.map((country) => observation(store, country.code, def.code, selection.year));
  const values = rows.flatMap((o) => (o.value === null ? [] : [o.value]));
  const max = Math.max(100, ...values);
  return (
    <>
      <Controls
        store={store}
        selection={selection}
        onChange={onSelection}
        onToggle={onToggle}
        variant="comparison"
        onChooseCountries={() => onNavigate('explore')}
        shareControl={<ShareComparison store={store} selection={selection} />}
      />
      {countries.length < 2 ? (
        <div className="panel empty-state">
          <Icon name="compare" size={36} />
          <p>{c.compareNeeds}</p>
          <button className="button dark" onClick={() => onNavigate('explore')}>
            {c.backExplore}
            <Icon name="arrow" size={17} />
          </button>
        </div>
      ) : (
        <>
          <section className="panel measures-panel">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">{selection.year}</span>
                <h2>{c.allMeasures}</h2>
                <p>{c.allMeasuresBody}</p>
              </div>
            </div>
            <div
              className="table-scroll comparison-matrix-table"
              tabIndex={0}
              role="region"
              aria-label={c.allMeasures}
            >
              <table>
                <thead>
                  <tr>
                    <th scope="col">{c.indicator}</th>
                    {countries.map((country) => (
                      <th scope="col" key={country.code}>
                        {country.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {definitions.indicators.map((d) => (
                    <tr key={d.code}>
                      <th scope="row">
                        {d.shortName}
                        <span className="cell-note">{d.unit}</span>
                      </th>
                      {countries.map((country) => {
                        const o = observation(store, country.code, d.code, selection.year);
                        return (
                          <td
                            className="numeric"
                            key={country.code}
                            data-testid={`matrix-${country.code}-${d.code}`}
                          >
                            {formatValue(o.value)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mobile-comparison-matrix">
              {definitions.indicators.map((d) => (
                <section
                  className="mobile-measure-card"
                  key={d.code}
                  aria-labelledby={`${matrixId}-${d.code}`}
                >
                  <h3 id={`${matrixId}-${d.code}`}>{d.shortName}</h3>
                  <p className="mobile-measure-unit">{d.unit}</p>
                  <dl>
                    {countries.map((country) => {
                      const o = observation(store, country.code, d.code, selection.year);
                      return (
                        <div key={country.code}>
                          <dt>{country.name}</dt>
                          <dd data-testid={`mobile-matrix-${country.code}-${d.code}`}>
                            {formatValue(o.value)}
                          </dd>
                        </div>
                      );
                    })}
                  </dl>
                </section>
              ))}
            </div>
            <NextInvestigation
              measure={def.shortName}
              year={selection.year}
              onStart={onInvestigate}
            />
            <CommonYearControl
              store={store}
              selection={selection}
              onYearChange={(year) => onSelection({ year })}
            />
            <p className="callout small">
              <Icon name="info" size={16} />
              {c.above100}
            </p>
            <ComparabilityNotice />
          </section>
          <section ref={chartPanel} className="panel same-year" aria-labelledby="same-year-title">
            <div className="panel-heading">
              <div>
                <label className="chart-indicator-field">
                  <span>{c.chartIndicator}</span>
                  <select
                    value={selection.indicatorCode}
                    onChange={(event) => {
                      onSelection({ indicatorCode: event.target.value as IndicatorCode });
                      requestAnimationFrame(() => {
                        const result = chartPanel.current
                          ?.querySelector('.bar-row')
                          ?.getBoundingClientRect();
                        if (result && (result.bottom > window.innerHeight || result.top < 0))
                          chartPanel.current?.scrollIntoView({
                            block: 'start',
                            behavior: 'instant',
                          });
                      });
                    }}
                  >
                    {definitions.indicators.map((item) => (
                      <option key={item.code} value={item.code}>
                        {item.shortName}
                      </option>
                    ))}
                  </select>
                </label>
                <h2 id="same-year-title">
                  {def.shortName} · {selection.year}
                </h2>
                <p>{def.unit}</p>
              </div>
              <span className="soft-badge">{c.annual}</span>
            </div>
            <div
              className="bar-chart"
              role="img"
              aria-label={rows
                .map((o) => `${o.countryName}: ${formatValue(o.value)}, ${o.year}`)
                .join('; ')}
            >
              {rows.map((o, i) => (
                <div className="bar-row" key={o.countryCode}>
                  <div className="bar-country">
                    <span className="line-symbol" style={{ color: chartColors[i] }}>
                      {['●', '■', '▲'][i]}
                    </span>
                    <strong>{o.countryName}</strong>
                    <span className="code">{o.countryCode}</span>
                  </div>
                  <div className="bar-track">
                    <div
                      className={`bar-fill country-${i}`}
                      style={{ width: `${o.value === null ? 0 : (o.value / max) * 100}%` }}
                    />
                  </div>
                  <span className="bar-value" data-testid={`compare-value-${o.countryCode}`}>
                    {formatValue(o.value)}
                  </span>
                </div>
              ))}
            </div>
            <div className="bar-scale" aria-hidden="true">
              <span>0%</span>
              <span>{max.toFixed(0)}%</span>
            </div>
            <p className="chart-limit">{def.limitation}</p>
          </section>
          <CalculatedComparison store={store} selection={selection} onRecord={onRecordSummary} />
          <TrendChart store={store} selection={selection} />
          <section className="panel latest-panel">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">2015–2025</span>
                <h2>{c.latestTitle}</h2>
                <p>{c.latestBody}</p>
              </div>
            </div>
            <div className="latest-grid">
              {countries.map((country, i) => {
                const o = latest(store, country.code, def.code);
                return (
                  <article key={country.code}>
                    <span className="country-line" style={{ color: chartColors[i] }}>
                      {['●', '■', '▲'][i]} {country.name}
                    </span>
                    <strong>{o ? formatValue(o.value) : '—'}</strong>
                    <span>{o ? `${o.year} · ${def.unit}` : c.noLatest}</span>
                  </article>
                );
              })}
            </div>
          </section>
          <section className="panel source-trail">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">{def.shortName}</span>
                <h2>{c.sourceTrail}</h2>
              </div>
            </div>
            {rows.map((o) => (
              <details key={o.countryCode}>
                <summary>
                  {o.countryName} · {o.year} · {formatValue(o.value)}
                </summary>
                <dl className="source-facts">
                  <div>
                    <dt>{c.source}</dt>
                    <dd>{o.sourceOrganization}</dd>
                  </div>
                  <div>
                    <dt>{c.distributor}</dt>
                    <dd>{o.distributor}</dd>
                  </div>
                  <div>
                    <dt>{c.status}</dt>
                    <dd>{o.status}</dd>
                  </div>
                  <div>
                    <dt>{c.fetched}</dt>
                    <dd>{o.fetchedAt}</dd>
                  </div>
                  <div>
                    <dt>{c.raw}</dt>
                    <dd>{o.rawFile ? `${o.rawFile}, row ${o.rawRow}` : o.status}</dd>
                  </div>
                  {o.sourceStatus && (
                    <div>
                      <dt>{c.sourceStatus}</dt>
                      <dd>{o.sourceStatus}</dd>
                    </div>
                  )}
                </dl>
                <a className="text-link" href={o.sourceUrl} target="_blank" rel="noreferrer">
                  {c.sourceLink}
                  <Icon name="external" size={13} />
                </a>
                <SourceReference store={store} observation={o} />
              </details>
            ))}
          </section>
          <details className="panel research-guide">
            <summary>{c.researchPrompts}</summary>
            <div className="research-prompts">
              <span className="eyebrow">{c.researchPromptsLabel}</span>
              <p>{c.researchPromptsBody}</p>
              <ul>
                {c.researchPromptsItems.map((item) => (
                  <li key={item.title}>
                    <strong>{item.title}</strong>
                    <p>{item.body}</p>
                  </li>
                ))}
              </ul>
              <p className="data-scope">{c.datasetScope}</p>
              <button className="button outline" onClick={() => onNavigate('notes')}>
                {c.researchPromptsCTA}
                <Icon name="arrow" size={17} />
              </button>
            </div>
          </details>
          <div className="action-bar">
            <button className="button dark" onClick={() => onNavigate('notes')}>
              {c.notesCTA}
              <Icon name="arrow" size={17} />
            </button>
          </div>
          <ExportControls store={store} research={research} onExport={onExport} />
        </>
      )}
    </>
  );
}
export function TrendChart({ store, selection }: { store: DataStore; selection: Selection }) {
  const id = useId();
  const def = indicator(selection.indicatorCode);
  const groups = selection.countryCodes.map((code) => ({
    code,
    name: store.countryByCode.get(code)!.name,
    rows: series(store, code, selection.indicatorCode),
  }));
  const max =
    Math.ceil(Math.max(100, ...groups.flatMap((g) => g.rows.map((o) => o.value ?? 0))) / 20) * 20;
  const x = (year: number) => 68 + ((year - 2015) / 10) * 820,
    y = (value: number) => 250 - (value / max) * 210;
  return (
    <section className="panel trend-panel" aria-labelledby={`${id}-title`}>
      <div className="panel-heading">
        <div>
          <span className="eyebrow">{def.shortName}</span>
          <h2 id={`${id}-title`}>{c.trendTitle}</h2>
          <p>{c.trendBody}</p>
        </div>
      </div>
      <div className="trend-legend">
        {groups.map((g, i) => (
          <span key={g.code} style={{ color: chartColors[i] }}>
            <b>{['●', '■', '▲'][i]}</b>
            {g.name}
          </span>
        ))}
      </div>
      <div className="chart-scroll" role="region" tabIndex={0} aria-label={c.trendChartRegion}>
        <svg
          className="trend-svg"
          viewBox="0 0 930 300"
          role="img"
          aria-label={`${def.shortName}, 2015–2025. ${c.trendBody}`}
        >
          <title>{def.name}</title>
          {Array.from({ length: 5 }, (_, i) => (max / 4) * i).map((v) => (
            <g key={v}>
              <path d={`M68 ${y(v)}H888`} stroke="#e0e8e3" />
              <text x="54" y={y(v) + 4} textAnchor="end" className="axis-text">
                {v}%
              </text>
            </g>
          ))}
          {[2015, 2017, 2019, 2021, 2023, 2025].map((year) => (
            <text className="axis-text" key={year} x={x(year)} y="278" textAnchor="middle">
              {year}
            </text>
          ))}
          {groups.map((g, i) => {
            let draw = '';
            let contiguous = false;
            for (const o of g.rows) {
              if (o.value === null) {
                contiguous = false;
                continue;
              }
              draw += `${contiguous ? 'L' : 'M'}${x(o.year)},${y(o.value)} `;
              contiguous = true;
            }
            return (
              <g key={g.code} style={{ color: chartColors[i] }}>
                <path
                  d={draw}
                  stroke="currentColor"
                  strokeWidth="2.6"
                  strokeDasharray={i === 1 ? '7 4' : i === 2 ? '2 4' : undefined}
                  fill="none"
                />
                {g.rows
                  .filter((o) => o.value !== null)
                  .map((o) => (
                    <g key={o.year}>
                      <title>
                        {g.name}, {o.year}: {formatValue(o.value)}
                      </title>
                      {markers[i] === 'square' ? (
                        <rect
                          x={x(o.year) - 3.5}
                          y={y(o.value!) - 3.5}
                          width="7"
                          height="7"
                          fill="currentColor"
                        />
                      ) : markers[i] === 'triangle' ? (
                        <path
                          d={`M${x(o.year)} ${y(o.value!) - 5}l4.5 8h-9z`}
                          fill="currentColor"
                        />
                      ) : (
                        <circle cx={x(o.year)} cy={y(o.value!)} r="3.7" fill="currentColor" />
                      )}
                    </g>
                  ))}
              </g>
            );
          })}
        </svg>
      </div>
      <details className="trend-data">
        <summary>{c.trendTable}</summary>
        <div className="table-scroll" role="region" tabIndex={0} aria-label={c.trendTable}>
          <table>
            <thead>
              <tr>
                <th scope="col">{c.year}</th>
                {groups.map((g) => (
                  <th scope="col" key={g.code}>
                    {g.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 11 }, (_, i) => 2015 + i).map((year) => (
                <tr key={year}>
                  <th scope="row">{year}</th>
                  {groups.map((g) => (
                    <td key={g.code} className="numeric">
                      {formatValue(g.rows[year - 2015].value)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
