import { LayoutDashboard, Users, Package, ShoppingCart, CheckSquare, FileText, Tag, ScrollText, Settings } from 'lucide-react'

export const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, shortcut: '1' },
  { to: '/venditori', label: 'Venditori', icon: Users, shortcut: '2' },
  { to: '/articoli', label: 'Articoli', icon: Package, shortcut: '3' },
  { to: '/cassa', label: 'Cassa', icon: ShoppingCart, shortcut: '4' },
  { to: '/segna-venduti', label: 'Segna Venduti', icon: CheckSquare, shortcut: '5' },
  { to: '/distinte', label: 'Distinte', icon: FileText, shortcut: '6' },
  { to: '/etichette', label: 'Etichette', icon: Tag, shortcut: '7' },
  { to: '/registro', label: 'Registro', icon: ScrollText, shortcut: '8' },
  { to: '/impostazioni', label: 'Impostazioni', icon: Settings, shortcut: '9' },
]

export const BOTTOM_NAV_ITEMS = NAV_ITEMS.slice(0, 4)
export const MORE_NAV_ITEMS = NAV_ITEMS.slice(4)
