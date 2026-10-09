import { loadJson, saveJson } from './storage';

/**
 * Shared drag-to-resize support for the side panels. A stored width of null
 * means "not customized": the stylesheet default applies and the preference
 * is dropped.
 */

/** Room kept for the commit table while a panel is dragged wider. */
const RESERVED_LAYOUT_WIDTH = 400;

/** Reads a persisted panel width; null when unset, corrupt or not a size. */
export function loadPanelWidth(key: string): number | null {
  const stored = loadJson<number | null>(key, null);
  return typeof stored === 'number' && Number.isFinite(stored) && stored > 0 ? stored : null;
}

/** Persists a panel width; like every stored preference this is best-effort. */
export function savePanelWidth(key: string, width: number): void {
  saveJson(key, Math.round(width));
}

/** Forgets a panel width so the stylesheet default applies again. */
export function clearPanelWidth(key: string): void {
  if (typeof localStorage === 'undefined') {
    return;
  }
  try {
    localStorage.removeItem(key);
  } catch {
    // Storage may be unavailable (private mode, quota); persistence is best-effort.
  }
}

/**
 * Bounds a width to the usable range: never below `min`, never so wide the
 * rest of the layout collapses (the commit table keeps its share).
 */
export function clampPanelWidth(width: number, min: number): number {
  const max = Math.max(min, window.innerWidth - RESERVED_LAYOUT_WIDTH);
  return Math.max(min, Math.min(max, width));
}

/**
 * Runs a panel resize drag after a mousedown on its edge handle: pointer
 * moves stream clamped widths through `onResize`, and the release hands the
 * final width to `onEnd`. Text selection is suppressed and the resize cursor
 * pinned for the duration. Returns a cleanup that ends the drag early, for
 * the owning component's teardown.
 */
export function startPanelResize(
  event: MouseEvent,
  options: {
    /** +1 for a left panel (widens rightwards), -1 for a right panel. */
    direction: 1 | -1;
    /** Effective panel width when the drag started. */
    startWidth: number;
    /** Lower width bound. */
    min: number;
    /** Receives every clamped width while the drag lasts. */
    onResize: (width: number) => void;
    /** Called once with the final width when the mouse is released. */
    onEnd: (width: number) => void;
  },
): () => void {
  event.preventDefault();
  event.stopPropagation();
  const startX = event.clientX;
  let last = clampPanelWidth(options.startWidth, options.min);
  document.body.style.userSelect = 'none';
  document.body.style.cursor = 'col-resize';

  const onMove = (move: MouseEvent): void => {
    const delta = (move.clientX - startX) * options.direction;
    last = clampPanelWidth(options.startWidth + delta, options.min);
    options.onResize(last);
  };
  const detach = (): void => {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
  };
  const onUp = (): void => {
    detach();
    options.onEnd(last);
  };
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
  return detach;
}
