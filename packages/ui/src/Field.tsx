'use client';

import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type Ref,
  type SelectHTMLAttributes,
} from 'react';
import { Icon } from './icons';
import { cx } from './internal/cx';

export interface HintProps {
  children: ReactNode;
  id?: string;
  className?: string;
}

/** A one-line hint or reason in meta text (15, secondary ink). Link it with `aria-describedby`. */
export function Hint({ children, id, className }: HintProps) {
  return (
    <p id={id} className={cx('wa-reason', className)}>
      {children}
    </p>
  );
}

interface FieldChromeProps {
  /** Visible label above the control (16 / medium). */
  label: ReactNode;
  /** Hint under the control: meta 15, 8 px below. */
  hint?: ReactNode;
  /**
   * Error message: says what to do ("Add the @ and the domain, like
   * name@example.com"). Sets `aria-invalid`; the value is kept.
   */
  error?: ReactNode;
  /** Adds "(required)" to the label in words. */
  required?: boolean;
  className?: string;
}

interface FieldIds {
  inputId: string;
  hintId?: string;
  errorId?: string;
  describedBy?: string;
}

function useFieldIds(
  id: string | undefined,
  hint: ReactNode,
  error: ReactNode,
  extra?: string,
): FieldIds {
  const uid = useId();
  const inputId = id ?? `${uid}-input`;
  const hintId = hint ? `${uid}-hint` : undefined;
  const errorId = error ? `${uid}-error` : undefined;
  const describedBy =
    [errorId, hintId, extra].filter(Boolean).join(' ') || undefined;
  return { inputId, hintId, errorId, describedBy };
}

function FieldChrome({
  label,
  hint,
  error,
  required,
  className,
  ids,
  children,
}: FieldChromeProps & { ids: FieldIds; children: ReactNode }) {
  return (
    <div
      className={cx('wa-field', className)}
      data-invalid={error ? '' : undefined}
    >
      <label className="wa-field__label" htmlFor={ids.inputId}>
        {label}
        {required ? (
          <span className="wa-field__required"> (required)</span>
        ) : null}
      </label>
      {children}
      {error ? (
        <p id={ids.errorId} className="wa-field__error">
          <Icon name="triangle-alert" size={20} />
          <span>{error}</span>
        </p>
      ) : null}
      {hint ? (
        <p id={ids.hintId} className="wa-field__hint">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export interface TextFieldProps
  extends
    FieldChromeProps,
    Omit<
      InputHTMLAttributes<HTMLInputElement>,
      'className' | 'required' | 'children'
    > {
  ref?: Ref<HTMLInputElement>;
  /** Class for the `<input>` itself; `className` goes on the field wrapper. */
  inputClassName?: string;
}

/**
 * Text input (design-final §7.7): 48 px, radius 8, line-strong edge, label above.
 * Always pass `autoComplete`; paste is never blocked. Placeholders are examples only.
 */
export function TextField({
  label,
  hint,
  error,
  required,
  className,
  inputClassName,
  id,
  type = 'text',
  ref,
  'aria-describedby': extraDescribedBy,
  ...rest
}: TextFieldProps) {
  const ids = useFieldIds(id, hint, error, extraDescribedBy);
  return (
    <FieldChrome
      label={label}
      hint={hint}
      error={error}
      required={required}
      className={className}
      ids={ids}
    >
      <input
        {...rest}
        ref={ref}
        id={ids.inputId}
        type={type}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={ids.describedBy}
        className={cx('wa-input', inputClassName)}
      />
    </FieldChrome>
  );
}

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps
  extends
    FieldChromeProps,
    Omit<
      SelectHTMLAttributes<HTMLSelectElement>,
      'className' | 'required' | 'children'
    > {
  options: ReadonlyArray<SelectOption>;
  ref?: Ref<HTMLSelectElement>;
  selectClassName?: string;
}

/** Native select in the input box with a 20 px chevron (design-final §7.7). Always native. */
export function Select({
  label,
  hint,
  error,
  required,
  className,
  selectClassName,
  id,
  options,
  ref,
  'aria-describedby': extraDescribedBy,
  ...rest
}: SelectProps) {
  const ids = useFieldIds(id, hint, error, extraDescribedBy);
  return (
    <FieldChrome
      label={label}
      hint={hint}
      error={error}
      required={required}
      className={className}
      ids={ids}
    >
      <span className="wa-select">
        <select
          {...rest}
          ref={ref}
          id={ids.inputId}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={ids.describedBy}
          className={cx('wa-input', 'wa-select__control', selectClassName)}
        >
          {options.map((option) => (
            <option
              key={option.value}
              value={option.value}
              disabled={option.disabled}
            >
              {option.label}
            </option>
          ))}
        </select>
        <Icon name="chevron-down" size={20} className="wa-select__chevron" />
      </span>
    </FieldChrome>
  );
}
