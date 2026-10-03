import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { startPwaUpdates } from './game/ui/pwaUpdates'
import './index.css'
import App from './App.tsx'

startPwaUpdates()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
