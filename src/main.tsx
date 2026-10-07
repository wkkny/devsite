import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider } from '@/components/theme-provider'
import { TooltipProvider } from '@/components/ui/tooltip'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      {/* After the first tooltip, neighbouring ones open without the delay. */}
      <TooltipProvider delay={120}>
        <App />
      </TooltipProvider>
    </ThemeProvider>
  </StrictMode>,
)
