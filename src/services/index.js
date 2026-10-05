// Single entry point used by every feature module. The whole app only ever
// imports from "@/services" (this file), never from "./local/*" directly, so
// moving to a cloud backend (Supabase/Firebase/Postgres) is a matter of
// implementing services/remote/* with the same exported function signatures
// and flipping BACKEND in src/lib/config.js (or VITE_BACKEND_MODE env var).
import { BACKEND } from '../lib/config'
import * as local from './local'

// import * as remote from './remote' // TODO: implement when a cloud backend is wired up

const impl = BACKEND === 'remote' ? local /* swap to `remote` once implemented */ : local

export const {
  getSettings,
  updateSettings,
  resetAllData,
  listVendors,
  searchVendors,
  getVendor,
  findHomonyms,
  createVendor,
  updateVendor,
  deleteVendor,
  vendorStats,
  listArticles,
  getArticle,
  getArticleByCode,
  listCategories,
  createArticle,
  updateArticle,
  deleteArticle,
  sellArticle,
  cancelSale,
  markRitiro,
  revertRitiro,
  extendMandate,
  markLabelPrinted,
  getOrCreateInvoice,
  listInvoices,
  getInvoice,
  getInvoiceArticles,
  payInvoice,
  cancelPayment,
  invoiceNumberLabel,
  nextSettlementDefaults,
  salesByMonth,
  topVendorsBySales,
  pendingSettlementByVendor,
  recentSales,
  dashboardSummary,
  cashRegisterTotals,
  cashRegisterByVendor,
  addLog,
  listLogs,
  updateLog,
  deleteLog,
  deleteFilteredLogs,
  getCounters,
  setNextArticleCode,
  setNextInvoiceNumber,
  setNextUnnumberedNumber,
} = impl
