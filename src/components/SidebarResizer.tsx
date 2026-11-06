import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from 'react';
import { sidebarCopy as s } from '../content/sidebar-en';
import {
  effectiveSidebarWidth,
  loadSidebarWidth,
  saveSidebarWidth,
  sidebarWidthBounds,
  SIDEBAR_MOBILE_BREAKPOINT,
} from '../lib/sidebar-width';

type Drag = {
  pointerId: number;
  startX: number;
  startWidth: number;
  startPreferred: number | null;
  lastWidth: number;
  moved: boolean;
};

function readPreferredWidth() {
  try {
    return loadSidebarWidth(window.localStorage);
  } catch {
    return null;
  }
}

function persistWidth(width: number | null) {
  try {
    saveSidebarWidth(window.localStorage, width);
  } catch {
    // Layout remains adjustable when browser storage itself is unavailable.
  }
}

export function SidebarResizer({
  containerRef,
}: {
  containerRef: RefObject<HTMLDivElement | null>;
}) {
  const helpId = useId();
  const [preferred, setPreferred] = useState(readPreferredWidth);
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  const [resizing, setResizing] = useState(false);
  const separator = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const width = effectiveSidebarWidth(preferred, viewportWidth);
  const bounds = sidebarWidthBounds(viewportWidth);

  const endDrag = useCallback((commit: boolean) => {
    const active = drag.current;
    if (!active) return;
    drag.current = null;
    setResizing(false);
    if (commit && active.moved) {
      setPreferred(active.lastWidth);
      persistWidth(active.lastWidth);
    } else setPreferred(active.startPreferred);
    const element = separator.current;
    if (element?.hasPointerCapture(active.pointerId))
      element.releasePointerCapture(active.pointerId);
  }, []);

  useLayoutEffect(() => {
    containerRef.current?.style.setProperty('--sidebar-width', `${width}px`);
  }, [containerRef, width]);

  useEffect(() => {
    // The parent host ref can attach after this child's first layout effect.
    // Reapply after the full commit so restored preferences also affect first mount.
    containerRef.current?.style.setProperty('--sidebar-width', `${width}px`);
  }, [containerRef, width]);

  useLayoutEffect(() => {
    containerRef.current?.classList.toggle('is-resizing', resizing);
  }, [containerRef, resizing]);

  useEffect(() => {
    const resize = () => {
      endDrag(false);
      setViewportWidth(window.innerWidth);
    };
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [endDrag]);

  useEffect(() => {
    const container = containerRef.current;
    return () => {
      const active = drag.current;
      drag.current = null;
      const element = separator.current;
      if (active && element?.hasPointerCapture(active.pointerId))
        element.releasePointerCapture(active.pointerId);
      container?.classList.remove('is-resizing');
      container?.style.removeProperty('--sidebar-width');
    };
  }, [containerRef]);

  const reset = () => {
    endDrag(false);
    setPreferred(null);
    persistWidth(null);
  };

  if (viewportWidth <= SIDEBAR_MOBILE_BREAKPOINT) return null;

  return (
    <div
      ref={separator}
      className="sidebar-resizer"
      role="separator"
      tabIndex={0}
      aria-label={s.resize}
      aria-orientation="vertical"
      aria-controls="research-sidebar research-workspace"
      aria-describedby={helpId}
      aria-valuemin={bounds.min}
      aria-valuemax={bounds.max}
      aria-valuenow={width}
      aria-valuetext={s.width(width)}
      title={s.resizeHelp}
      onPointerDown={(event) => {
        if (event.button !== 0 || drag.current) return;
        event.preventDefault();
        event.currentTarget.focus({ preventScroll: true });
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startWidth: width,
          startPreferred: preferred,
          lastWidth: width,
          moved: false,
        };
        setResizing(true);
      }}
      onPointerMove={(event) => {
        const active = drag.current;
        if (!active || event.pointerId !== active.pointerId) return;
        const next = effectiveSidebarWidth(
          active.startWidth + event.clientX - active.startX,
          window.innerWidth,
        );
        if (next !== active.lastWidth) {
          active.moved = true;
          active.lastWidth = next;
          setPreferred(next);
        }
      }}
      onPointerUp={(event) => {
        if (event.pointerId === drag.current?.pointerId) endDrag(true);
      }}
      onPointerCancel={(event) => {
        if (event.pointerId === drag.current?.pointerId) endDrag(false);
      }}
      onLostPointerCapture={(event) => {
        if (event.pointerId === drag.current?.pointerId) endDrag(false);
      }}
      onDoubleClick={reset}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && drag.current) {
          event.preventDefault();
          endDrag(false);
          return;
        }
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End', 'Enter'].includes(event.key)) return;
        event.preventDefault();
        if (event.key === 'Enter') {
          reset();
          return;
        }
        if (drag.current) endDrag(false);
        const next =
          event.key === 'Home'
            ? bounds.min
            : event.key === 'End'
              ? bounds.max
              : effectiveSidebarWidth(
                  width + (event.key === 'ArrowLeft' ? -10 : 10),
                  viewportWidth,
                );
        if (next !== width) {
          setPreferred(next);
          persistWidth(next);
        }
      }}
    >
      <span className="sidebar-resize-grip" aria-hidden="true" />
      <span id={helpId} className="sr-only">
        {s.resizeHelp}
      </span>
    </div>
  );
}
