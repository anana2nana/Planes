import type { SVGProps } from 'react'

type P = SVGProps<SVGSVGElement>
const base = {
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

export const PlusIcon = (p: P) => (
  <svg {...base} {...p}><path d="M12 5v14M5 12h14" /></svg>
)
export const CheckIcon = (p: P) => (
  <svg {...base} strokeWidth={3} {...p}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
)
export const ClockIcon = (p: P) => (
  <svg {...base} {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
)
export const CloseIcon = (p: P) => (
  <svg {...base} {...p}><path d="M6 6l12 12M18 6L6 18" /></svg>
)
export const TrashIcon = (p: P) => (
  <svg {...base} {...p}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 002 2h6a2 2 0 002-2l1-12M9 7V4h6v3" /></svg>
)
export const ListIcon = (p: P) => (
  <svg {...base} {...p}><path d="M9 6h11M9 12h11M9 18h11" /><circle cx="4.5" cy="6" r="1" /><circle cx="4.5" cy="12" r="1" /><circle cx="4.5" cy="18" r="1" /></svg>
)
export const SlidersIcon = (p: P) => (
  <svg {...base} {...p}><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" /><circle cx="16" cy="6" r="2" /><circle cx="10" cy="12" r="2" /><circle cx="18" cy="18" r="2" /></svg>
)
export const NoteIcon = (p: P) => (
  <svg {...base} {...p}><path d="M5 4h14v16H5zM9 9h6M9 13h6M9 17h3" /></svg>
)
export const CloudOffIcon = (p: P) => (
  <svg {...base} {...p}><path d="M3 3l18 18M8 7.5A6 6 0 0118 10a4 4 0 012 7.5M6.5 9.5A4.5 4.5 0 007 18h10" /></svg>
)
export const LogoutIcon = (p: P) => (
  <svg {...base} {...p}><path d="M15 4h3a2 2 0 012 2v12a2 2 0 01-2 2h-3M10 17l-5-5 5-5M5 12h11" /></svg>
)
export const CopyIcon = (p: P) => (
  <svg {...base} {...p}><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h2" /></svg>
)
export const FlagIcon = (p: P) => (
  <svg {...base} {...p}><path d="M5 21V4M5 4h11l-2 4 2 4H5" /></svg>
)
export const TagIcon = (p: P) => (
  <svg {...base} {...p}><path d="M3 12V4a1 1 0 011-1h8l9 9-9 9-9-9z" /><circle cx="8" cy="8" r="1.5" /></svg>
)
export const CalendarIcon = (p: P) => (
  <svg {...base} {...p}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>
)
export const UsersIcon = (p: P) => (
  <svg {...base} {...p}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0113 0M16 4.5a3.5 3.5 0 010 7M18 14a6 6 0 013.5 6" /></svg>
)
export const BellIcon = (p: P) => (
  <svg {...base} {...p}><path d="M6 16V11a6 6 0 0112 0v5l1.5 2h-15L6 16zM10 21h4" /></svg>
)
export const RepeatIcon = (p: P) => (
  <svg {...base} {...p}><path d="M17 2l3 3-3 3M4 11V9a4 4 0 014-4h12M7 22l-3-3 3-3M20 13v2a4 4 0 01-4 4H4" /></svg>
)
export const ChevronIcon = (p: P) => (
  <svg {...base} {...p}><path d="M9 6l6 6-6 6" /></svg>
)
export const PinIcon = (p: P) => (
  <svg {...base} {...p}><path d="M12 21s-7-6.2-7-11.5A7 7 0 0112 2.5a7 7 0 017 7C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></svg>
)
export const NavigateIcon = (p: P) => (
  <svg {...base} {...p}><path d="M3 11l18-8-8 18-2-8-8-2z" /></svg>
)
export const HomeIcon = (p: P) => (
  <svg {...base} {...p}><path d="M3 10.5L12 3l9 7.5M5 9.5V20h5v-6h4v6h5V9.5" /></svg>
)
export const CartIcon = (p: P) => (
  <svg {...base} {...p}><path d="M3 4h2l2.2 11h10.6L20 7H6.2" /><circle cx="9" cy="19.5" r="1.5" /><circle cx="17" cy="19.5" r="1.5" /></svg>
)
export const SunIcon = (p: P) => (
  <svg {...base} {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4" /></svg>
)
export const HeartIcon = (p: P) => (
  <svg {...base} {...p}><path d="M12 20s-7.5-4.6-9.2-9.3C1.6 7.4 3.8 4.5 7 4.5c2 0 3.4 1.1 5 3 1.6-1.9 3-3 5-3 3.2 0 5.4 2.9 4.2 6.2C19.5 15.4 12 20 12 20z" /></svg>
)
export const LeafIcon = (p: P) => (
  <svg {...base} {...p}><path d="M5 19c0-8 5-13.5 15-14-.4 9.6-6 15-14 15" /><path d="M5 19c3-4 6-6.5 9.5-8.5" /></svg>
)
