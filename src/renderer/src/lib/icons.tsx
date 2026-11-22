import type { SVGProps } from 'react'

type P = SVGProps<SVGSVGElement> & { size?: number }
const base = ({ size = 15, ...rest }: P) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  'aria-hidden': true,
  ...rest
})
const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round'
} as const

/** Monograma S: dos trazos que no se tocan (el ícono de la app, simplificado para tamaños chicos). */
export const Mark = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="270 262 484 500" aria-hidden>
    <path
      d="M690 322 H404 Q336 322 336 390 V408 Q336 476 404 476 H468"
      fill="none"
      stroke="var(--mark-a)"
      strokeWidth="108"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M556 548 H620 Q688 548 688 616 V634 Q688 702 620 702 H334"
      fill="none"
      stroke="var(--mark-b)"
      strokeWidth="108"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

export const Search = (p: P) => (
  <svg {...base(p)}>
    <circle cx="11" cy="11" r="7" {...stroke} strokeWidth={2} />
    <path d="m20 20-4-4" {...stroke} strokeWidth={2} />
  </svg>
)
export const Gear = (p: P) => (
  <svg {...base({ size: 18, ...p })}>
    <circle cx="12" cy="12" r="3" {...stroke} />
    <path
      d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"
      {...stroke}
      strokeWidth={1.4}
    />
  </svg>
)
export const Grid = (p: P) => (
  <svg {...base(p)}>
    {[
      [4, 4],
      [13, 4],
      [4, 13],
      [13, 13]
    ].map(([x, y]) => (
      <rect key={`${x}${y}`} x={x} y={y} width="7" height="7" rx="2" {...stroke} />
    ))}
  </svg>
)
export const List = (p: P) => (
  <svg {...base(p)}>
    <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" {...stroke} strokeWidth={2} />
  </svg>
)
export const Library = (p: P) => (
  <svg {...base({ size: 16, ...p })}>
    <rect x="3" y="7" width="5" height="13" rx="2" {...stroke} />
    <rect x="10" y="3" width="5" height="17" rx="2" {...stroke} />
    <rect x="17" y="9" width="4" height="11" rx="2" {...stroke} />
  </svg>
)
export const Play = (p: P) => (
  <svg {...base({ size: 13, ...p })}>
    <path
      d="M7 4.5v15a1 1 0 0 0 1.5.86l12-7.5a1 1 0 0 0 0-1.72l-12-7.5A1 1 0 0 0 7 4.5Z"
      fill="currentColor"
    />
  </svg>
)
export const Window = (p: P) => (
  <svg {...base(p)}>
    <rect x="3" y="5" width="14" height="12" rx="2" {...stroke} />
    <path d="M7 21h12a2 2 0 0 0 2-2V9" {...stroke} />
  </svg>
)
export const Stop = (p: P) => (
  <svg {...base({ size: 13, ...p })}>
    <rect x="6" y="6" width="12" height="12" rx="2.5" fill="currentColor" />
  </svg>
)
export const More = (p: P) => (
  <svg {...base({ size: 16, ...p })}>
    <circle cx="5" cy="12" r="1.8" fill="currentColor" />
    <circle cx="12" cy="12" r="1.8" fill="currentColor" />
    <circle cx="19" cy="12" r="1.8" fill="currentColor" />
  </svg>
)
export const Edit = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 20h4L18.5 9.5l-4-4L4 16v4Z" {...stroke} />
  </svg>
)
export const Copy = (p: P) => (
  <svg {...base(p)}>
    <rect x="8" y="8" width="12" height="12" rx="2" {...stroke} />
    <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" {...stroke} />
  </svg>
)
export const Folder = (p: P) => (
  <svg {...base(p)}>
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" {...stroke} />
  </svg>
)
export const Trash = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" {...stroke} />
  </svg>
)
export const Close = (p: P) => (
  <svg {...base(p)}>
    <path d="M6 6l12 12M18 6 6 18" {...stroke} strokeWidth={2} />
  </svg>
)
export const Check = (p: P) => (
  <svg {...base({ size: 10, ...p })}>
    <path d="m5 12 5 5 9-10" {...stroke} strokeWidth={3.5} />
  </svg>
)
export const Link = (p: P) => (
  <svg {...base({ size: 13, ...p })}>
    <path
      d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"
      {...stroke}
      strokeWidth={2}
    />
  </svg>
)
export const Clock = (p: P) => (
  <svg {...base({ size: 13, ...p })}>
    <circle cx="12" cy="12" r="8.5" {...stroke} strokeWidth={2} />
    <path d="M12 7.5V12l3 2" {...stroke} strokeWidth={2} />
  </svg>
)
export const Globe = (p: P) => (
  <svg {...base({ size: 16, ...p })}>
    <circle cx="12" cy="12" r="9" {...stroke} />
    <path
      d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3Z"
      {...stroke}
    />
  </svg>
)
export const Pulse = (p: P) => (
  <svg {...base({ size: 16, ...p })}>
    <path
      d="M3 12h4l3-8 4 16 3-8h4"
      fill="none"
      stroke="var(--accent)"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)
export const Chevron = (p: P) => (
  <svg {...base({ size: 14, ...p })}>
    <path d="m6 15 6-6 6 6" {...stroke} strokeWidth={2} />
  </svg>
)
export const Warn = (p: P) => (
  <svg {...base({ size: 20, ...p })}>
    <path d="M12 3 2 20h20L12 3Z" {...stroke} />
    <path d="M12 10v4m0 3v.01" {...stroke} strokeWidth={2} />
  </svg>
)
export const Plus = (p: P) => (
  <svg {...base({ size: 13, ...p })}>
    <path d="M12 5v14M5 12h14" {...stroke} strokeWidth={2.4} />
  </svg>
)
