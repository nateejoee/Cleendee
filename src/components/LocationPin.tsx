import { useEffect, useRef, useState } from 'react'
import { Circle, CircleMarker, MapContainer, TileLayer, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { readDeviceLocation, type LocationResult } from '../lib/deviceLocation'
import { useI18n } from '../lib/i18n'
import { Icon } from './ui'

type Point = [number, number]

function Pin({ point, accuracy, place }: { point: Point | null; accuracy: number | null; place: (p: Point) => void }) {
  const map = useMapEvents({ click: e => place([e.latlng.lat, e.latlng.lng]) })
  useEffect(() => {
    if (!point) return
    if (accuracy === null) map.panTo(point)
    else map.setView(point, accuracy <= 30 ? 18 : accuracy <= 100 ? 17 : accuracy <= 500 ? 15 : 13)
  }, [point, accuracy, map])
  return point && <>
    {accuracy !== null && <Circle center={point} radius={accuracy} pathOptions={{ color:'#2476af', weight:1, fillOpacity:0.13 }} />}
    <CircleMarker center={point} radius={7} pathOptions={{ color:'#fff', weight:2, fillColor:'#174e85', fillOpacity:1 }} />
  </>
}

export function LocationPin({point, place, onReading, disabled}: {point: Point | null; place: (p: Point) => void; onReading: (value: boolean) => void; disabled: boolean}) {
  const th = useI18n().lang === 'th'
  const [accuracy, setAccuracy] = useState<number | null>(null)
  const [status, setStatus] = useState<LocationResult | 'reading' | null>(null)
  const cancel = useRef<(() => void) | null>(null)
  useEffect(() => () => cancel.current?.(), [])
  const stop = () => {
    cancel.current?.()
    cancel.current = null
    setStatus(null)
    onReading(false)
  }
  const locate = () => {
    stop()
    if (!navigator.geolocation) { setStatus('unavailable'); return }
    setStatus('reading')
    onReading(true)
    cancel.current = readDeviceLocation(navigator.geolocation, fix => {
      place(fix.point)
      setAccuracy(fix.accuracy)
    }, result => { setStatus(result); onReading(false) })
  }
  const manual = (next: Point) => {
    if (disabled) return
    stop()
    setAccuracy(null)
    place(next)
  }
  const help = status === 'denied' ? (th ? 'อนุญาตให้เบราว์เซอร์เข้าถึงตำแหน่ง หรือแตะแผนที่เพื่อวางหมุด' : 'Allow location in browser settings or tap the map to place a pin.')
    : status === 'timeout' || status === 'unavailable' ? (th ? 'อ่านตำแหน่งไม่ได้ ลองอีกครั้งหรือแตะแผนที่ตรงทางเข้า' : 'Location unavailable. Try again or tap the entrance on the map.')
    : status === 'reading' ? (th ? 'กำลังหาพิกัดที่แม่นที่สุดจากเครื่อง…' : 'Refining your device location…')
    : (th ? 'ตรวจหมุดตรงทางเข้าบ้าน แตะแผนที่เพื่อปรับได้' : 'Check the pin at your entrance. Tap the map to adjust it.')
  return <>
    <b>{th ? 'ตำแหน่งทางเข้าบ้าน' : 'Entrance location'}</b>
    <button type="button" className="btn b-line" disabled={disabled} onClick={status === 'reading' ? stop : locate}><Icon n="pin" />
      {status === 'reading' ? (th ? 'หยุดอ่านตำแหน่ง' : 'Stop locating') : (th ? 'ใช้ GPS จากเครื่องนี้' : 'Use device location')}</button>
    <small role="status">{help}</small>
    <MapContainer center={point ?? [10.493,99.18]} zoom={point ? 17 : 10} scrollWheelZoom={false} style={{height:260,zIndex:0}}>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />
      <Pin point={point} accuracy={accuracy} place={manual} />
    </MapContainer>
    {accuracy !== null && <small>{th ? 'รัศมีความคลาดเคลื่อนประมาณ ' : 'Estimated accuracy radius: '}{Math.ceil(accuracy)} {th ? 'เมตร' : 'm'}</small>}
    {point && <small>{point[0].toFixed(6)}, {point[1].toFixed(6)}</small>}
  </>
}
