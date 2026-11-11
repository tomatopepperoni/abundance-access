import { useEffect, useLayoutEffect, useId, useMemo, useState, useRef } from 'react';
import type { PointerEvent } from 'react';
import { geoNaturalEarth1, geoPath } from 'd3-geo';
import type { FeatureCollection, Geometry } from 'geojson';
import mapData from '../content/world-map.json';
import { c } from '../content/en';
import { mapCopy as m } from '../content/map-en';
import {
  MAP_HEIGHT,
  MAP_WIDTH,
  MAX_MAP_ZOOM,
  focusMapBounds,
  mapViewBox,
  panMapView,
  revealMapBounds,
  worldView,
  zoomMapView,
  type MapBounds,
  type MapView,
} from '../lib/map-view';
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
  bounds: path.bounds(f) as MapBounds,
}));
const featureByCode = new Map(features.map((feature) => [feature.code, feature]));
type Drag = { pointerId: number; x: number; y: number; view: MapView; dragging: boolean };
export function WorldMap({
  store,
  selection,
  onToggle,
  onInspect,
  compact = false,
  focusedCountry,
  focusRequest,
}: {
  store: DataStore;
  selection: Selection;
  onToggle: (code: string) => void;
  onInspect: (code: string) => void;
  compact?: boolean;
  focusedCountry?: string;
  focusRequest?: number;
}) {
  const id = useId().replaceAll(':', '');
  const buttons = useRef(new Map<string, SVGPathElement>());
  const canvas = useRef<SVGSVGElement>(null);
  const pendingFocus = useRef<string | null>(null);
  const drag = useRef<Drag | null>(null);
  const suppressClick = useRef(false);
  const lastFocusRequest = useRef(focusRequest);
  const mapped = useMemo(
    () =>
      features
        .filter((f) => store.countryByCode.has(f.code))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [store],
  );
  const [focused, setFocused] = useState('KEN');
  const [hovered, setHovered] = useState<string | null>(null);
  const [mapFocus, setMapFocus] = useState<string | null>(null);
  const [view, setView] = useState<MapView>(worldView);
  const currentView = useRef(view);
  const current =
    hovered && store.countryByCode.has(hovered)
      ? observation(store, hovered, selection.indicatorCode, selection.year)
      : null;
  useEffect(() => {
    if (focusRequest === undefined || lastFocusRequest.current === focusRequest) return;
    lastFocusRequest.current = focusRequest;
    const feature = focusedCountry ? featureByCode.get(focusedCountry) : undefined;
    if (!feature || !store.countryByCode.has(feature.code)) return;
    pendingFocus.current = feature.code;
    setView(focusMapBounds(feature.bounds));
    setFocused(feature.code);
    setMapFocus(feature.code);
  }, [focusRequest, focusedCountry, store]);
  useLayoutEffect(() => {
    currentView.current = view;
    const code = pendingFocus.current;
    if (!code) return;
    pendingFocus.current = null;
    canvas.current?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
    buttons.current.get(code)?.focus({ preventScroll: true });
  }, [view, focused]);
  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      const { deltaMode, deltaY } = event;
      if (
        !event.cancelable ||
        !deltaY ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        drag.current?.dragging
      )
        return;
      const previous = currentView.current;
      if ((deltaY > 0 && previous.zoom <= 1) || (deltaY < 0 && previous.zoom >= MAX_MAP_ZOOM))
        return;
      const matrix = element.getScreenCTM();
      if (!matrix) return;
      const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
      const box = element.viewBox.baseVal;
      const unit =
        deltaMode === WheelEvent.DOM_DELTA_LINE
          ? 16
          : deltaMode === WheelEvent.DOM_DELTA_PAGE
            ? element.clientHeight
            : 1;
      const zoom = Math.min(MAX_MAP_ZOOM, previous.zoom * 2 ** ((-deltaY * unit) / 300));
      const next = zoomMapView(previous, zoom, {
        x: (point.x - box.x) / box.width,
        y: (point.y - box.y) / box.height,
      });
      if (next.zoom === previous.zoom) return;
      event.preventDefault();
      currentView.current = next;
      setView(next);
    };
    element.addEventListener('wheel', onWheel, { passive: false });
    return () => element.removeEventListener('wheel', onWheel);
  }, []);
  const move = (code: string, delta: number, edge?: 'first' | 'last') => {
    const index = mapped.findIndex((f) => f.code === code),
      next =
        edge === 'first'
          ? mapped[0]
          : edge === 'last'
            ? mapped.at(-1)!
            : mapped[(index + delta + mapped.length) % mapped.length];
    setFocused(next.code);
    setView((previous) => revealMapBounds(previous, next.bounds));
    buttons.current.get(next.code)?.focus({ preventScroll: true });
    onInspect(next.code);
  };
  const pan = (x: number, y: number) =>
    setView((previous) =>
      panMapView(
        previous,
        ((x * MAP_WIDTH) / previous.zoom) * 0.25,
        ((y * MAP_HEIGHT) / previous.zoom) * 0.25,
      ),
    );
  const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const active = drag.current;
    if (!active || active.pointerId !== event.pointerId) return;
    if (event.buttons === 0) {
      drag.current = null;
      return;
    }
    const dx = event.clientX - active.x,
      dy = event.clientY - active.y;
    if (!active.dragging && Math.hypot(dx, dy) < 5) return;
    if (!active.dragging) {
      active.dragging = true;
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    event.preventDefault();
    setView(
      panMapView(
        active.view,
        ((-dx / rect.width) * MAP_WIDTH) / active.view.zoom,
        ((-dy / rect.height) * MAP_HEIGHT) / active.view.zoom,
      ),
    );
  };
  return (
    <div className={`world-map ${compact ? 'compact-map' : ''}`}>
      <div className="map-navigation" role="group" aria-label={m.navigation}>
        <div className="map-zoom-controls">
          <button
            className="button outline compact"
            disabled={view.zoom >= MAX_MAP_ZOOM}
            onClick={() => setView((previous) => zoomMapView(previous, previous.zoom * 2))}
            aria-label={m.zoomIn}
          >
            ＋
          </button>
          <button
            className="button outline compact"
            disabled={view.zoom <= 1}
            onClick={() => setView((previous) => zoomMapView(previous, previous.zoom / 2))}
            aria-label={m.zoomOut}
          >
            −
          </button>
          <button
            className="button outline compact"
            disabled={view.zoom === 1 && !mapFocus}
            onClick={() => {
              setView(worldView());
              setMapFocus(null);
            }}
          >
            {m.reset}
          </button>
          <span className="map-zoom-status" role="status" aria-label={m.zoom}>
            {Number(view.zoom.toFixed(1))}×
          </span>
        </div>
        <div className="map-pan-controls" role="group" aria-label={m.pan}>
          <button
            className="button outline compact"
            disabled={view.zoom === 1 || view.x === 0}
            onClick={() => pan(-1, 0)}
            aria-label={m.left}
          >
            ←
          </button>
          <button
            className="button outline compact"
            disabled={view.zoom === 1 || view.y === 0}
            onClick={() => pan(0, -1)}
            aria-label={m.up}
          >
            ↑
          </button>
          <button
            className="button outline compact"
            disabled={view.zoom === 1 || view.y >= MAP_HEIGHT - MAP_HEIGHT / view.zoom}
            onClick={() => pan(0, 1)}
            aria-label={m.down}
          >
            ↓
          </button>
          <button
            className="button outline compact"
            disabled={view.zoom === 1 || view.x >= MAP_WIDTH - MAP_WIDTH / view.zoom}
            onClick={() => pan(1, 0)}
            aria-label={m.right}
          >
            →
          </button>
        </div>
      </div>
      <svg
        ref={canvas}
        className={`map-canvas ${view.zoom > 1 ? 'is-zoomed' : ''}`}
        viewBox={mapViewBox(view)}
        data-zoom={view.zoom}
        role="group"
        aria-label={c.mapAria}
        aria-describedby={`${id}-help`}
        onPointerDown={(event) => {
          suppressClick.current = false;
          if (event.pointerType !== 'mouse' || event.button !== 0 || view.zoom === 1) return;
          drag.current = {
            pointerId: event.pointerId,
            x: event.clientX,
            y: event.clientY,
            view,
            dragging: false,
          };
        }}
        onPointerMove={onPointerMove}
        onPointerUp={(event) => {
          if (drag.current?.pointerId !== event.pointerId) return;
          suppressClick.current = drag.current.dragging;
          drag.current = null;
          if (event.currentTarget.hasPointerCapture(event.pointerId))
            event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onPointerCancel={() => {
          drag.current = null;
          suppressClick.current = false;
        }}
        onPointerLeave={() => {
          if (drag.current && !drag.current.dragging) drag.current = null;
        }}
        onLostPointerCapture={() => {
          drag.current = null;
        }}
        onClickCapture={(event) => {
          if (suppressClick.current && event.detail > 0) {
            event.preventDefault();
            event.stopPropagation();
          }
          suppressClick.current = false;
        }}
      >
        <defs>
          <pattern id={`${id}-missing`} width="5" height="5" patternUnits="userSpaceOnUse">
            <rect width="5" height="5" fill="#edf0ed" />
            <path d="m0 5 5-5M-1 1 1-1m3 7 2-2" stroke="#bec9c4" strokeWidth=".7" />
          </pattern>
        </defs>
        <path
          d={path({ type: 'Sphere' }) ?? ''}
          className="ocean"
          vectorEffect="non-scaling-stroke"
        />
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
              vectorEffect="non-scaling-stroke"
              role={country ? 'button' : undefined}
              tabIndex={country ? (focused === feature.code ? 0 : -1) : undefined}
              aria-label={country ? label : undefined}
              aria-pressed={country ? selected : undefined}
              className={`country-shape band-${band} ${selected ? 'is-selected' : ''} ${country ? 'selectable' : ''} ${mapFocus === feature.code ? 'is-map-focus' : ''}`}
              style={band === 'missing' ? { fill: `url(#${id}-missing)` } : undefined}
              onMouseEnter={() => {
                setHovered(feature.code);
              }}
              onMouseLeave={() => setHovered(null)}
              onFocus={() => {
                setFocused(feature.code);
                setHovered(feature.code);
                if (country) {
                  if (!drag.current)
                    setView((previous) => revealMapBounds(previous, feature.bounds));
                  setMapFocus(feature.code);
                  onInspect(feature.code);
                }
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
      {mapFocus && (
        <p className="map-focus-label small">
          <strong>
            {m.focus}: {store.countryByCode.get(mapFocus)?.name}
          </strong>{' '}
          · {m.focusHelp}
        </p>
      )}
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
        {compact ? c.annual : m.help}
      </p>
    </div>
  );
}
