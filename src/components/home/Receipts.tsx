import { useState } from 'react'
import { addReceipt, deleteReceipt, useReceipts, type Receipt } from '../../hooks/useReceipts'
import { compressImage } from '../../lib/image'
import type { PersonId } from '../../lib/types'
import { CloseIcon, PlusIcon, TrashIcon } from '../Icons'

/** Fotos de tickets o facturas de un gasto: miniaturas, añadir (cámara o galería) y ver en grande. */
export function Receipts({ itemId, me, onError }: { itemId: string; me: PersonId; onError: (m: string) => void }) {
  const receipts = useReceipts(itemId)
  const [busy, setBusy] = useState(false)
  const [viewing, setViewing] = useState<Receipt | null>(null)

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return
    setBusy(true)
    try {
      for (const f of Array.from(files)) {
        const { dataUrl } = await compressImage(f)
        await addReceipt(itemId, dataUrl, me)
      }
    } catch (e) {
      onError(`No se pudo guardar la foto: ${(e as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {receipts.map((r) => (
          <button key={r.id} onClick={() => setViewing(r)} className="size-20 overflow-hidden rounded-2xl bg-stone-100 active:scale-95" aria-label="Ver ticket">
            <img src={r.dataUrl} alt="" className="size-full object-cover" />
          </button>
        ))}
        <label
          className={`grid size-20 cursor-pointer place-items-center rounded-2xl border-2 border-dashed border-stone-200 text-muted ${busy ? 'animate-pulse' : ''}`}
          aria-label="Añadir foto de ticket"
        >
          {busy ? <span className="text-xs font-semibold">Guardando…</span> : <PlusIcon className="size-6" />}
          <input type="file" accept="image/*" multiple className="sr-only" disabled={busy} onChange={(e) => onFiles(e.target.files)} />
        </label>
      </div>

      {viewing && (
        <div className="fixed inset-0 z-[70] flex flex-col bg-black/95 animate-fade-in" role="dialog" aria-label="Ticket">
          <div className="pt-safe flex justify-between p-3">
            <button
              onClick={() => {
                deleteReceipt(viewing.id).catch((e: Error) => onError(e.message))
                setViewing(null)
              }}
              className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-2 text-sm font-bold text-rose-300"
            >
              <TrashIcon className="size-4" /> Borrar
            </button>
            <button onClick={() => setViewing(null)} aria-label="Cerrar" className="grid size-10 place-items-center rounded-full bg-white/10 text-white">
              <CloseIcon className="size-5" />
            </button>
          </div>
          <img src={viewing.dataUrl} alt="Ticket" className="min-h-0 flex-1 object-contain" />
        </div>
      )}
    </div>
  )
}
