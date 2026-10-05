import { formatMoney } from './business'

/** Normalizes an Italian mobile number for wa.me (defaults to +39 when no
 * country code is present) and builds a prefilled WhatsApp Web link. */
export function buildWhatsAppLink(phone, text) {
  let digits = (phone || '').replace(/[^\d+]/g, '')
  if (!digits.startsWith('+')) digits = (digits.startsWith('39') ? '' : '39') + digits
  digits = digits.replace('+', '')
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`
}

export function buildMailtoLink(email, subject, body) {
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

export function vendorStatementMessage(vendor, stats, settings) {
  return (
    `Ciao ${vendor.name}, ecco il tuo estratto conto da ${settings.shop.name}:\n\n` +
    `• Totale venduto: ${formatMoney(stats.totalSold)}\n` +
    `• Spettanza venditore: ${formatMoney(stats.vendorShareTotal)}\n` +
    `• Già liquidato: ${formatMoney(stats.alreadyPaid)}\n` +
    `• Saldo da liquidare: ${formatMoney(stats.balanceDue)}\n\n` +
    `Grazie per la fiducia!\n${settings.shop.name}${settings.shop.phone ? ' – ' + settings.shop.phone : ''}`
  )
}
