'use client';

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Icon } from './icons';
import { cx } from './internal/cx';
import { readDurationMs } from './internal/motion';
import { useControllableState } from './internal/state';

export interface DisclosureProps {
  /** Row title (18 / medium, 16 in compact surfaces). */
  title: ReactNode;
  /** Panel content (body 18 secondary ink, 16 in compact surfaces). */
  children: ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** `reading` (default) for pages; `compact` for the popup and side panel. */
  density?: 'reading' | 'compact';
  /**
   * Wraps the trigger in a heading of this level so the section appears in the
   * heading outline. `null` renders the bare button (default 3).
   */
  headingLevel?: 2 | 3 | 4 | 5 | 6 | null;
  /** Optional trailing text before the chevron, for example a count. */
  meta?: ReactNode;
  id?: string;
  className?: string;
}

const useIsoLayoutEffect =
  typeof window === 'undefined' ? useEffect : useLayoutEffect;

/**
 * Disclosure row (design-final §7.12). A `<button aria-expanded aria-controls>`
 * whose panel uses `hidden="until-found"`, so find-in-page reaches collapsed text
 * and opens it. Height animates over `--dur-expand` (0 under reduced motion).
 * Never used for Help, contact, or the first view of "What changed".
 */
export function Disclosure({
  title,
  children,
  open,
  defaultOpen = false,
  onOpenChange,
  density = 'reading',
  headingLevel = 3,
  meta,
  id,
  className,
}: DisclosureProps) {
  const [isOpen, setOpen] = useControllableState(
    open,
    defaultOpen,
    onOpenChange,
  );
  // The panel stays in the layout while it collapses, then becomes hidden.
  const [panelHidden, setPanelHidden] = useState(!isOpen);
  const uid = useId();
  const panelId = `${uid}-panel`;
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useIsoLayoutEffect(() => {
    if (isOpen) {
      setPanelHidden(false);
      return;
    }
    const ms = readDurationMs(rootRef.current, '--dur-expand', 220);
    if (ms <= 0) {
      setPanelHidden(true);
      return;
    }
    const timer = setTimeout(() => setPanelHidden(true), ms);
    return () => clearTimeout(timer);
  }, [isOpen]);

  // React renders `hidden` as a boolean; upgrade it to until-found so the browser's
  // find-in-page can search and reveal collapsed content.
  useIsoLayoutEffect(() => {
    const panel = panelRef.current;
    if (panel && panelHidden) panel.setAttribute('hidden', 'until-found');
  }, [panelHidden]);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const onBeforeMatch = () => setOpen(true);
    panel.addEventListener('beforematch', onBeforeMatch);
    return () => panel.removeEventListener('beforematch', onBeforeMatch);
  }, [setOpen]);

  const trigger = (
    <button
      type="button"
      className="wa-disclosure__trigger"
      aria-expanded={isOpen}
      aria-controls={panelId}
      onClick={() => setOpen(!isOpen)}
    >
      <span className="wa-disclosure__title">{title}</span>
      {meta ? <span className="wa-disclosure__meta">{meta}</span> : null}
      <span className="wa-disclosure__chevron">
        <Icon name="chevron-down" size={20} />
      </span>
    </button>
  );

  const Heading = headingLevel ? (`h${headingLevel}` as const) : null;

  return (
    <div
      ref={rootRef}
      id={id}
      className={cx(
        'wa-disclosure',
        density === 'compact' && 'wa-disclosure--compact',
        className,
      )}
      data-open={isOpen ? '' : undefined}
    >
      {Heading ? (
        <Heading className="wa-disclosure__heading">{trigger}</Heading>
      ) : (
        trigger
      )}
      <div className="wa-disclosure__region">
        <div
          ref={panelRef}
          id={panelId}
          className="wa-disclosure__panel"
          hidden={panelHidden}
        >
          <div className="wa-disclosure__inner">{children}</div>
        </div>
      </div>
    </div>
  );
}
