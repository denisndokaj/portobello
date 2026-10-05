import { useEffect, useRef, useState } from 'react'
import { searchVendors } from '../services'
import { Input } from './ui/Field'
import { X } from 'lucide-react'

/** Shared vendor search/select combobox, reused everywhere a vendor filter
 * or vendor field is needed (item filters, segna venduti, labels, registro). */
export default function VendorPicker({ value, onChange, placeholder = 'Cerca venditore...' }) {
  const [query, setQuery] = useState('')
  const [options, setOptions] = useState([])
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState(null)
  const boxRef = useRef(null)

  useEffect(() => {
    if (!value) {
      setSelected(null)
      return
    }
    searchVendors('').then((all) => setSelected(all.find((v) => v.id === Number(value)) || null))
  }, [value])

  useEffect(() => {
    const onClick = (e) => !boxRef.current?.contains(e.target) && setOpen(false)
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  useEffect(() => {
    const t = setTimeout(async () => {
      if (!open) return
      setOptions(await searchVendors(query))
    }, 150)
    return () => clearTimeout(t)
  }, [query, open])

  // Selecting/clearing happens on mousedown (with preventDefault) rather than
  // click: the chip and the dropdown occupy the same DOM slot, so a click
  // handler that swaps one for the other mid-event can leave the browser's
  // native click synthesis landing on whatever new button ends up in that
  // slot, firing a spurious second selection. mousedown+preventDefault also
  // skips the browser's default focus handoff, sidestepping the whole class
  // of bug (the standard fix used by accessible combobox implementations).
  function selectVendor(e, v) {
    e.preventDefault()
    setSelected(v)
    setQuery('')
    setOpen(false)
    onChange(v.id)
  }

  function clearVendor(e) {
    e.preventDefault()
    setSelected(null)
    onChange(null)
  }

  if (selected) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm">
        <span className="truncate">
          {selected.name} {selected.surname}
        </span>
        <button onMouseDown={clearVendor} className="text-slate-400 hover:text-slate-600">
          <X size={14} />
        </button>
      </div>
    )
  }

  return (
    <div className="relative" ref={boxRef}>
      <Input
        value={query}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
      />
      {open && options.length > 0 && (
        <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          {options.slice(0, 20).map((v) => (
            <button key={v.id} className="block w-full px-3 py-1.5 text-left text-sm hover:bg-brand-50" onMouseDown={(e) => selectVendor(e, v)}>
              {v.name} {v.surname}
              {v.cf && <span className="ml-2 text-xs text-slate-400">{v.cf}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
