'use client';

import { createContext, useContext, type ReactNode } from 'react';

const OverlayContainerContext = createContext<Element | null>(null);

export interface OverlayContainerProps {
  /** Element that portalled overlays (tooltips) render into. */
  container: Element | null;
  children: ReactNode;
}

/**
 * Renders portalled overlays inside `container` instead of `document.body`, so they
 * inherit a scoped theme (`data-theme` on a wrapper) or live inside a shadow root.
 */
export function OverlayContainer({
  container,
  children,
}: OverlayContainerProps) {
  return (
    <OverlayContainerContext.Provider value={container}>
      {children}
    </OverlayContainerContext.Provider>
  );
}

export function useOverlayContainer(): Element | undefined {
  return useContext(OverlayContainerContext) ?? undefined;
}
