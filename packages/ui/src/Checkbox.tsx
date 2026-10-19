'use client';

import type { ReactNode } from 'react';
import { Checkbox as AriaCheckbox } from 'react-aria-components';
import { CheckGlyph } from './glyphs';
import { cx } from './internal/cx';

export interface CheckboxProps {
  /** Visible label. The whole label row is the hit area (min 44 px). */
  children: ReactNode;
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  /** Mixed state: a 10 x 2 bar. */
  indeterminate?: boolean;
  disabled?: boolean;
  name?: string;
  value?: string;
  /** Marks the field required for forms. The label should say "(required)" in words. */
  required?: boolean;
  id?: string;
  className?: string;
  'aria-describedby'?: string;
}

/**
 * Checkbox (design-final §7.4): a 20 px box with a 2 px line-strong edge; checked
 * fills with ink and shows a 14 px check. Built on React Aria for native semantics.
 */
export function Checkbox({
  children,
  checked,
  defaultChecked,
  onCheckedChange,
  indeterminate,
  disabled,
  name,
  value,
  required,
  id,
  className,
  'aria-describedby': describedBy,
}: CheckboxProps) {
  return (
    <AriaCheckbox
      id={id}
      className={cx('wa-checkbox', className)}
      isSelected={checked}
      defaultSelected={defaultChecked}
      onChange={onCheckedChange}
      isIndeterminate={indeterminate}
      isDisabled={disabled}
      isRequired={required}
      name={name}
      value={value}
      aria-describedby={describedBy}
    >
      {({ isSelected, isIndeterminate }) => (
        <>
          <span className="wa-checkbox__box" aria-hidden="true">
            {isIndeterminate ? (
              <span className="wa-checkbox__bar" />
            ) : isSelected ? (
              <CheckGlyph size={14} />
            ) : null}
          </span>
          <span className="wa-checkbox__label">{children}</span>
        </>
      )}
    </AriaCheckbox>
  );
}
