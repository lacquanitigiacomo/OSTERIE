import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ControllerApp } from './ControllerApp'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ControllerApp />
  </StrictMode>
)
