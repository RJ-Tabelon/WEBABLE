'use client';

import {
  useEffect,
  useId,
  useRef,
  type MouseEvent,
  type ReactNode,
  type SyntheticEvent,
} from 'react';
import { IconButton } from './IconButton';
import { cx } from './internal/cx';

interface OverlayBaseProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Heading. It receives focus when the overlay opens (tabindex -1). */
  title: ReactNode;
  /** Visually hide the title (it stays the accessible name). */
  hideTitle?: boolean;
  /** Supporting sentence under the title (body 18, secondary ink). */
  description?: ReactNode;
  children?: ReactNode;
  /** Buttons, left-aligned, primary first. Wrap them in `Actions`. */
  actions?: ReactNode;
  /** Label for the close button. Default "Close". */
  closeLabel?: string;
  /** Close when the backdrop is clicked. */
  dismissOnBackdrop?: boolean;
  className?: string;
}

interface OverlayShellProps extends OverlayBaseProps {
  kind: 'modal' | 'sheet-bottom' | 'sheet-full';
  /** Content placed at the start of the header row (sheets only), e.g. the wordmark. */
  headerStart?: ReactNode;
  /** Content pinned to the bottom of a full-screen sheet, e.g. the primary action. */
  footer?: ReactNode;
}

/**
 * Native `<dialog>` wrapper shared by `Dialog` and `Sheet`. Focus goes to the
 * title when it opens; the browser traps focus while modal; Esc closes; focus
 * returns to the element that opened it.
 */
function OverlayShell({
  open,
  onOpenChange,
  title,
  hideTitle = false,
  description,
  children,
  actions,
  closeLabel = 'Close',
  dismissOnBackdrop = false,
  className,
  kind,
  headerStart,
  footer,
}: OverlayShellProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const openerRef = useRef<Element | null>(null);
  const uid = useId();
  const titleId = `${uid}-title`;
  const descId = description ? `${uid}-desc` : undefined;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      openerRef.current = document.activeElement;
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
      titleRef.current?.focus({ preventScroll: true });
    } else if (!open && dialog.open) {
      if (typeof dialog.close === 'function') dialog.close();
      else dialog.removeAttribute('open');
      const opener = openerRef.current;
      openerRef.current = null;
      if (opener instanceof HTMLElement && opener.isConnected)
        opener.focus({ preventScroll: true });
    }
  }, [open]);

  // Close without animation if the component unmounts while open.
  useEffect(
    () => () => {
      const dialog = dialogRef.current;
      if (dialog?.open && typeof dialog.close === 'function') dialog.close();
    },
    [],
  );

  const onCancel = (event: SyntheticEvent<HTMLDialogElement>) => {
    // Esc: let React state drive the close so the exit animation and focus return run.
    event.preventDefault();
    onOpenChange(false);
  };

  const onClose = () => {
    if (open) onOpenChange(false);
  };

  const onClick = (event: MouseEvent<HTMLDialogElement>) => {
    if (!dismissOnBackdrop || event.target !== event.currentTarget) return;
    // A click on the dialog element itself (not its content box) is the backdrop.
    const rect = event.currentTarget.getBoundingClientRect();
    const inside =
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom;
    if (!inside) onOpenChange(false);
  };

  const isSheet = kind !== 'modal';

  return (
    <dialog
      ref={dialogRef}
      className={cx('wa-dialog', `wa-dialog--${kind}`, className)}
      aria-labelledby={titleId}
      aria-describedby={descId}
      onCancel={onCancel}
      onClose={onClose}
      onClick={onClick}
    >
      <div className="wa-dialog__frame">
        <div className="wa-dialog__header">
          {headerStart ? (
            <div className="wa-dialog__header-start">{headerStart}</div>
          ) : null}
          <h2
            ref={titleRef}
            id={titleId}
            tabIndex={-1}
            className={cx('wa-dialog__title', hideTitle && 'sr-only')}
          >
            {title}
          </h2>
          <IconButton
            icon="x"
            label={closeLabel}
            size={isSheet ? 'lg' : 'md'}
            tooltip={false}
            className="wa-dialog__close"
            onClick={() => onOpenChange(false)}
          />
        </div>
        <div className="wa-dialog__body">
          {description ? (
            <p id={descId} className="wa-dialog__desc">
              {description}
            </p>
          ) : null}
          {children}
          {actions ? <div className="wa-dialog__actions">{actions}</div> : null}
        </div>
        {footer ? <div className="wa-dialog__footer">{footer}</div> : null}
      </div>
    </dialog>
  );
}

export type DialogProps = OverlayBaseProps;

/**
 * Modal (design-final §7.16): only for irreversible or global actions, never for
 * offers. Radius 20, scrim without blur. Below 48em it presents as a bottom sheet.
 * Destructive verbs are explicit: [Delete my data] filled danger, [Keep my data] secondary.
 */
export function Dialog(props: DialogProps) {
  return <OverlayShell {...props} kind="modal" />;
}

export interface SheetProps extends OverlayBaseProps {
  /** `bottom` (default): a bottom sheet up to 92dvh. `full`: full screen on the canvas (site menu). */
  placement?: 'bottom' | 'full';
  headerStart?: ReactNode;
  footer?: ReactNode;
}

/**
 * Sheet (design-final §7.16, §7.8): a bottom sheet, or a full-screen menu sheet
 * with a 48 px Close at the top right. No drag handle is needed.
 */
export function Sheet({
  placement = 'bottom',
  dismissOnBackdrop,
  ...props
}: SheetProps) {
  return (
    <OverlayShell
      {...props}
      dismissOnBackdrop={dismissOnBackdrop ?? placement === 'bottom'}
      kind={placement === 'full' ? 'sheet-full' : 'sheet-bottom'}
    />
  );
}
