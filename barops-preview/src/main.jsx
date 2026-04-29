import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import BarOps from './BarOps.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BarOps />
  </StrictMode>,
)
