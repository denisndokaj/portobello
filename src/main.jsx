import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'

// HashRouter (not BrowserRouter): the app is meant to be droppable onto any
// static host - GitHub Pages, a shared folder, a USB stick - with zero
// server-side rewrite rules. Hash-based routes work identically everywhere.
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
)
