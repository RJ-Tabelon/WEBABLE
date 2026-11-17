import { LOGO_PATHS, LOGO_VIEWBOX } from '../brand/geometry';

/** The same three-piece mark used by the favicon and extension icons. */
export function Logo({
  size = 28,
  active = false,
  className = '',
}: {
  size?: number;
  active?: boolean;
  className?: string;
}) {
  return (
    <svg
      className={`wa-logo ${className}`.trim()}
      width={size}
      height={size}
      viewBox={LOGO_VIEWBOX}
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      data-active={active ? '' : undefined}
    >
      {LOGO_PATHS.map((d, i) => (
        <g key={i} className={`wa-logo-piece wa-logo-piece-${i + 1}`}>
          <path d={d} />
        </g>
      ))}
    </svg>
  );
}

/** Last to first, first to second, second to third; then repeat from that new order. */
export const logoCss = /* css */ `
.wa-logo { display: block; flex: none; overflow: visible; }
.wa-logo[data-active] .wa-logo-piece { animation: wa-logo-queue-1 3.6s cubic-bezier(.4,0,.2,1) infinite; }
.wa-logo[data-active] .wa-logo-piece-2 { animation-name: wa-logo-queue-2; }
.wa-logo[data-active] .wa-logo-piece-3 { animation-name: wa-logo-queue-3; }
@keyframes wa-logo-queue-1 {
  0%, 8%, 100% { transform: translate(0, 0); opacity: 1; }
  28%, 41% { transform: translate(230px, 0); opacity: 1; }
  61%, 74% { transform: translate(461px, 0); opacity: 1; }
  84% { transform: translate(230px, -160px); opacity: .35; }
  94% { transform: translate(0, 0); opacity: 1; }
}
@keyframes wa-logo-queue-2 {
  0%, 8%, 94%, 100% { transform: translate(0, 0); opacity: 1; }
  28%, 41% { transform: translate(231px, 0); opacity: 1; }
  51% { transform: translate(0, -160px); opacity: .35; }
  61%, 74% { transform: translate(-230px, 0); opacity: 1; }
}
@keyframes wa-logo-queue-3 {
  0%, 8%, 94%, 100% { transform: translate(0, 0); opacity: 1; }
  18% { transform: translate(-230px, -160px); opacity: .35; }
  28%, 41% { transform: translate(-461px, 0); opacity: 1; }
  61%, 74% { transform: translate(-231px, 0); opacity: 1; }
}
.wa-root[data-motion="reduce"] .wa-logo-piece { animation: none; }
@media (prefers-reduced-motion: reduce) { .wa-logo-piece { animation: none !important; } }
`;
