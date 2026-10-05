import { useEffect, useRef } from 'react'
import { renderBarcode } from '../lib/barcode'

export default function BarcodeSvg({ code, className, ...options }) {
  const ref = useRef(null)
  useEffect(() => {
    renderBarcode(ref.current, code, options)
  }, [code])
  return <svg ref={ref} className={className} />
}
