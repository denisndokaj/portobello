import { create } from 'zustand'

// POS cart: each line is a resolved article plus the editable sale price for
// this transaction (manual discounts happen here, never on the article).
export const useCartStore = create((set, get) => ({
  lines: [],
  paymentMethod: 'contanti',
  addLine: (article, price) => {
    if (get().lines.some((l) => l.article.id === article.id)) return
    set((s) => ({ lines: [...s.lines, { article, price }] }))
  },
  updatePrice: (articleId, price) => {
    set((s) => ({ lines: s.lines.map((l) => (l.article.id === articleId ? { ...l, price } : l)) }))
  },
  removeLine: (articleId) => set((s) => ({ lines: s.lines.filter((l) => l.article.id !== articleId) })),
  setPaymentMethod: (m) => set({ paymentMethod: m }),
  clear: () => set({ lines: [], paymentMethod: 'contanti' }),
  total: () => get().lines.reduce((sum, l) => sum + Number(l.price || 0), 0),
}))
