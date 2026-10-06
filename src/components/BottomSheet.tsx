import { useEffect, type ReactNode } from 'react'
import { CloseIcon } from './Icons'

interface Props {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
}

/** Hoja inferior estilo iOS. En pantallas grandes se centra como un modal. */
export function BottomSheet({ open, onClose, title, children, footer }: Props) {
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <button aria-label="Cerrar" onClick={onClose} className="absolute inset-0 animate-fade-in bg-ink/40 backdrop-blur-[2px]" />
      <div className="relative flex max-h-[92dvh] w-full max-w-lg animate-sheet-in flex-col rounded-t-[28px] bg-white shadow-2xl sm:rounded-[28px]">
        <div className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-stone-200 sm:hidden" />
        <header className="flex items-center justify-between px-5 pb-2 pt-3">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} className="grid size-9 place-items-center rounded-full bg-stone-100 text-muted active:scale-95" aria-label="Cerrar">
            <CloseIcon className="size-4" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-4">{children}</div>
        {footer && <div className="pb-safe border-t border-stone-100 px-5 pt-3">{footer}</div>}
      </div>
    </div>
  )
}
