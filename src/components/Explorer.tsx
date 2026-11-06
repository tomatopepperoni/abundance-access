import { useMemo, useRef, useState } from 'react';
import { c } from '../content/en';
import {
  coverage,
  definitions,
  findCountries,
  formatValue,
  indicator,
  observation,
} from '../lib/query';
import type { DataStore } from '../lib/query';
import type { Research, Selection } from '../lib/research';
import { Controls } from './Controls';
import { WorldMap, worldMap } from './WorldMap';
import { Icon } from './Icon';
import { MapCountryFinder } from './MapCountryFinder';
import { SourceReference } from './SourceReference';
import { explorerCopy } from '../content/explorer-en';
const mappedCodes = new Set(worldMap.features.map((feature) => feature.properties.code));
export function Explorer({
  store,
  research,
  onChange,
  onSelection,
  onToggle,
  onNavigate,
  onExample,
  showExample = true,
}: {
  store: DataStore;
  research: Research;
  onChange: (patch: Partial<Research>) => void;
  onSelection: (patch: Partial<Selection>) => void;
  onToggle: (code: string) => void;
  onNavigate: (view: 'compare' | 'methodology') => void;
  onExample: () => void;
  showExample?: boolean;
}) {
  const { selection, search, region } = research;
  const [inspected, setInspected] = useState(selection.countryCodes.at(-1) ?? 'KEN');
  const detailTitle = useRef<HTMLHeadingElement>(null);
  const inspectDetails = (code: string) => {
    setInspected(code);
    requestAnimationFrame(() => {
      detailTitle.current?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
      detailTitle.current?.focus({ preventScroll: true });
    });
  };
  const [mapFocus, setMapFocus] = useState({ code: '', request: 0 });
  const focusOnMap = (code: string) => {
    if (!mappedCodes.has(code)) return;
    setInspected(code);
    setMapFocus((previous) => ({ code, request: previous.request + 1 }));
  };
  const country = store.countryByCode.get(inspected) ?? store.snapshot.countries[0];
  const row = observation(store, country.code, selection.indicatorCode, selection.year);
  const def = indicator(selection.indicatorCode),
    count = coverage(store, selection.indicatorCode, selection.year);
  const regions = useMemo(
    () => [...new Set(store.snapshot.countries.map((c) => c.region))].sort(),
    [store],
  );
  const countries = findCountries(store.snapshot.countries, search, region);
  const isMapped = mappedCodes.has(country.code);
  return (
    <>
      {showExample && (
        <div className="example-callout">
          <p>{c.exampleHelp}</p>
          <button className="button outline" onClick={onExample}>
            {c.heroCTA}
            <Icon name="arrow" size={16} />
          </button>
        </div>
      )}
      <Controls
        store={store}
        selection={selection}
        onChange={onSelection}
        onToggle={onToggle}
        onCompare={() => onNavigate('compare')}
      />
      <div className="explorer-layout">
        <section className="panel map-panel" aria-labelledby="map-title">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">
                {selection.year} · {def.shortName}
              </span>
              <h2 id="map-title">{c.mapTitle}</h2>
            </div>
            <span className="soft-badge">
              {count.observed} / {count.total}
            </span>
          </div>
          <MapCountryFinder
            store={store}
            selection={selection}
            mappedCodes={mappedCodes}
            onInspect={(code) =>
              mappedCodes.has(code) ? setInspected(code) : inspectDetails(code)
            }
            onFocus={focusOnMap}
            onToggle={onToggle}
          />
          <WorldMap
            store={store}
            selection={selection}
            onToggle={onToggle}
            onInspect={setInspected}
            focusedCountry={mapFocus.code}
            focusRequest={mapFocus.request}
          />
          <div className="map-credit">
            {definitions.map.name} · {definitions.map.license}
            <a href={definitions.map.licenseUrl} target="_blank" rel="noreferrer">
              {c.license}
              <Icon name="external" size={12} />
            </a>
          </div>
        </section>
        <aside className="panel country-detail" aria-label={c.countryDetail}>
          <span className="eyebrow">{c.countryDetail}</span>
          <p className="small muted">{c.countryDetailHelp}</p>
          <div className="country-title">
            <span className="country-code">{country.code}</span>
            <h2 ref={detailTitle} tabIndex={-1}>
              {country.name}
            </h2>
          </div>
          <p className="muted small">{country.region}</p>
          <div className="detail-value" data-testid="inspected-value">
            {formatValue(row.value)}
          </div>
          <p className="detail-unit">
            {def.shortName}
            <br />
            {selection.year} · {def.unit}
          </p>
          {!isMapped && <p className="callout small">{c.mapUnavailable}</p>}
          <button
            className={`button ${selection.countryCodes.includes(country.code) ? 'outline' : 'dark'} full`}
            disabled={
              !selection.countryCodes.includes(country.code) && selection.countryCodes.length === 3
            }
            onClick={() => onToggle(country.code)}
          >
            <Icon
              name={selection.countryCodes.includes(country.code) ? 'check' : 'plus'}
              size={17}
            />
            {selection.countryCodes.includes(country.code) ? c.remove : c.add} {country.code}
          </button>
          <dl className="source-facts">
            <div>
              <dt>{c.source}</dt>
              <dd>{row.sourceOrganization}</dd>
            </div>
            <div>
              <dt>{c.distributor}</dt>
              <dd>World Bank</dd>
            </div>
            <div>
              <dt>{c.fetched}</dt>
              <dd>{row.fetchedAt.replace('T', ' ').replace('Z', ' UTC')}</dd>
            </div>
          </dl>
          <a className="text-link" href={row.sourceUrl} target="_blank" rel="noreferrer">
            {c.sourceLink}
            <Icon name="external" size={13} />
          </a>
          <details className="detail-raw-source">
            <summary>{explorerCopy.rawSource}</summary>
            <SourceReference store={store} observation={row} />
          </details>
          <div className="detail-context">
            <span className="eyebrow">{c.whyItMatters}</span>
            <p>{def.context}</p>
            <p className="small muted">{def.limitation}</p>
            <button className="text-link" onClick={() => onNavigate('methodology')}>
              {c.methodsCTA}
              <Icon name="arrow" size={14} />
            </button>
          </div>
        </aside>
      </div>
      <div className="coverage-strip">
        <Icon name="database" />
        <strong>{c.coverage}</strong>
        <span>
          <b>{count.observed}</b> {c.coverageText}
        </span>
        <span>
          <b>{count.missing}</b> {c.missingText}
        </span>
        <span className="muted small">
          {selection.year} · {def.shortName}
        </span>
      </div>
      <section className="panel table-panel" aria-labelledby="country-table-title">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">{c.country}</span>
            <h2 id="country-table-title">{c.tableHeading}</h2>
            <p>{c.tableHelp}</p>
          </div>
          <button
            className="text-link"
            onClick={() => onSelection({ countryCodes: [] })}
            disabled={!selection.countryCodes.length}
          >
            {c.clearCountries}
          </button>
        </div>
        <div className="table-filters">
          <label className="search-field">
            <span className="sr-only">{c.countrySearch}</span>
            <Icon name="search" size={18} />
            <input
              value={search}
              onChange={(e) => onChange({ search: e.target.value })}
              placeholder={c.searchPlaceholder}
              maxLength={200}
            />
          </label>
          <label>
            <span className="sr-only">{c.region}</span>
            <select value={region} onChange={(e) => onChange({ region: e.target.value })}>
              <option value="all">{c.allRegions}</option>
              {regions.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </label>
          <span className="small muted" aria-live="polite">
            {countries.length} / {store.snapshot.countries.length}
          </span>
        </div>
        <div
          className="table-scroll country-table-scroll"
          tabIndex={0}
          role="region"
          aria-label={c.countryTable}
        >
          <table>
            <caption className="sr-only">
              {c.countryTable} · {def.name} · {selection.year}
            </caption>
            <thead>
              <tr>
                <th scope="col">{c.country}</th>
                <th scope="col">
                  {c.value} · {selection.year}
                </th>
                <th scope="col">{c.status}</th>
                <th scope="col">{c.action}</th>
              </tr>
            </thead>
            <tbody>
              {countries.map((country) => {
                const o = observation(store, country.code, selection.indicatorCode, selection.year),
                  selected = selection.countryCodes.includes(country.code);
                return (
                  <tr
                    key={country.code}
                    data-testid={`country-row-${country.code}`}
                    className={selected ? 'row-selected' : ''}
                  >
                    <th scope="row">
                      <button
                        className="country-name-button"
                        onClick={() => inspectDetails(country.code)}
                      >
                        {country.name}
                        <span>
                          {country.code} · {country.region}
                        </span>
                      </button>
                    </th>
                    <td className="numeric" data-testid={`table-value-${country.code}`}>
                      {formatValue(o.value)}
                    </td>
                    <td>
                      <span className={`status-pill ${o.value === null ? 'missing' : 'observed'}`}>
                        {o.value === null ? c.missing : c.available}
                      </span>
                    </td>
                    <td>
                      <button
                        className={`select-country ${selected ? 'selected' : ''}`}
                        aria-label={`${selected ? c.remove : c.add} ${country.name}`}
                        aria-pressed={selected}
                        disabled={!selected && selection.countryCodes.length === 3}
                        onClick={() => onToggle(country.code)}
                      >
                        <Icon name={selected ? 'check' : 'plus'} size={14} />
                        {selected ? c.selectedLabel : c.add}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!countries.length && <p className="empty-state">{c.noSearch}</p>}
        </div>
      </section>
    </>
  );
}
