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
            className="flex flex-col overflow-hidden p-1"
            style={{
              width: `${preset.widthMm}mm`,
              height: `${preset.heightMm}mm`,
              breakAfter: i < articles.length - 1 ? 'page' : 'auto',
              breakInside: 'avoid',
            }}
          >
            <div className="flex items-start gap-1">
              {elements.barcode && (
                <div className="min-w-0 flex-[3]">
                  <BarcodeSvg code={a.code} className="h-7 w-full" />
                  {elements.code && <div className="text-center font-mono text-[7pt] leading-none">*{padCode(a.code)}*</div>}
                </div>
              )}
              {elements.price && (
                <div className="flex flex-[2] flex-col items-end justify-start">
                  {discounted && <span className="text-[7pt] font-normal leading-none text-gray-400 line-through">{formatMoney(a.originalPrice)}</span>}
                  <span className="text-[15pt] font-bold leading-none">{formatMoney(price)}</span>
                </div>
              )}
            </div>
            <div className="mt-1 truncate text-[8pt] font-bold uppercase leading-tight">{settings.shop.name}</div>
            {elements.description && <div className="truncate text-[8pt] font-bold uppercase leading-tight">{a.description}</div>}
            <div className="mt-auto flex items-center justify-between text-[6pt] text-gray-600">
              {elements.date && <span>{formatDate(a.loadDate)}</span>}
              {elements.vendor && vendor && <span className="truncate">{vendor.name} {vendor.surname}</span>}
            </div>
          </div>
        )
      })}
    </div>
  )
}
