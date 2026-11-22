import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/noto-sans-thai'
import '@fontsource/cormorant-garamond/600.css'
import '@fontsource-variable/noto-serif-thai'
import './styles.css'
import './premium.css'
import './desktop.css'
import './desktop-shell.css'
import './desktop-home.css'
import './desktop-pages.css'
import App from './App'
import { registerServiceWorker } from './lib/notify'
import { startReveal } from './lib/reveal'
import { startThaiWrap } from './lib/thaiWrap'

registerServiceWorker()
startReveal()
startThaiWrap() // ไม่ตัดบรรทัดกลางคำไทยทั้งเว็บ

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)
