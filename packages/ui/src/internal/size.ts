import type { CSSProperties } from 'react';

/**
 * Glyph sizes are specified in px at the default text size, then rendered in rem so
 * icons grow with the person's text scale like everything else (design-final §0.5).
 */
export function remSize(px: number, style?: CSSProperties): CSSProperties {
  const rem = `${px / 16}rem`;
  return { width: rem, height: rem, ...style };
}
