/**
 * Small best-effort JSON persistence helpers on top of localStorage.
 * All failures (unavailable storage, quota, corrupt values) fall back to the
 * provided default so the UI keeps working without persistence.
 */

/** Reads a JSON value from localStorage, returning the fallback when absent or invalid. */
export function loadJson<T>(key: string, fallback: T): T {
  if (typeof localStorage === 'undefined') {
    return fallback;
  }
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) {
      return fallback;
    }
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** Writes a JSON value to localStorage; failures are ignored. */
export function saveJson(key: string, value: unknown): void {
  if (typeof localStorage === 'undefined') {
    return;
  }
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage may be unavailable (private mode, quota); persistence is best-effort.
  }
}
