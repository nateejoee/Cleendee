import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/anuphan/500.css'
import '@fontsource/anuphan/600.css'
import '@fontsource/anuphan/700.css'
import '@fontsource/ibm-plex-sans-thai-looped/400.css'
import '@fontsource/ibm-plex-sans-thai-looped/600.css'
import '@fontsource/nunito/600.css'
import '@fontsource/cormorant-garamond/600.css' // หัวข้อใหญ่ภาษาอังกฤษแบบหรู (ภาษาไทยใช้ Anuphan)
import './styles.css'
import App from './App'

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)
