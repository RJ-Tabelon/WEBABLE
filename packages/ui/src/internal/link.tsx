'use client';

import {
  createContext,
  useContext,
  type AnchorHTMLAttributes,
  type ComponentType,
  type ReactNode,
  type Ref,
} from 'react';
import { isInternalHref } from './href';

/** Props every link renderer receives. `href` is always a string. */
export type LinkComponentProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  ref?: Ref<HTMLAnchorElement>;
};

/** A component that renders an anchor, for example Next.js `Link`. */
export type LinkComponent = ComponentType<LinkComponentProps>;

const LinkContext = createContext<LinkComponent | null>(null);

export interface LinkProviderProps {
  /**
   * Renders same-origin links (hrefs starting with a single `/`). In the web app pass
   * Next.js `Link` from a client component; the extension leaves this unset and gets
   * plain anchors.
   */
  component: LinkComponent;
  children: ReactNode;
}

/** Lets every WebAble link and link-button use the host's router link. */
export function LinkProvider({ component, children }: LinkProviderProps) {
  return (
    <LinkContext.Provider value={component}>{children}</LinkContext.Provider>
  );
}

/**
 * Renders an anchor through the provided link component when the href is internal,
 * and a plain `<a>` otherwise (external, `mailto:`, in-page `#hash`).
 */
export function Anchor({ ref, ...props }: LinkComponentProps) {
  const Custom = useContext(LinkContext);
  if (Custom && isInternalHref(props.href))
    return <Custom {...props} ref={ref} />;
  return <a {...props} ref={ref} />;
}
