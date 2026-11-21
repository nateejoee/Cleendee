import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/noto-sans-thai'
import '@fontsource/cormorant-garamond/600.css'
import '@fontsource-variable/noto-serif-thai'
import './styles.css'
import './premium.css'
import App from './App'
import { registerServiceWorker } from './lib/notify'

registerServiceWorker()

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)
