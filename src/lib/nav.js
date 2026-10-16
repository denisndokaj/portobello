import { LayoutDashboard, Users, Package, ShoppingCart, FileText, Tag, ScrollText, NotebookPen, Settings } from 'lucide-react'

export const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, shortcut: '1' },
  { to: '/venditori', label: 'Venditori', icon: Users, shortcut: '2' },
  { to: '/articoli', label: 'Articoli', icon: Package, shortcut: '3' },
  { to: '/vendi', label: 'Vendi', icon: ShoppingCart, shortcut: '4' },
  { to: '/distinte', label: 'Fatture', icon: FileText, shortcut: '5' },
  { to: '/etichette', label: 'Etichette', icon: Tag, shortcut: '6' },
  { to: '/registro', label: 'Registro', icon: ScrollText, shortcut: '7' },
  { to: '/note', label: 'Note', icon: NotebookPen, shortcut: '8' },
  { to: '/impostazioni', label: 'Impostazioni', icon: Settings, shortcut: '9' },
]

export const BOTTOM_NAV_ITEMS = NAV_ITEMS.slice(0, 4)
export const MORE_NAV_ITEMS = NAV_ITEMS.slice(4)
