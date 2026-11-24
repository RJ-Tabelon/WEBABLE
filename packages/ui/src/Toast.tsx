'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { CheckGlyph } from './glyphs';
import { Icon } from './icons';
import { IconButton } from './IconButton';
import { cx } from './internal/cx';
import { readDurationMs } from './internal/motion';

export interface ToastAction {
  /** 1 to 3 words starting with a verb, usually "Undo". */
  label: string;
  onAction: () => void;
}

export interface ToastOptions {
  /** What changed, by how much: "Text size is now 18 px on this site." */
  message: ReactNode;
  /** A change WebAble applied: shows the fern check. */
  applied?: boolean;
  /** With an action the toast stays until dismissed or the page changes. */
  action?: ToastAction;
  /**
   * `error` toasts ("Couldn't undo. …") stay until dismissed, like toasts with an
   * action, and carry a warning glyph. Default `default`.
   */
  tone?: 'default' | 'error';
  /**
   * Where focus goes if it is inside the toast when the toast leaves (after
   * Undo, Dismiss or a replacement). Default: the element that had focus when
   * `show()` was called, else the page's `main h1`.
   */
  returnFocus?: HTMLElement | null;
  /** Called when the toast leaves for any reason. */
  onDismiss?: () => void;
}

export interface ToastProps extends Omit<
  ToastOptions,
  'onDismiss' | 'returnFocus'
> {
  /** Called by the close button (and after the action runs). */
  onDismiss?: () => void;
  /** Label for the close button. Default "Dismiss". */
  dismissLabel?: string;
  /** Exit animation state, set by the region. */
  exiting?: boolean;
  className?: string;
}

/**
 * One toast (design-final §7.14): inverse surface, radius 12, the "applied" check,
 * an optional action pill and a close button. It never takes focus.
 */
export function Toast({
  message,
  applied = false,
  action,
  tone = 'default',
  onDismiss,
  dismissLabel = 'Dismiss',
  exiting = false,
  className,
}: ToastProps) {
  return (
    <div
      className={cx('wa-toast', 'wa-inverse', className)}
      data-exiting={exiting || undefined}
      data-tone={tone === 'error' ? 'error' : undefined}
    >
      {tone === 'error' ? (
        <Icon name="triangle-alert" size={20} className="wa-toast__alert" />
      ) : applied ? (
        <CheckGlyph size={20} className="wa-toast__check" />
      ) : null}
      <p className="wa-toast__message">{message}</p>
      {action ? (
        <button
          type="button"
          className="wa-toast__action"
          onClick={() => {
            action.onAction();
            onDismiss?.();
          }}
        >
          {action.label}
        </button>
      ) : null}
      {onDismiss ? (
        <IconButton
          icon="x"
          label={dismissLabel}
          variant="inverse"
          tooltip={false}
          className="wa-toast__close"
          onClick={onDismiss}
        />
      ) : null}
    </div>
  );
}

interface ToastContextValue {
  /** Shows a toast, replacing the current one. Returns a function that dismisses it. */
  show: (options: ToastOptions) => () => void;
  /** Dismisses the current toast. */
  dismiss: () => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

/** Access the toast queue from any component under a `ToastProvider`. */
export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context)
    throw new Error('useToast must be used inside <ToastProvider>.');
  return context;
}

export type ToastPlacement = 'site' | 'popup' | 'layer';

export interface ToastProviderProps {
  children: ReactNode;
  /**
   * Where the region sits: `site` bottom-centre 24 px from the edge (default),
   * `popup` above the footer, `layer` bottom-right 16 px.
   */
  placement?: ToastPlacement;
  /**
   * When this value changes (for example the pathname) the current toast is
   * dismissed: a toast with an action stays until dismissed or the page changes.
   */
  resetKey?: unknown;
  /** Lifetime of a toast without an action, in ms. Default 6000. Paused on hover or focus. Errors never time out. */
  duration?: number;
}

interface ActiveToast extends ToastOptions {
  key: number;
  exiting: boolean;
}

function focusable(el: Element | null | undefined): el is HTMLElement {
  return (
    el instanceof HTMLElement &&
    el.isConnected &&
    el !== document.body &&
    !el.closest('[inert], [hidden], [aria-hidden="true"]')
  );
}

/**
 * Moves focus back to where it was before the person went into the toast, or to
 * the page's h1 when that element is gone (it never falls to <body>).
 */
