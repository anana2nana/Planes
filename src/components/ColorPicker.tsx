import { SWATCHES } from '../lib/colors'
import { CheckIcon } from './Icons'

export function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  const isCustom = !SWATCHES.includes(value.toLowerCase())
  return (
    <div className="grid grid-cols-7 gap-2">
      {SWATCHES.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          aria-label={`Color ${c}`}
          className="grid aspect-square place-items-center rounded-full transition active:scale-90"
          style={{ background: c }}
        >
          {value.toLowerCase() === c && <CheckIcon className="size-4 text-white" />}
        </button>
      ))}
      <label
        className={`relative grid aspect-square cursor-pointer place-items-center overflow-hidden rounded-full ring-2 ring-offset-2 ${isCustom ? 'ring-ink' : 'ring-transparent'}`}
        style={{ background: 'conic-gradient(#f43f5e,#eab308,#22c55e,#0ea5e9,#8b5cf6,#f43f5e)' }}
        title="Color personalizado"
      >
        <span className="size-1/2 rounded-full border-2 border-white" style={{ background: value }} />
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" />
      </label>
    </div>
  )
}
