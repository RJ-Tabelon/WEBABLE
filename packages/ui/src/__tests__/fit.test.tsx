import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Button } from '../Button';
import { FitRow } from '../FitRow';
import { FitValue } from '../FitValue';
import { Mark } from '../glyphs';

const change: FitValue = {
  kind: 'change',
  before: 16,
  after: 19,
  unit: 'px',
  srText: '16 to 19 pixels',
};

function visual(container: HTMLElement): HTMLElement {
  const el = container.querySelector<HTMLElement>('.wa-fit-value__visual');
  if (!el) throw new Error('no visual');
  return el;
}

describe('FitValue', () => {
  it('change: before, arrow, after with its unit; spoken from srText', () => {
    const { container } = render(<FitValue value={change} />);
    const v = visual(container);
    expect(v.getAttribute('aria-hidden')).toBe('true');
    expect(v.querySelector('.wa-fit-value__before')?.textContent).toBe('16');
    expect(v.querySelector('.wa-fit-value__arrow svg')).toBeTruthy();
    const after = v.querySelector('.wa-fit-value__after');
    // The unit sits inside the after cell, right after the number.
    expect(after?.querySelector('.wa-fit-value__num')?.textContent).toBe('19');
    expect(after?.querySelector('.wa-fit-unit')?.textContent).toBe('px');
    expect(v.textContent).toBe('1619px');
    expect(container.textContent).not.toMatch(/[\u00a0→]/);
    expect(screen.getByText('16 to 19 pixels').className).toBe('sr-only');
    expect(container.firstElementChild?.className).toContain(
      'wa-fit-value--change',
    );
    expect(container.firstElementChild?.className).toContain(
      'wa-fit-value--readout',
    );
  });

  it('change: pulls in "." and ":" in Mono values', () => {
    const { container } = render(
      <FitValue
        value={{
          kind: 'change',
          before: '1.5',
          after: '1.6',
          srText: '1.5 to 1.6',
        }}
        size="inline"
      />,
    );
    expect(container.querySelectorAll('.wa-fit-punct')).toHaveLength(2);
    expect(container.querySelector('.wa-fit-unit')).toBeNull();
    expect(container.firstElementChild?.className).toContain(
      'wa-fit-value--inline',
    );
  });

  it('floor: "At least", then the value in fern', () => {
    const { container } = render(
      <FitValue
        value={{ kind: 'floor', after: '7:1', srText: 'At least 7 to 1' }}
      />,
    );
    const v = visual(container);
    expect(v.querySelector('.wa-fit-value__lead')?.textContent).toBe(
      'At least',
    );
    expect(v.querySelector('.wa-fit-value__num')?.textContent).toBe('7:1');
    expect(v.querySelector('.wa-fit-value__arrow')).toBeNull();
    expect(screen.getByText('At least 7 to 1')).toBeTruthy();
  });

  it('word: before, arrow, after; or the after word alone', () => {
    const { container, rerender } = render(
      <FitValue
        value={{
          kind: 'word',
          before: 'Plays',
          after: 'Paused',
          srText: 'Plays to paused',
        }}
      />,
    );
    let v = visual(container);
    expect(v.querySelector('.wa-fit-value__before')?.textContent).toBe('Plays');
    expect(v.querySelector('.wa-fit-value__arrow svg')).toBeTruthy();
    expect(v.querySelector('.wa-fit-value__after')?.textContent).toBe('Paused');
    rerender(
      <FitValue value={{ kind: 'word', after: 'Dark', srText: 'Dark' }} />,
    );
    v = visual(container);
    expect(v.querySelector('.wa-fit-value__before')).toBeNull();
    expect(v.querySelector('.wa-fit-value__arrow')).toBeNull();
    expect(v.textContent).toBe('Dark');
  });

  it('same: "As the site made it", no fern', () => {
    const { container } = render(
      <FitValue value={{ kind: 'same', srText: 'Unchanged, 80 characters' }} />,
    );
    const v = visual(container);
    expect(v.textContent).toBe('As the site made it');
    expect(v.querySelector('.wa-fit-value__after')).toBeNull();
    expect(screen.getByText('Unchanged, 80 characters')).toBeTruthy();
  });
});

describe('FitRow', () => {
  it('renders label (heading), sentence, source, value and action', () => {
    render(
      <ul>
        <FitRow
          as="li"
          label="Text size"
          headingLevel={3}
          sentence="Text reads best for you at 19 px or larger."
          source="Measured today"
          value={change}
          density="working"
          changed
          labelId="row-text"
          action={
            <Button variant="ghost" size="md" flush="end">
              Adjust
            </Button>
          }
          editor={<p>Editor</p>}
        />
      </ul>,
    );
    const heading = screen.getByRole('heading', {
      level: 3,
      name: 'Text size',
    });
    expect(heading.id).toBe('row-text');
    expect(screen.getByText('Measured today')).toBeTruthy();
    expect(screen.getByText('16 to 19 pixels')).toBeTruthy();
    const button = screen.getByRole('button', { name: 'Adjust' });
    expect(button.className).toContain('wa-btn--flush-end');
    expect(
      screen.getByText('Editor').closest('.wa-fitrow__editor'),
    ).toBeTruthy();
    const row = heading.closest('li');
    expect(row?.className).toContain('wa-fitrow--working');
    expect(row?.className).toContain('wa-fitrow--changed');
  });

  it('keeps unchanged rows compact: no source line', () => {
    const { container } = render(
      <FitRow
        label="Line length"
        headingLevel={2}
        sentence="Line length stays as each site made it."
        source="Default"
        value={{ kind: 'same', srText: 'As the site made it' }}
        density="task"
        changed={false}
      />,
    );
    expect(screen.queryByText('Default')).toBeNull();
    expect(container.firstElementChild?.tagName).toBe('DIV');
    expect(container.firstElementChild?.className).toContain('wa-fitrow--same');
    expect(screen.getByRole('heading', { level: 2 }).id).not.toBe('');
  });
});

describe('Mark', () => {
  it('crops to its own bounds when tight, 16 px tall by default', () => {
    const { container } = render(<Mark tight />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('viewBox')).toBe('5 4 14 15');
    expect(svg?.getAttribute('height')).toBe('16');
    expect(Number(svg?.getAttribute('width'))).toBeCloseTo((16 * 14) / 15);
  });

  it('keeps the 24 grid by default', () => {
    const { container } = render(<Mark size={20} />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('viewBox')).toBe('0 0 24 24');
    expect(svg?.getAttribute('width')).toBe('20');
  });
});

describe('Button flush', () => {
  it('adds the flush class for start and end, and nothing by default', () => {
    render(
      <>
        <Button flush="start">A</Button>
        <Button flush="end" href="/x">
          B
        </Button>
        <Button>C</Button>
      </>,
    );
    expect(screen.getByRole('button', { name: 'A' }).className).toContain(
      'wa-btn--flush-start',
    );
    expect(screen.getByRole('link', { name: 'B' }).className).toContain(
      'wa-btn--flush-end',
    );
    expect(screen.getByRole('button', { name: 'C' }).className).not.toContain(
      'flush',
    );
    expect(
      screen.getByRole('button', { name: 'A' }).hasAttribute('flush'),
    ).toBe(false);
  });
});
