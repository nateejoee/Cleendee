import { useEffect, useState } from 'react'

// Where the visitor is right now (subdistrict / district in Chumphon), updated while they move.
// Uses the phone's location and the local Chumphon boundary file, so no map service is needed.
type Point = [number, number]
type Area = { subdistrict: string; district: string; polygons: Point[][][] }
export type LiveArea = { state: 'in'; subdistrict: string; district: string } | { state: 'outside' } | null

let areas: Promise<Area[]> | null = null
const loadAreas = (): Promise<Area[]> => (areas ??= fetch('/geo/chumphon.json').then(r => { if (!r.ok) throw Error('geo'); return r.json() }).catch(e => { areas = null; throw e }))

function contains(ring: Point[], x: number, y: number) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [a, b] = ring[i], [c, d] = ring[j]
    if ((b > y) !== (d > y) && x < (c - a) * (y - b) / (d - b) + a) inside = !inside
  }
  return inside
}
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
      loadAreas().then((list: Area[]) => {
        if (!alive) return
        const [lat, lon] = here
        const hit = list.find(a => a.polygons.some(([outer, ...holes]) => contains(outer, lon, lat) && !holes.some(h => contains(h, lon, lat))))
        setArea(hit ? { state: 'in', subdistrict: hit.subdistrict, district: hit.district } : { state: 'outside' })
      }).catch(() => { last = null })
    }
    const id = navigator.geolocation.watchPosition(onFix, () => {}, { enableHighAccuracy: false, maximumAge: 60000, timeout: 20000 })
    return () => { alive = false; navigator.geolocation.clearWatch(id) }
  }, [])
  return area
}

// English district names, used when the district list from the database is not loaded
export const DISTRICT_EN: Record<string, string> = {
  'เมืองชุมพร': 'Mueang Chumphon', 'ท่าแซะ': 'Tha Sae', 'ปะทิว': 'Pathio', 'หลังสวน': 'Lang Suan',
  'ละแม': 'Lamae', 'พะโต๊ะ': 'Phato', 'สวี': 'Sawi', 'ทุ่งตะโก': 'Thung Tako',
}
