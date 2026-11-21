import { useEffect, useState } from 'react'
import { lookupPlace, type GeoProvince, type GeoSubdistrict } from './geo'

// Where the visitor is right now (province / district / subdistrict), updated while they move.
// Uses the phone's location and the local boundary files, so no map service is needed.
type Point = [number, number]
export type LiveArea = { state: 'in'; province: Omit<GeoProvince, 'polygons'>; sub: GeoSubdistrict | null } | { state: 'outside' } | null

const metres = (p: Point, q: Point) => Math.hypot((p[1] - q[1]) * Math.cos(p[0] * Math.PI / 180), p[0] - q[0]) * 111320

export function useLiveArea(): LiveArea {
  const [area, setArea] = useState<LiveArea>(null)
  useEffect(() => {
    if (!('geolocation' in navigator)) return
    let last: Point | null = null, alive = true
    const onFix = (pos: GeolocationPosition) => {
      const here: Point = [pos.coords.latitude, pos.coords.longitude]
      if (last && metres(last, here) < 150) return // only look up again after moving a bit
      last = here
      lookupPlace(here[0], here[1]).then(place => {
        if (alive) setArea(place ? { state: 'in', province: place.province, sub: place.sub } : { state: 'outside' })
      }).catch(() => { last = null })
    }
    const id = navigator.geolocation.watchPosition(onFix, () => {}, { enableHighAccuracy: false, maximumAge: 60000, timeout: 20000 })
    return () => { alive = false; navigator.geolocation.clearWatch(id) }
  }, [])
  return area
}
