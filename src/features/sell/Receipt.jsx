import { formatMoney, formatDateTime, padCode } from '../../lib/business'

/** Always mounted (off-screen unless printing); .print-area makes it the
 * only visible thing when window.print() fires, sized to the configured
 * thermal receipt width. */
export default function Receipt({ sale, settings }) {
  if (!sale) return null
  const widthClass = settings.hardware.receiptWidth === '57mm' ? 'receipt-57mm' : 'receipt-80mm'

  return (
    <div className={`print-area mx-auto hidden p-2 text-xs print:block ${widthClass}`}>
      <div className="text-center">
        <p className="text-sm font-bold">{settings.shop.name}</p>
        {settings.shop.address && <p>{settings.shop.address}</p>}
        {settings.shop.phone && <p>{settings.shop.phone}</p>}
      </div>
      <div className="my-1 border-t border-dashed border-black" />
      <p>{formatDateTime(sale.date)}</p>
      <div className="my-1 border-t border-dashed border-black" />
      {sale.lines.map((l) => (
        <div key={l.article.id} className="flex justify-between gap-2">
          <span className="truncate">
            {padCode(l.article.code)} {l.article.description}
          </span>
          <span>{formatMoney(l.price)}</span>
        </div>
      ))}
      <div className="my-1 border-t border-dashed border-black" />
      <div className="flex justify-between font-bold">
        <span>TOTALE</span>
        <span>{formatMoney(sale.total)}</span>
      </div>
      <p className="mt-2 text-center">Grazie e arrivederci!</p>
    </div>
  )
}
