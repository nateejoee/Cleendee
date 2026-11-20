import { useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { useI18n } from '../lib/i18n'

// bTaskee-style pin: the pin stays in the middle of the map and the customer moves the map under it.
// "Current location" jumps there at once from a quick fix, then sharpens while GPS settles.
export type MapPin = { point: [number, number]; accuracy: number | null }

const CHUMPHON: [number, number] = [10.4930, 99.1800]
const BBOX = '98.55,9.55,99.65,11.25' // minLon,minLat,maxLon,maxLat around Chumphon
type Hit = { point: [number, number]; title: string; sub: string }

function Watch({ onDrag, onMove }: { onDrag: () => void; onMove: (c: [number, number]) => void }) {
  const map = useMapEvents({ dragstart: onDrag, moveend: () => { const c = map.getCenter(); onMove([c.lat, c.lng]) } })
  return null
}
function Fly({ to }: { to: { c: [number, number]; z: number; n: number } | null }) {
  const map = useMap()
  useEffect(() => { if (to) map.setView(to.c, to.z, { animate: true }) }, [map, to])
  return null
}

export function LocationPin({ start, onPin, disabled }: { start?: [number, number] | null; onPin: (pin: MapPin | null) => void; disabled: boolean }) {
  const th = useI18n().lang === 'th'
  const [fly, setFly] = useState<{ c: [number, number]; z: number; n: number } | null>(null)
  const [placed, setPlaced] = useState(!!start)
  const [moving, setMoving] = useState(false)
  const [locating, setLocating] = useState(false)
  const [denied, setDenied] = useState(false)
  const [q, setQ] = useState(''); const [hits, setHits] = useState<Hit[]>([])
  const gps = useRef<number | null>(null) // accuracy of the last GPS jump, cleared once the customer moves the map
  const stopWatch = useRef<(() => void) | null>(null)
  const placedRef = useRef(!!start)

  const jump = (c: [number, number], z: number) => { placedRef.current = true; setPlaced(true); setFly(f => ({ c, z, n: (f?.n || 0) + 1 })) }

  const locate = () => {
    stopWatch.current?.()
    if (!navigator.geolocation) return
    setLocating(true); setDenied(false)
    let best = Infinity, done = false
    const take = (p: GeolocationPosition) => {
      if (done || !(p.coords.accuracy < best)) return
      best = p.coords.accuracy; gps.current = best; setLocating(false)
      jump([p.coords.latitude, p.coords.longitude], 18)
      if (best <= 20) stop()
    }
    const fail = (e: GeolocationPositionError) => { if (e.code === 1) { setDenied(true); stop() } if (best === Infinity && e.code !== 2) setLocating(false) }
    // quick answer from the phone's last known / network position
    navigator.geolocation.getCurrentPosition(take, () => {}, { enableHighAccuracy: false, maximumAge: 120000, timeout: 3000 })
    // then refine with GPS for a few seconds
    const w = navigator.geolocation.watchPosition(take, fail, { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 })
    const timer = setTimeout(() => stop(), 10000)
    function stop() { if (done) return; done = true; clearTimeout(timer); navigator.geolocation.clearWatch(w); setLocating(false) }
    stopWatch.current = stop
  }
  useEffect(() => {
    if (!start) locate()
    return () => stopWatch.current?.()
  }, [])

  const onDrag = () => { stopWatch.current?.(); gps.current = null; setMoving(true); setHits([]); if (!placedRef.current) { placedRef.current = true; setPlaced(true) } }
  const onMove = (c: [number, number]) => {
    setMoving(false)
    if (placedRef.current) onPin({ point: c, accuracy: gps.current })
  }

  // place search (Photon / OpenStreetMap), limited to Chumphon
  useEffect(() => {
    const text = q.trim()
    if (text.length < 2) { setHits([]); return }
    const ctrl = new AbortController()
    const id = setTimeout(() => {
      fetch('https://photon.komoot.io/api/?' + new URLSearchParams({ q: text, limit: '6', bbox: BBOX }), { signal: ctrl.signal, referrerPolicy: 'no-referrer', credentials: 'omit' })
        .then(r => r.json()).then((d: { features?: { geometry: { coordinates: [number, number] }; properties: Record<string, string> }[] }) => {
          setHits((d.features || []).map(f => {
            const p = f.properties
            return { point: [f.geometry.coordinates[1], f.geometry.coordinates[0]] as [number, number], title: p.name || [p.housenumber, p.street].filter(Boolean).join(' ') || p.district || p.city || '',
              sub: [p.street !== p.name ? p.street : '', p.district, p.city, p.county].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(' ') }
          }).filter(h => h.title))
        }).catch(() => {})
    }, 400)
    return () => { clearTimeout(id); ctrl.abort() }
  }, [q])

  const help = denied ? (th ? 'เบราว์เซอร์ไม่ให้ใช้ตำแหน่ง ค้นหาหรือเลื่อนแผนที่ให้หมุดตรงบ้านได้เลย' : 'Location is blocked. Search or move the map so the pin sits on your home.')
    : !placed ? (th ? 'เลื่อนแผนที่ให้หมุดตรงทางเข้าบ้าน หรือกดปุ่มตำแหน่งปัจจุบัน' : 'Move the map so the pin sits on your entrance, or tap the location button.')
    : (th ? 'เลื่อนแผนที่เพื่อขยับหมุดให้ตรงทางเข้าบ้าน' : 'Move the map to put the pin right on your entrance.')

  return <div className="lp">
    <b>{th ? 'ปักหมุดทางเข้าบ้าน' : 'Pin your entrance'}</b>
    <div className="lp-search">
      <input className="input" value={q} disabled={disabled} onChange={e => setQ(e.target.value)} placeholder={th ? 'ค้นหาหมู่บ้าน ถนน หรือสถานที่ใกล้บ้าน' : 'Search a village, road or nearby place'} />
      {hits.length > 0 && <div className="lp-hits">{hits.map((h, i) => <button key={i} type="button" onClick={() => { setQ(''); setHits([]); gps.current = null; stopWatch.current?.(); jump(h.point, 17) }}>
        <b>{h.title}</b>{h.sub && <small>{h.sub}</small>}</button>)}</div>}
    </div>
    <div className="lp-map">
      <MapContainer center={start || CHUMPHON} zoom={start ? 18 : 13} zoomControl={false} style={{ height: 280, zIndex: 0 }}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" maxZoom={19} />
        <Watch onDrag={onDrag} onMove={onMove} />
        <Fly to={fly} />
      </MapContainer>
      <div className={'lp-pin' + (moving ? ' up' : '') + (placed ? '' : ' idle')} aria-hidden="true">
        <svg viewBox="0 0 24 24" width="40" height="40"><path d="M12 22s-7.5-6.6-7.5-12.6a7.5 7.5 0 0 1 15 0C19.5 15.4 12 22 12 22z" fill="#d4a53c" stroke="#13294b" strokeWidth="1.6" /><circle cx="12" cy="9.5" r="2.8" fill="#13294b" /></svg>
      </div>
      <div className="lp-shadow" aria-hidden="true" />
      <button type="button" className="lp-me" disabled={disabled} onClick={locate} aria-label={th ? 'ใช้ตำแหน่งปัจจุบัน' : 'Use my current location'}>
        {locating ? <span className="lp-spin" /> : <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="4" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></svg>}
      </button>
    </div>
    <small role="status">{help}</small>
  </div>
}
