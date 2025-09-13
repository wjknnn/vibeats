import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AudioManagerProvider } from './audio/AudioManagerContext.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AudioManagerProvider>
      <App />
    </AudioManagerProvider>
  </StrictMode>
)
