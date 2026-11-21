import { useEffect, useState } from 'react'
import { lookupPlace, type GeoProvince, type GeoSubdistrict } from './geo'

// Where the visitor is right now (province / district / subdistrict), updated while they move.
// Uses the phone's location and the local boundary files, so no map service is needed.
type Point = [number, number]
export type LiveArea = { state: 'in'; province: Omit<GeoProvince, 'polygons'>; sub: Omit<GeoSubdistrict, 'polygons'> | null } | { state: 'outside' } | null

const metres = (p: Point, q: Point) => Math.hypot((p[1] - q[1]) * Math.cos(p[0] * Math.PI / 180), p[0] - q[0]) * 111320

// A rough fix (from cell towers / Wi-Fi) can be kilometres off and land in the wrong subdistrict.
const MAX_ACCURACY_M = 1000
// Remember the last good answer so a refresh shows the right place at once instead of jumping around.
const KEY = 'cd_live_area', KEEP_MS = 30 * 60 * 1000

function remembered(): LiveArea {
  try {
    const c = JSON.parse(localStorage.getItem(KEY) || 'null') as { at: number; area: LiveArea } | null
    return c && Date.now() - c.at < KEEP_MS ? c.area : null
  } catch { return null }
}
function remember(area: LiveArea) {
  try { localStorage.setItem(KEY, JSON.stringify({ at: Date.now(), area })) } catch { /* storage unavailable */ }
}

export function useLiveArea(): LiveArea {
  const [area, setArea] = useState<LiveArea>(remembered)
  useEffect(() => {
    if (!('geolocation' in navigator)) return
    let last: { p: Point; acc: number } | null = null, alive = true
    const onFix = (pos: GeolocationPosition) => {
      const here: Point = [pos.coords.latitude, pos.coords.longitude], acc = pos.coords.accuracy || Infinity
      if (acc > MAX_ACCURACY_M) return // too rough to name a subdistrict; wait for a better fix
      // look up again only after moving a bit, or when the fix is clearly more precise than the last one
      if (last && metres(last.p, here) < 150 && acc >= last.acc * 0.7) return
      last = { p: here, acc }
      lookupPlace(here[0], here[1]).then(place => {
        if (!alive) return
        const next: LiveArea = place ? { state: 'in', province: strip(place.province), sub: place.sub && strip(place.sub) } : { state: 'outside' }
        setArea(next); remember(next)
      }).catch(() => { last = null })
    }
    const id = navigator.geolocation.watchPosition(onFix, () => {}, { enableHighAccuracy: true, maximumAge: 0, timeout: 30000 })
    return () => { alive = false; navigator.geolocation.clearWatch(id) }
  }, [])
  return area
}

function strip<T extends { polygons: unknown }>(x: T): Omit<T, 'polygons'> {
  const { polygons: _drop, ...rest } = x
  void _drop
  return rest
}
