import { db } from '../../lib/db'

export async function getCounters() {
  return db.counters.get(1)
}

/** Lets an operator manually set the "next number" for a series from
 * Settings, but never below the highest number already issued/used -
 * accounting consistency wins over the user's typed value. */
export async function setNextArticleCode(value) {
  const maxUsed = (await db.articles.orderBy('code').last())?.code || 0
  const next = Math.max(Number(value) || 1, maxUsed + 1)
  await db.counters.update(1, { nextArticleCode: next })
  return next
}

export async function setNextInvoiceNumber(value) {
  const rows = (await db.invoices.toArray()).filter((i) => i.numbered)
  const maxUsed = rows.reduce((m, i) => Math.max(m, i.number), 0)
  const next = Math.max(Number(value) || 1, maxUsed + 1)
  await db.counters.update(1, { nextInvoiceNumber: next })
  return next
}

export async function setNextUnnumberedNumber(value) {
  const rows = (await db.invoices.toArray()).filter((i) => !i.numbered)
  const maxUsed = rows.reduce((m, i) => Math.max(m, i.number), 0)
  const next = Math.max(Number(value) || 1, maxUsed + 1)
  await db.counters.update(1, { nextUnnumberedNumber: next })
  return next
}
