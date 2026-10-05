import BarcodeSvg from '../../components/BarcodeSvg'
import { formatMoney, formatDate, padCode, getCurrentPrice } from '../../lib/business'
import { LABEL_PRESETS } from '../../lib/business'

/** Printable sheet: one div per selected article sized to the configured
 * label format in millimetres, so the browser print dialog maps 1:1 to the
 * physical label when "Scale: 100%" / "Actual size" is selected. */
export default function LabelSheet({ articles, vendorMap, settings, elements, priceMode = 'current' }) {
  const preset = LABEL_PRESETS[settings.hardware.labelPrinterFormat] || LABEL_PRESETS['DK-11201']

  return (
    <div className="print-area hidden flex-wrap gap-2 print:flex">
      {articles.map((a) => {
        const vendor = vendorMap[a.vendorId]
        const price = priceMode === 'full' ? a.originalPrice : getCurrentPrice(a, settings)
        const discounted = priceMode === 'current' && price < a.originalPrice
        return (
          <div
            key={a.id}
            className="flex flex-col justify-between overflow-hidden border border-dashed border-black p-1"
            style={{ width: `${preset.widthMm}mm`, height: `${preset.heightMm}mm`, pageBreakInside: 'avoid' }}
          >
            <div className="flex items-center justify-between text-[7pt] font-semibold">
              <span className="truncate">{settings.shop.name}</span>
              {elements.code && <span className="font-mono">{padCode(a.code)}</span>}
            </div>
            {elements.description && <div className="truncate text-[8pt] leading-tight">{a.description}</div>}
            {elements.vendor && vendor && <div className="truncate text-[6pt] text-gray-600">{vendor.name} {vendor.surname}</div>}
            {elements.barcode && <BarcodeSvg code={a.code} className="h-6 w-full" />}
            <div className="flex items-end justify-between">
              {elements.date && <span className="text-[6pt] text-gray-500">{formatDate(a.loadDate)}</span>}
              {elements.price && (
                <span className="text-[11pt] font-bold">
                  {discounted && <span className="mr-1 text-[8pt] font-normal line-through text-gray-400">{formatMoney(a.originalPrice)}</span>}
                  {formatMoney(price)}
                </span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
