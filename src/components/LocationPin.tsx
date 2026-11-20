import { useEffect, useRef, useState } from 'react'
import { Circle, CircleMarker, MapContainer, TileLayer, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { readDeviceLocation, type DeviceFix, type LocationResult } from '../lib/deviceLocation'
import { useI18n } from '../lib/i18n'
import { Icon } from './ui'

function ConfirmedPin({fix}: {fix: DeviceFix}) {
  const map = useMap()
  useEffect(() => { map.setView(fix.point, 18) }, [map, fix])
  return <>
    <Circle center={fix.point} radius={fix.accuracy} pathOptions={{color:'#2476af',weight:1,fillOpacity:0.13}} />
    <CircleMarker center={fix.point} radius={7} pathOptions={{color:'#fff',weight:2,fillColor:'#174e85',fillOpacity:1}} />
  </>
}

export function LocationPin({fix, place, disabled}: {fix: DeviceFix | null; place: (value: DeviceFix | null) => void; disabled: boolean}) {
  const th = useI18n().lang === 'th'
  const [status,setStatus] = useState<LocationResult | 'reading' | null>(null)
  const cancel = useRef<(() => void) | null>(null)
  useEffect(() => () => cancel.current?.(), [])
  const locate = () => {
    cancel.current?.()
    place(null)
    if (status === 'reading') { setStatus(null); return }
    if (!navigator.geolocation) { setStatus('unavailable'); return }
    setStatus('reading')
    cancel.current = readDeviceLocation(navigator.geolocation, place, setStatus)
  }
  let help = th ? 'ยืนตรงทางเข้าบ้าน แล้วกดอ่าน GPS ระบบจะยืนยันหมุดเมื่อความคลาดเคลื่อนไม่เกิน 10 เมตร' : 'Stand at the entrance and read your location. The pin needs accuracy within 10 m.'
  if (status === 'denied') help = th ? 'เปิดสิทธิ์ตำแหน่งที่ตั้งแบบแม่นยำให้เบราว์เซอร์ แล้วลองอีกครั้ง' : 'Allow precise location in your browser settings and try again.'
  if (status === 'imprecise' || status === 'timeout' || status === 'unavailable') help = th ? 'ยังยืนยันพิกัดไม่ได้ ลองยืนในที่โล่งใกล้ทางเข้า เปิดตำแหน่งแบบแม่นยำ แล้วกดอ่านอีกครั้ง' : 'Could not confirm an accurate pin. Move to an open area near the entrance, enable precise location and retry.'
  if (status === 'reading') help = th ? 'กำลังรอพิกัดที่คลาดเคลื่อนไม่เกิน 10 เมตร…' : 'Waiting for a fix within 10 metres…'
  if (fix) help = th ? 'ยืนยันหมุดแล้ว · คลาดเคลื่อนประมาณ ' + Math.ceil(fix.accuracy) + ' เมตร' : 'Pin confirmed · estimated accuracy ' + Math.ceil(fix.accuracy) + ' m'
  return <>
    <b>{th ? 'ตำแหน่งทางเข้าบ้าน' : 'Entrance location'}</b>
    <small>{th ? 'เมื่อกดอ่าน GPS ระบบจะใช้พิกัดค้นที่อยู่กับ Photon / OpenStreetMap' : 'Reading your location shares the pin with Photon / OpenStreetMap for address lookup.'}</small>
    <button type="button" className="btn b-line" disabled={disabled} onClick={locate}><Icon n="pin" />
      {status === 'reading' ? (th ? 'หยุดอ่านตำแหน่ง' : 'Stop locating') : (th ? 'อ่าน GPS และเติมที่อยู่' : 'Locate and fill address')}</button>
    <small role="status">{help}</small>
    {fix && <MapContainer center={fix.point} zoom={18} scrollWheelZoom={false} style={{height:260,zIndex:0}}>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" /><ConfirmedPin fix={fix} />
    </MapContainer>}
  </>
}
