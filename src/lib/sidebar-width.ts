export const SIDEBAR_WIDTH_KEY = 'abundance-access:sidebar-width:v1';
export const SIDEBAR_MIN_WIDTH = 208;
export const SIDEBAR_MAX_WIDTH = 360;
export const SIDEBAR_MOBILE_BREAKPOINT = 800;

const viewport = (width: number) => (Number.isFinite(width) && width > 0 ? width : 1440);

export function sidebarWidthBounds(viewportWidth: number) {
  return {
    min: SIDEBAR_MIN_WIDTH,
    max: Math.max(
      SIDEBAR_MIN_WIDTH,
      Math.min(SIDEBAR_MAX_WIDTH, Math.floor(viewport(viewportWidth) - 520)),
    ),
  };
}

export function defaultSidebarWidth(viewportWidth: number) {
  return viewport(viewportWidth) > 1200 ? 248 : 220;
}

export function effectiveSidebarWidth(preferred: number | null, viewportWidth: number) {
  const bounds = sidebarWidthBounds(viewportWidth);
  const requested =
    preferred !== null && Number.isFinite(preferred)
      ? Math.round(preferred)
      : defaultSidebarWidth(viewportWidth);
  return Math.max(bounds.min, Math.min(bounds.max, requested));
}

export function parseSidebarWidth(raw: string | null): number | null {
  if (raw === null || !/^\d{3}$/.test(raw)) return null;
  const width = Number(raw);
  return Number.isInteger(width) && width >= SIDEBAR_MIN_WIDTH && width <= SIDEBAR_MAX_WIDTH
    ? width
    : null;
}

export function loadSidebarWidth(storage: Pick<Storage, 'getItem'> | null): number | null {
  try {
    return parseSidebarWidth(storage?.getItem(SIDEBAR_WIDTH_KEY) ?? null);
  } catch {
    return null;
  }
}

export function saveSidebarWidth(
  storage: Pick<Storage, 'setItem' | 'removeItem'> | null,
  width: number | null,
): boolean {
  if (!storage || (width !== null && parseSidebarWidth(String(width)) !== width)) return false;
  try {
    if (width === null) storage.removeItem(SIDEBAR_WIDTH_KEY);
    else storage.setItem(SIDEBAR_WIDTH_KEY, String(width));
    return true;
  } catch {
    return false;
  }
}
