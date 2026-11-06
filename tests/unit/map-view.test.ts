import { describe, expect, it } from 'vitest';
import { geoNaturalEarth1, geoPath } from 'd3-geo';
import type { FeatureCollection, Geometry } from 'geojson';
import map from '../../src/content/world-map.json';
import {
  MAP_HEIGHT,
  MAP_WIDTH,
  clampMapView,
  focusMapBounds,
  mapViewBox,
  panMapView,
  revealMapBounds,
  worldView,
  zoomMapView,
  type MapBounds,
} from '../../src/lib/map-view';

const worldMap = map as unknown as FeatureCollection<Geometry, { code: string; name: string }>;
const path = geoPath(
  geoNaturalEarth1().fitExtent(
    [
      [12, 14],
      [948, 452],
    ],
    worldMap,
  ),
);
const bounds = (code: string) =>
  path.bounds(worldMap.features.find((feature) => feature.properties.code === code)!) as MapBounds;

describe('bounded map viewport', () => {
  it('keeps finite zoom and pan inside the world', () => {
    expect(clampMapView({ x: Infinity, y: NaN, zoom: Infinity })).toEqual(worldView());
    expect(clampMapView({ x: -200, y: 2000, zoom: 200 })).toEqual({ x: 0, y: 411.25, zoom: 8 });
    expect(clampMapView({ x: 50, y: 50, zoom: -5 })).toEqual(worldView());
  });
  it('zooms around the viewport centre and restores the full world', () => {
    const view = zoomMapView(worldView(), 2);
    expect(view).toEqual({ x: 240, y: 117.5, zoom: 2 });
    expect(zoomMapView(view, 1)).toEqual(worldView());
    expect(mapViewBox(view)).toBe('240 117.5 480 235');
  });
  it('pans to world edges without allowing blank-space drift', () => {
    const view = zoomMapView(worldView(), 4);
    expect(panMapView(view, -10000, -10000)).toEqual({ x: 0, y: 0, zoom: 4 });
    expect(panMapView(view, 10000, 10000)).toEqual({ x: 720, y: 352.5, zoom: 4 });
    expect(panMapView(worldView(), 10000, 10000)).toEqual(worldView());
  });
  it('focuses actual Luxembourg geometry at the maximum allowed zoom', () => {
    const [[left, top], [right, bottom]] = bounds('LUX');
    const view = focusMapBounds(bounds('LUX'));
    expect(view.zoom).toBe(8);
    expect(left).toBeGreaterThanOrEqual(view.x);
    expect(right).toBeLessThanOrEqual(view.x + MAP_WIDTH / view.zoom);
    expect(top).toBeGreaterThanOrEqual(view.y);
    expect(bottom).toBeLessThanOrEqual(view.y + MAP_HEIGHT / view.zoom);
  });
  it('returns the full world for trans-world Fiji geometry or invalid bounds', () => {
    expect(bounds('FJI')[1][0] - bounds('FJI')[0][0]).toBeGreaterThan(900);
    expect(focusMapBounds(bounds('FJI'))).toEqual(worldView());
    expect(
      focusMapBounds([
        [NaN, 0],
        [1, 1],
      ]),
    ).toEqual(worldView());
    expect(
      focusMapBounds([
        [20, 20],
        [10, 10],
      ]),
    ).toEqual(worldView());
  });
  it('reveals an offscreen keyboard target at the existing zoom', () => {
    const view = focusMapBounds(bounds('LUX'));
    const next = revealMapBounds(view, bounds('CYP'));
    expect(next.zoom).toBe(view.zoom);
    expect(next.x).not.toBe(view.x);
    const [[left, top], [right, bottom]] = bounds('CYP');
    expect(left).toBeGreaterThanOrEqual(next.x);
    expect(right).toBeLessThanOrEqual(next.x + MAP_WIDTH / next.zoom);
    expect(top).toBeGreaterThanOrEqual(next.y);
    expect(bottom).toBeLessThanOrEqual(next.y + MAP_HEIGHT / next.zoom);
    expect(revealMapBounds(worldView(), bounds('CYP'))).toEqual(worldView());
  });
});
