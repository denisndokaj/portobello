import BarcodeSvg from '../../components/BarcodeSvg'
import { formatMoney, formatDate, padCode, getCurrentPrice } from '../../lib/business'
import { LABEL_PRESETS } from '../../lib/business'

/** Printable sheet: one div per selected article sized to the configured
 * label format in millimetres, so the browser print dialog maps 1:1 to the
 * physical label when "Scale: 100%" / "Actual size" is selected. */
/** A thermal label printer (Brother QL-800, Zebra, Dymo...) isn't a sheet
 * printer: it advances one physical label per "page" the driver receives, at
 * the exact roll/die-cut size - there is no A4 canvas to lay several labels
 * out on. So each label here is forced onto its own print page (matching
 * @page to the preset's physical size) instead of flowing in a flex-wrap
 * grid, which is what actually caused labels to come out misaligned: the
 * browser was fitting the grid onto a default A4 page with its own margins,
 * ignoring the real label dimensions entirely. */
export default function LabelSheet({ articles, vendorMap, settings, elements, priceMode = 'current' }) {
  const preset = LABEL_PRESETS[settings.hardware.labelPrinterFormat] || LABEL_PRESETS['DK-11201']

  return (
    <div className="print-area hidden print:block">
      <style>{`@page { size: ${preset.widthMm}mm ${preset.heightMm}mm; margin: 0; }`}</style>
      {articles.map((a, i) => {
        const vendor = vendorMap[a.vendorId]
        const price = priceMode === 'full' ? a.originalPrice : getCurrentPrice(a, settings)
        const discounted = priceMode === 'current' && price < a.originalPrice
        return (
          <div
            key={a.id}
            className="flex flex-col justify-between overflow-hidden p-1"
            style={{
              width: `${preset.widthMm}mm`,
              height: `${preset.heightMm}mm`,
              breakAfter: i < articles.length - 1 ? 'page' : 'auto',
              breakInside: 'avoid',
            }}
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
