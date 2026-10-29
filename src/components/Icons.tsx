import type { ReactNode } from 'react'
import type { SubstanceIcon } from '../db'

function Svg({ children, size = 22 }: { children: ReactNode; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor"
      strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {children}
    </svg>
  )
}

export const IconPlus = () => <Svg><path d="M12 5v14M5 12h14" /></Svg>
export const IconHome = () => <Svg><path d="M4 11l8-7 8 7M6.5 9.5V20h11V9.5M10 20v-5h4v5" /></Svg>
export const IconBook = () => <Svg><path d="M4 5.5A2.5 2.5 0 016.5 3H20v16H6.5A2.5 2.5 0 004 21.5zM4 5.5v16M8 7h8" /></Svg>
export const IconMinus = () => <Svg><path d="M5 12h14" /></Svg>
export const IconBack = () => <Svg><path d="M15 5l-7 7 7 7" /></Svg>
export const IconChevronLeft = () => <Svg><path d="M15 6l-6 6 6 6" /></Svg>
export const IconChevronRight = () => <Svg><path d="M9 6l6 6-6 6" /></Svg>
export const IconCheck = () => <Svg><path d="M5 12.5l4.5 4.5L19 7.5" /></Svg>
export const IconX = () => <Svg><path d="M6 6l12 12M18 6L6 18" /></Svg>
export const IconSearch = () => <Svg><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.2-4.2" /></Svg>
export const IconCamera = () => (
  <Svg><path d="M4 8h3l1.5-2h7L17 8h3v11H4z" /><circle cx="12" cy="13.5" r="3.5" /></Svg>
)
export const IconMic = () => (
  <Svg><rect x="9" y="3.5" width="6" height="11" rx="3" /><path d="M5.5 11.5a6.5 6.5 0 0013 0M12 18v3" /></Svg>
)
export const IconStop = () => <Svg><rect x="7" y="7" width="10" height="10" rx="1.5" /></Svg>
export const IconTrash = () => (
  <Svg><path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12" /></Svg>
)
export const IconSettings = () => (
  <Svg>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" />
  </Svg>
)
export const IconList = () => <Svg><path d="M8 7h12M8 12h12M8 17h12M4 7h.01M4 12h.01M4 17h.01" /></Svg>
export const IconCalendar = () => (
  <Svg><rect x="3.5" y="5" width="17" height="15" rx="2" /><path d="M3.5 10h17M8 3v4M16 3v4" /></Svg>
)
export const IconFlag = () => <Svg><path d="M6 21V4M6 4h11l-2 4 2 4H6" /></Svg>
export const IconDownload = () => <Svg><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></Svg>
export const IconShuffle = () => (
  <Svg><path d="M4 7h3c5 0 5 10 10 10h3M4 17h3c2 0 3-1.5 4-3.5M14 9.5C15 8 16 7 17 7h3M18 4l3 3-3 3M18 14l3 3-3 3" /></Svg>
)

const glyphs: Record<SubstanceIcon, ReactNode> = {
  cannabis: (
    <g>
      <path d="M12 20v-6" />
      <path d="M12 14c-1.6-3.2-1.6-6.8 0-10.5 1.6 3.7 1.6 7.3 0 10.5z" />
      <path d="M12 14c-3.3-.6-5.7-2.6-7-6 3.4.6 5.8 2.6 7 6z" />
      <path d="M12 14c3.3-.6 5.7-2.6 7-6-3.4.6-5.8 2.6-7 6z" />
      <path d="M12 14.5c-2.4.6-4.6.2-6.5-1.2 2.3-.9 4.5-.5 6.5 1.2z" />
      <path d="M12 14.5c2.4.6 4.6.2 6.5-1.2-2.3-.9-4.5-.5-6.5 1.2z" />
    </g>
  ),
  smoking: (
    <g>
      <rect x="3.5" y="13" width="14" height="3.5" rx=".6" />
      <path d="M14.5 13v3.5M19.5 13v3.5M19.5 10.5c0-1.6-1.6-1.6-1.6-3.2s1.6-1.6 1.6-3.2" />
    </g>
  ),
  alcohol: (
    <g>
      <path d="M10.5 3h3v4.2c0 .6.3 1.1.7 1.5 1 .9 1.6 2.1 1.6 3.4V20a1 1 0 01-1 1H9.2a1 1 0 01-1-1v-7.9c0-1.3.6-2.5 1.6-3.4.4-.4.7-.9.7-1.5z" />
      <path d="M8.2 14h7.6" />
    </g>
  ),
  pill: (
    <g>
      <rect x="3.5" y="8.5" width="17" height="7" rx="3.5" transform="rotate(-35 12 12)" />
      <path d="M10 9.2l4 5.6" />
    </g>
  ),
  generic: <circle cx="12" cy="12" r="6" />,
}

/** Substance glyph with a red strike-through ("frei von"). */
export function SubstanceGlyph({ icon, size = 22, strike = true }: { icon: SubstanceIcon; size?: number; strike?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor"
      strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {glyphs[icon]}
      {strike && <path d="M3.5 3.5l17 17" stroke="var(--red)" strokeWidth={2.2} />}
    </svg>
  )
}

export const SUBSTANCE_ICONS: { value: SubstanceIcon; label: string }[] = [
  { value: 'cannabis', label: 'Cannabis' },
  { value: 'smoking', label: 'Rauchen' },
  { value: 'alcohol', label: 'Alkohol' },
  { value: 'pill', label: 'Tabletten' },
  { value: 'generic', label: 'Sonstiges' },
]