function restoreFocus(target: HTMLElement | null | undefined) {
  if (focusable(target)) {
    target.focus({ preventScroll: true });
    if (document.activeElement === target) return;
  }
  const heading = document.querySelector<HTMLElement>('main h1');
  if (!heading) return;
  if (!heading.hasAttribute('tabindex')) heading.tabIndex = -1;
  heading.focus({ preventScroll: true });
}

/**
 * Holds one toast at a time and renders the `role="status"` region, which is
 * always in the DOM so screen readers announce new messages politely.
 */
export function ToastProvider({
  children,
  placement = 'site',
  resetKey,
  duration = 6000,
}: ToastProviderProps) {
  const [toast, setToast] = useState<ActiveToast | null>(null);
  const toastRef = useRef<ActiveToast | null>(null);
  const regionRef = useRef<HTMLDivElement>(null);
  const keyRef = useRef(0);
  const [paused, setPaused] = useState(false);

  const commit = useCallback((next: ActiveToast | null) => {
    toastRef.current = next;
    setToast(next);
  }, []);

  /** If focus is inside the region, send it back before the toast goes. */
  const releaseFocus = useCallback((toastLeaving: ActiveToast | null) => {
    const region = regionRef.current;
    if (!region || !region.contains(document.activeElement)) return;
    restoreFocus(toastLeaving?.returnFocus);
  }, []);

  const leave = useCallback(
    (key?: number) => {
      const current = toastRef.current;
      if (!current || current.exiting) return;
      if (key !== undefined && current.key !== key) return;
      current.onDismiss?.();
      releaseFocus(current);
      commit({ ...current, exiting: true });
    },
    [commit, releaseFocus],
  );

  const remove = useCallback((key: number) => leave(key), [leave]);
  const dismiss = useCallback(() => leave(), [leave]);

  const show = useCallback(
    (options: ToastOptions) => {
      const current = toastRef.current;
      const region = regionRef.current;
      const active =
        typeof document !== 'undefined' ? document.activeElement : null;
      // A toast shown from inside the toast (Undo, then "… is back to …") keeps
      // the first toast's return target.
      const fromToast = !!region && !!active && region.contains(active);
      const returnFocus =
        options.returnFocus !== undefined
          ? options.returnFocus
          : fromToast
            ? (current?.returnFocus ?? null)
            : focusable(active)
              ? active
              : null;
      if (current && !current.exiting) current.onDismiss?.();
      releaseFocus(current ? { ...current, returnFocus } : null);
      keyRef.current += 1;
      const key = keyRef.current;
      commit({ ...options, returnFocus, key, exiting: false });
      setPaused(false);
      return () => remove(key);
    },
    [commit, remove, releaseFocus],
  );

  // Unmount after the exit fade.
  useEffect(() => {
    if (!toast?.exiting) return;
    const ms = readDurationMs(regionRef.current, '--dur-3-exit', 150);
    const key = toast.key;
    const timer = setTimeout(() => {
      const current = toastRef.current;
      if (current?.key !== key) return;
      releaseFocus(current);
      commit(null);
    }, ms);
    return () => clearTimeout(timer);
  }, [toast, commit, releaseFocus]);

  // Toasts without an action time out, except while hovered or focused.
  // Errors stay until dismissed.
  useEffect(() => {
    if (
      !toast ||
      toast.exiting ||
      toast.action ||
      toast.tone === 'error' ||
      paused
    )
      return;
    const key = toast.key;
    const timer = setTimeout(() => remove(key), duration);
    return () => clearTimeout(timer);
  }, [toast, paused, duration, remove]);

  // A page change dismisses whatever is showing.
  const firstReset = useRef(true);
  useEffect(() => {
    if (firstReset.current) {
      firstReset.current = false;
      return;
    }
    dismiss();
  }, [resetKey, dismiss]);

  const value = useMemo(() => ({ show, dismiss }), [show, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        ref={regionRef}
        className={cx('wa-toast-region', `wa-toast-region--${placement}`)}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        onPointerEnter={() => setPaused(true)}
        onPointerLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null))
            setPaused(false);
        }}
      >
        {toast ? (
          <Toast
            key={toast.key}
            message={toast.message}
            applied={toast.applied}
            action={toast.action}
            tone={toast.tone}
            exiting={toast.exiting}
            onDismiss={() => remove(toast.key)}
          />
        ) : null}
      </div>
    </ToastContext.Provider>
  );
}
