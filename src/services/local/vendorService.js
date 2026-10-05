import { db } from '../../lib/db'
import { addLog } from './logService'
import { round2 } from '../../lib/business'

export async function listVendors() {
  const rows = await db.vendors.toArray()
  return rows.sort((a, b) => (a.surname + a.name).localeCompare(b.surname + b.name, 'it'))
}

export async function searchVendors(query) {
  const rows = await listVendors()
  if (!query) return rows
  const q = query.toLowerCase()
  return rows.filter(
    (v) =>
      `${v.name} ${v.surname}`.toLowerCase().includes(q) ||
      (v.cf || '').toLowerCase().includes(q) ||
      (v.phone || '').includes(q) ||
      String(v.id) === q,
  )
}

export async function getVendor(id) {
  return db.vendors.get(Number(id))
}

export async function findHomonyms(name, surname, excludeId) {
  const rows = await listVendors()
  return rows.filter(
    (v) =>
      v.id !== excludeId &&
      v.name.trim().toLowerCase() === name.trim().toLowerCase() &&
      v.surname.trim().toLowerCase() === surname.trim().toLowerCase(),
  )
}

export async function createVendor(data) {
  const id = await db.vendors.add({
    name: '',
    surname: '',
    phone: '',
    email: '',
    address: '',
    birthDate: null,
    birthPlace: '',
    cf: '',
    docType: null,
    docNumber: '',
    iban: '',
    commission: null,
    applyTax: true,
    countInNumbering: true,
    notes: '',
    createdAt: new Date().toISOString(),
    ...data,
  })
  await addLog('venditore_aggiunto', `Venditore aggiunto: ${data.name} ${data.surname}`, { vendorId: id })
  return id
}

export async function updateVendor(id, data) {
  await db.vendors.update(Number(id), data)
  await addLog('venditore_modificato', `Venditore modificato (#${id})`, { vendorId: Number(id) })
}

export async function deleteVendor(id) {
  const count = await db.articles.where('vendorId').equals(Number(id)).count()
  if (count > 0) {
    throw new Error('Impossibile eliminare: il venditore ha articoli associati.')
  }
  const vendor = await db.vendors.get(Number(id))
  await db.vendors.delete(Number(id))
  await addLog('venditore_eliminato', `Venditore eliminato: ${vendor?.name} ${vendor?.surname}`, { vendorId: Number(id) })
}

/** Live financial snapshot for a vendor's detail card. */
export async function vendorStats(id) {
  const vendorId = Number(id)
  const articles = await db.articles.where('vendorId').equals(vendorId).toArray()
  const sold = articles.filter((a) => a.status === 'venduto')
  const totalSold = round2(sold.reduce((sum, a) => sum + (a.soldPrice || 0), 0))
  const vendorShareTotal = round2(sold.reduce((sum, a) => sum + (a.soldVendorShare ?? 0), 0))
  const shopShareTotal = round2(sold.reduce((sum, a) => sum + (a.soldShopShare ?? 0), 0))
  const taxTotal = round2(sold.reduce((sum, a) => sum + (a.soldTax ?? 0), 0))

  const invoices = await db.invoices.where('vendorId').equals(vendorId).toArray()
  const alreadyPaid = round2(invoices.filter((i) => i.paid).reduce((sum, i) => sum + i.vendorShare, 0))

  return {
    articlesActive: articles.filter((a) => a.status === 'disponibile' || getIsActive(a)).length,
    totalSold,
    vendorShareTotal,
    shopShareTotal,
    taxTotal,
    alreadyPaid,
    balanceDue: round2(vendorShareTotal - alreadyPaid),
  }
}

function getIsActive(a) {
  return a.status !== 'venduto' && a.status !== 'ritirato'
}
