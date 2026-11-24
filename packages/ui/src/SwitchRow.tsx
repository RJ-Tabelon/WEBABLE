'use client';

import {
  useId,
  type ButtonHTMLAttributes,
  type ReactNode,
  type Ref,
} from 'react';
import { CheckGlyph } from './glyphs';
import { cx } from './internal/cx';
import { useControllableState } from './internal/state';

type NativeButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  | 'children'
  | 'onClick'
  | 'onChange'
  | 'role'
  | 'type'
  | 'disabled'
  | 'id'
  | 'className'
>;

export interface SwitchRowProps extends NativeButtonProps {
  /** Visible label and accessible name (16 / medium). */
  label: ReactNode;
  /** Optional one-line description under the label (15, secondary ink). */
  description?: ReactNode;
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  /**
   * The switch changes a page ("WebAble on this site", "Bigger click targets"):
   * the on-track uses the fern accent. Settings switches leave this off and use ink.
   */
  changesPage?: boolean;
  /** Never faded: `aria-disabled`, focusable, toggling ignored. Pair with `disabledReason`. */
  disabled?: boolean;
  /** One-line reason shown under the row and linked with `aria-describedby`. */
  disabledReason?: ReactNode;
  /** Always-visible state words. Default "On" / "Off". */
  onLabel?: string;
  offLabel?: string;
  id?: string;
  className?: string;
  ref?: Ref<HTMLButtonElement>;
}

/**
 * Switch row (design-final §7.3). The whole row is one `<button role="switch">`,
 * so the label, the state word and the track are one target of at least 56 px.
 */
export function SwitchRow({
  label,
  description,
  checked,
  defaultChecked = false,
  onCheckedChange,
  changesPage = false,
  disabled = false,
  disabledReason,
  onLabel = 'On',
  offLabel = 'Off',
  id,
  className,
  ref,
  ...rest
}: SwitchRowProps) {
  const [isOn, setOn] = useControllableState(
    checked,
    defaultChecked,
    onCheckedChange,
  );
  const uid = useId();
  const labelId = `${uid}-label`;
  const descId = description ? `${uid}-desc` : undefined;
  const reasonId = disabled && disabledReason ? `${uid}-reason` : undefined;
  const describedBy = [descId, reasonId].filter(Boolean).join(' ') || undefined;

  const row = (
    <button
      {...rest}
      ref={ref}
      id={id}
      type="button"
      role="switch"
      aria-checked={isOn}
      aria-labelledby={labelId}
      aria-describedby={describedBy}
      aria-disabled={disabled || undefined}
      data-accent={changesPage || undefined}
      className={cx('wa-switch', className)}
      onClick={() => {
        if (!disabled) setOn(!isOn);
      }}
    >
      <span className="wa-switch__text">
        <span id={labelId} className="wa-switch__label">
          {label}
        </span>
        {description ? (
          <span id={descId} className="wa-switch__desc">
            {description}
          </span>
        ) : null}
      </span>
      <span className="wa-switch__state" aria-hidden="true">
        {isOn ? onLabel : offLabel}
      </span>
      <span className="wa-switch__track" aria-hidden="true">
        <span className="wa-switch__thumb">
          <CheckGlyph size={12} className="wa-switch__check" />
        </span>
      </span>
    </button>
  );

  if (!reasonId) return row;
  return (
    <div className="wa-switch-field">
      {row}
      <p id={reasonId} className="wa-reason">
        {disabledReason}
      </p>
    </div>
  );
}
