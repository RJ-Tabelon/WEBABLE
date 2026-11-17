import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Button } from '../Button';
import { FitMark } from '../FitMark';
import { rulerGeometry, ProgressRuler } from '../ProgressRuler';
import { ICON_NAMES } from '../icons';

describe('Button', () => {
  it('is aria-disabled, focusable and inert when disabled', () => {
    let clicks = 0;
    render(
      <Button disabled onClick={() => (clicks += 1)}>
        Save
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Save' });
    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect(button.hasAttribute('disabled')).toBe(false);
    button.click();
    expect(clicks).toBe(0);
  });

  it('shows the gerund and aria-busy while busy', () => {
    render(
      <Button busy busyLabel="Saving…">
        Save
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Saving…' });
    expect(button.getAttribute('aria-busy')).toBe('true');
  });

  it('renders an anchor for href, with new-tab text for external arrows', () => {
    render(
      <Button href="https://example.com" arrow="external">
        Your fit
      </Button>,
    );
    const link = screen.getByRole('link', {
      name: /^Your fit\s*\(opens in a new tab\)$/,
    });
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toContain('noopener');
  });
});

describe('FitMark', () => {
  it('speaks the change in words and never types an arrow character', () => {
    const { container } = render(
      <FitMark label="Text size" from={13} to={18} unit="px" />,
    );
    expect(screen.getByText('13 to 18 pixels')).toBeTruthy();
    expect(container.textContent).not.toMatch(/[→↗↺✓]/);
    // The unit is its own element, spaced by margin: no no-break-space glyph.
    const unit = container.querySelector('.wa-fit-unit');
    expect(unit?.textContent).toBe('px');
    expect(container.querySelector('.wa-fit-mark__visual')?.textContent).toBe(
      '1318px',
    );
    expect(container.textContent).not.toContain('\u00a0');
  });

  it('pulls in the "." and ":" of Mono values', () => {
    const { container } = render(<FitMark from="4.5:1" to="7:1" />);
    const punct = [...container.querySelectorAll('.wa-fit-punct')].map(
      (el) => el.textContent,
    );
    expect(punct).toEqual(['.', ':', ':']);
    expect(screen.getByText('4.5:1 to 7:1')).toBeTruthy();
  });
});

describe('ProgressRuler', () => {
  const sections = [
    { id: 'reading', label: 'Reading', tasks: 4 },
    { id: 'pointing', label: 'Pointing', tasks: 4 },
    { id: 'focus', label: 'Focus', tasks: 2 },
  ];

  it('places the position proportionally to task counts', () => {
    const g = rulerGeometry(sections, 1, 2);
    expect(g.starts).toEqual([0, 0.4, 0.8]);
    expect(g.position).toBeCloseTo(0.6);
    expect(g.subTicks.map((t) => t.done)).toEqual([true, true, false]);
  });

  it('backs the graphic with an ordered list marking the current step', () => {
    render(<ProgressRuler sections={sections} current={1} taskIndex={2} />);
    const list = screen.getByRole('list', { name: 'Tune progress' });
    expect(list.tagName).toBe('OL');
    const current = screen.getByText('Pointing');
    expect(current.getAttribute('aria-current')).toBe('step');
    expect(screen.getByText(', done')).toBeTruthy();
  });
});

describe('Icon allowlist', () => {
  it('holds exactly the 26 approved icons', () => {
    expect(ICON_NAMES).toHaveLength(26);
  });
});
