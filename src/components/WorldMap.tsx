import { useId, useMemo, useState, useRef } from 'react';
import { geoNaturalEarth1, geoPath } from 'd3-geo';
import type { FeatureCollection, Geometry } from 'geojson';
import mapData from '../content/world-map.json';
import { c } from '../content/en';
import { formatValue, observation, valueBand } from '../lib/query';
import type { DataStore } from '../lib/query';
import type { Selection } from '../lib/research';

export type MapProperties = { code: string; name: string };
export const worldMap = mapData as unknown as FeatureCollection<Geometry, MapProperties>;
const projection = geoNaturalEarth1().fitExtent(
  [
    [12, 14],
    [948, 452],
  ],
  worldMap,
);
const path = geoPath(projection);
const features = worldMap.features.map((f) => ({
  code: f.properties.code,
  name: f.properties.name,
  path: path(f) ?? '',
}));
export function WorldMap({
  store,
  selection,
  onToggle,
  onInspect,
  compact = false,
}: {
  store: DataStore;
  selection: Selection;
  onToggle: (code: string) => void;
  onInspect: (code: string) => void;
  compact?: boolean;
}) {
  const id = useId().replaceAll(':', '');
  const buttons = useRef(new Map<string, SVGPathElement>());
  const mapped = useMemo(
    () =>
      features
        .filter((f) => store.countryByCode.has(f.code))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [store],
  );
  const [focused, setFocused] = useState('KEN');
  const [hovered, setHovered] = useState<string | null>(null);
  const current =
    hovered && store.countryByCode.has(hovered)
      ? observation(store, hovered, selection.indicatorCode, selection.year)
      : null;
  const move = (code: string, delta: number, edge?: 'first' | 'last') => {
    const index = mapped.findIndex((f) => f.code === code),
      next =
        edge === 'first'
          ? mapped[0]
          : edge === 'last'
            ? mapped.at(-1)!
            : mapped[(index + delta + mapped.length) % mapped.length];
    setFocused(next.code);
    buttons.current.get(next.code)?.focus();
    onInspect(next.code);
  };
  return (
    <div className={`world-map ${compact ? 'compact-map' : ''}`}>
      <svg
        viewBox="0 0 960 470"
        role="group"
        aria-label={c.mapAria}
        aria-describedby={`${id}-help`}
      >
        <defs>
          <pattern id={`${id}-missing`} width="5" height="5" patternUnits="userSpaceOnUse">
            <rect width="5" height="5" fill="#edf0ed" />
            <path d="m0 5 5-5M-1 1 1-1m3 7 2-2" stroke="#bec9c4" strokeWidth=".7" />
          </pattern>
        </defs>
        <path d={path({ type: 'Sphere' }) ?? ''} className="ocean" />
        {features.map((feature, index) => {
          const country = store.countryByCode.get(feature.code);
          const row = country
            ? observation(store, feature.code, selection.indicatorCode, selection.year)
            : null;
          const selected = selection.countryCodes.includes(feature.code),
            band = valueBand(row?.value ?? null);
          const label = country
            ? `${country.name}: ${formatValue(row!.value)}, ${selection.year}${selected ? `, ${c.selectedLabel}` : ''}`
            : `${feature.name}: ${c.outsideRegistry}`;
          return (
            <path
              key={`${feature.code}-${index}`}
              ref={(element) => {
                if (element && country) buttons.current.set(feature.code, element);
              }}
              d={feature.path}
              data-country={country?.code}
              data-value={row?.value ?? 'missing'}
              role={country ? 'button' : undefined}
              tabIndex={country ? (focused === feature.code ? 0 : -1) : undefined}
              aria-label={country ? label : undefined}
              aria-pressed={country ? selected : undefined}
              className={`country-shape band-${band} ${selected ? 'is-selected' : ''} ${country ? 'selectable' : ''}`}
              style={band === 'missing' ? { fill: `url(#${id}-missing)` } : undefined}
              onMouseEnter={() => {
                setHovered(feature.code);
              }}
              onMouseLeave={() => setHovered(null)}
              onFocus={() => {
                setFocused(feature.code);
                setHovered(feature.code);
                if (country) onInspect(feature.code);
              }}
              onBlur={() => setHovered(null)}
              onClick={() => {
                if (country) {
                  onInspect(feature.code);
                  onToggle(feature.code);
                }
              }}
              onKeyDown={(event) => {
                if (!country) return;
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onToggle(feature.code);
                }
                if (
                  ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'].includes(
                    event.key,
                  )
                ) {
                  event.preventDefault();
                  move(
                    feature.code,
                    ['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : -1,
                    event.key === 'Home' ? 'first' : event.key === 'End' ? 'last' : undefined,
                  );
                }
              }}
            >
              <title>{label}</title>
            </path>
          );
        })}
      </svg>
      <div className="map-bottom">
        <div className="map-legend" aria-label={c.legend}>
          {['lowest', 'low', 'medium', 'high', 'above', 'missing'].map((band, i) => (
            <span key={band}>
              <i className={`legend-swatch band-${band}`} />
              {c.legendBands[i]}
            </span>
          ))}
        </div>
        <span className="map-hover" aria-live="off">
          {current
            ? `${current.countryName} · ${formatValue(current.value)} · ${current.year}`
            : c.selectedLabel + ': ' + selection.countryCodes.join(', ')}
        </span>
      </div>
      <p id={`${id}-help`} className="map-help">
        {compact ? c.annual : c.mapHelp}
      </p>
    </div>
  );
}
