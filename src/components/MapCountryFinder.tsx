import { useId, useRef, useState } from 'react';
import { mapFinderCopy as m } from '../content/map-finder-en';
import { searchMapCountries } from '../lib/map-country-search';
import { formatValue, indicator, observation, type DataStore } from '../lib/query';
import type { Selection } from '../lib/research';
import { Icon } from './Icon';
import { CountryReplacement } from './CountryReplacement';

export function MapCountryFinder({
  store,
  selection,
  mappedCodes,
  onFocus,
  onInspect,
  onToggle,
  onReplace,
  onCompare,
  onReplaced,
}: {
  store: DataStore;
  selection: Selection;
  mappedCodes: ReadonlySet<string>;
  onFocus: (countryCode: string) => void;
  onInspect: (countryCode: string) => void;
  onToggle: (countryCode: string) => void;
  onReplace: (oldCountryCode: string, newCountryCode: string) => void;
  onCompare: () => void;
  onReplaced: (countryCode: string) => void;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState('');
  const [replacing, setReplacing] = useState<string | null>(null);
  const results = searchMapCountries(store.snapshot.countries, search);
  const hasSearch = Boolean(search.trim());
  const definition = indicator(selection.indicatorCode);
  return (
    <section className="map-country-finder" aria-labelledby={`${id}-title`}>
      <h3 id={`${id}-title`}>{m.title}</h3>
      <p id={`${id}-scope`} className="small muted">
        {m.scope(store.snapshot.countries.length)}
      </p>
      <div className="map-finder-search">
        <label className="search-field">
          <span className="sr-only">{m.search}</span>
          <Icon name="search" size={18} />
          <input
            ref={input}
            type="search"
            value={search}
            maxLength={200}
            placeholder={m.placeholder}
            aria-describedby={`${id}-scope`}
            onChange={(event) => {
              setReplacing(null);
              setSearch(event.target.value);
            }}
          />
        </label>
        {search && (
          <button
            className="button outline"
            onClick={() => {
              setSearch('');
              setReplacing(null);
              input.current?.focus();
            }}
          >
            {m.clear}
          </button>
        )}
      </div>
      <p className="map-finder-status small" role="status" aria-live="polite">
        {!hasSearch
          ? m.empty
          : results.total
            ? `${m.resultCount(results.countries.length, results.total)}${results.remaining ? ` ${m.refine}` : ''}`
            : m.noResults}
      </p>
      {results.countries.length > 0 && (
        <>
          <ul className="map-finder-results" aria-label={m.results}>
            {results.countries.map((country) => {
              const mapped = mappedCodes.has(country.code);
              const selected = selection.countryCodes.includes(country.code);
              const row = observation(store, country.code, selection.indicatorCode, selection.year);
              return (
                <li
                  className="map-finder-result"
                  key={country.code}
                  data-testid={`map-finder-${country.code}`}
                >
                  <div className="map-finder-country">
                    <strong>{country.name}</strong>
                    <span className="small muted">
                      {country.code} · {mapped ? m.mapped : m.notDrawn}
                    </span>
                    {selected && <span className="small">✓ {m.selected}</span>}
                  </div>
                  <div className="map-finder-value">
                    <strong data-testid={`map-finder-value-${country.code}`}>
                      {formatValue(row.value)}
                    </strong>
                    <span className="small muted">
                      {definition.shortName} · {row.year} · {row.unit}
                    </span>
                  </div>
                  <div className="map-finder-actions">
                    <button
                      className="button outline"
                      aria-label={mapped ? m.showLabel(country.name) : m.inspectLabel(country.name)}
                      onClick={() => {
                        onInspect(country.code);
                        if (mapped) onFocus(country.code);
                      }}
                    >
                      {mapped ? m.show : m.inspect}
                    </button>
                    {(selected || selection.countryCodes.length < 3) && (
                      <button
                        className={`button ${selected ? 'outline' : 'dark'}`}
                        aria-label={
                          selected ? m.removeLabel(country.name) : m.addLabel(country.name)
                        }
                        aria-pressed={selected}
                        onClick={() => onToggle(country.code)}
                      >
                        {selected ? m.remove : m.add}
                      </button>
                    )}
                    <CountryReplacement
                      key={`${search}:${country.code}`}
                      store={store}
                      selection={selection}
                      newCountryCode={country.code}
                      onReplace={onReplace}
                      onCompare={onCompare}
                      open={replacing === country.code}
                      onOpenChange={(open) => setReplacing(open ? country.code : null)}
                      onReplaced={() => onReplaced(country.code)}
                      primary={selection.countryCodes.length >= 3}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="small muted">{m.focusHelp}</p>
          {selection.countryCodes.length >= 3 && <p className="small">{m.full}</p>}
        </>
      )}
    </section>
  );
}
