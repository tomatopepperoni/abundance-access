export const MAP_WIDTH = 960;
export const MAP_HEIGHT = 470;
export const MAX_MAP_ZOOM = 8;
export type MapView = { x: number; y: number; zoom: number };
export type MapBounds = [[number, number], [number, number]];
export const worldView = (): MapView => ({ x: 0, y: 0, zoom: 1 });
const finite = (value: number, fallback: number) => (Number.isFinite(value) ? value : fallback);
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
export function clampMapView(view: MapView): MapView {
  const zoom = clamp(finite(view.zoom, 1), 1, MAX_MAP_ZOOM);
  return {
    x: clamp(finite(view.x, 0), 0, MAP_WIDTH - MAP_WIDTH / zoom),
    y: clamp(finite(view.y, 0), 0, MAP_HEIGHT - MAP_HEIGHT / zoom),
    zoom,
  };
}
export function zoomMapView(view: MapView, zoom: number): MapView {
  const current = clampMapView(view),
    nextZoom = clamp(finite(zoom, current.zoom), 1, MAX_MAP_ZOOM);
  return clampMapView({
    x: current.x + MAP_WIDTH / current.zoom / 2 - MAP_WIDTH / nextZoom / 2,
    y: current.y + MAP_HEIGHT / current.zoom / 2 - MAP_HEIGHT / nextZoom / 2,
    zoom: nextZoom,
  });
}
export function panMapView(view: MapView, dx: number, dy: number): MapView {
  return clampMapView({ ...view, x: view.x + finite(dx, 0), y: view.y + finite(dy, 0) });
}
function validBounds(bounds: MapBounds) {
  const [[left, top], [right, bottom]] = bounds;
  return [left, top, right, bottom].every(Number.isFinite) && right >= left && bottom >= top;
}
export function focusMapBounds(bounds: MapBounds): MapView {
  if (!validBounds(bounds)) return worldView();
  const [[left, top], [right, bottom]] = bounds;
  if (right - left > MAP_WIDTH * 0.8) return worldView();
  const zoom = clamp(
    Math.min(
      MAP_WIDTH / Math.max(1, right - left) / 1.6,
      MAP_HEIGHT / Math.max(1, bottom - top) / 1.6,
    ),
    1,
    MAX_MAP_ZOOM,
  );
  return clampMapView({
    x: (left + right) / 2 - MAP_WIDTH / zoom / 2,
    y: (top + bottom) / 2 - MAP_HEIGHT / zoom / 2,
    zoom,
  });
}
export function revealMapBounds(view: MapView, bounds: MapBounds): MapView {
  const current = clampMapView(view);
  if (current.zoom === 1 || !validBounds(bounds)) return current;
  const [[left, top], [right, bottom]] = bounds;
  if (right - left > MAP_WIDTH * 0.8) return worldView();
  const width = MAP_WIDTH / current.zoom,
    height = MAP_HEIGHT / current.zoom;
  if (
    left >= current.x &&
    right <= current.x + width &&
    top >= current.y &&
    bottom <= current.y + height
  )
    return current;
  return clampMapView({
    ...current,
    x: (left + right) / 2 - width / 2,
    y: (top + bottom) / 2 - height / 2,
  });
}
export function mapViewBox(view: MapView) {
  const current = clampMapView(view);
  return `${current.x} ${current.y} ${MAP_WIDTH / current.zoom} ${MAP_HEIGHT / current.zoom}`;
}
