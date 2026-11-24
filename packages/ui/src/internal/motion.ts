/**
 * Reads a duration token (for example `--dur-3-exit`) from the computed style of
 * an element, in milliseconds. Honours reduced-motion overrides because the
 * tokens themselves change under `prefers-reduced-motion` and `data-wa-motion`.
 */
export function readDurationMs(
  element: Element | null,
  token: string,
  fallback: number,
): number {
  if (!element || typeof window === 'undefined') return fallback;
  const raw = window.getComputedStyle(element).getPropertyValue(token).trim();
  if (!raw) return fallback;
  const value = Number.parseFloat(raw);
  if (!Number.isFinite(value)) return fallback;
  return raw.endsWith('ms') ? value : raw.endsWith('s') ? value * 1000 : value;
}

/** True when the OS or the WebAble profile asks for reduced motion. */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  if (document.documentElement.dataset.waMotion === 'reduce') return true;
  return (
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  );
}
