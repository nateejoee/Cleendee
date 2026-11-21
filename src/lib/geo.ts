// Where a point is in Thailand, from the local boundary files in /geo (no map service needed).
// Province from /geo/provinces.json, then subdistrict from /geo/<DOPA code>.json where we have one.
type Ring = [number, number][] // [lon, lat]
type Polygons = Ring[][] // [[outer, ...holes], ...]
export type GeoProvince = { code: string; name_th: string; name_en: string; bbox: [number, number, number, number]; center: [number, number]; polygons: Polygons }
export type GeoSubdistrict = { subdistrict: string; subdistrict_en: string; district: string; district_en: string; postcode: string; polygons: Polygons }
export type GeoPlace = { province: GeoProvince; sub: GeoSubdistrict | null }

const DETAIL = new Set(['84', '85', '86']) // provinces with a subdistrict file
const files = new Map<string, Promise<unknown>>()
function load<T>(url: string): Promise<T> {
  let p = files.get(url)
  if (!p) {
    p = fetch(url).then(r => { if (!r.ok) throw Error('geo ' + r.status); return r.json() })
    p.catch(() => files.delete(url)) // try again next time
    files.set(url, p)
  }
  return p as Promise<T>
}
export const loadGeoProvinces = () => load<GeoProvince[]>('/geo/provinces.json')

function contains(ring: Ring, x: number, y: number) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [a, b] = ring[i], [c, d] = ring[j]
    if ((b > y) !== (d > y) && x < (c - a) * (y - b) / (d - b) + a) inside = !inside
  }
  return inside
}
const inside = (polygons: Polygons, lon: number, lat: number) =>
  polygons.some(([outer, ...holes]) => contains(outer, lon, lat) && !holes.some(h => contains(h, lon, lat)))

/** The province (and subdistrict, where known) at a point; null outside Thailand. Rejects only if a file cannot be loaded. */
export async function lookupPlace(lat: number, lon: number): Promise<GeoPlace | null> {
  const provinces = await loadGeoProvinces()
  const province = provinces.find(p => { const [x0, y0, x1, y1] = p.bbox; return lon >= x0 && lon <= x1 && lat >= y0 && lat <= y1 && inside(p.polygons, lon, lat) })
  if (!province) return null
  if (!DETAIL.has(province.code)) return { province, sub: null }
  const subs = await load<GeoSubdistrict[]>(`/geo/${province.code}.json`)
  return { province, sub: subs.find(s => inside(s.polygons, lon, lat)) ?? null }
}

/** Province bboxes and centres for the given DOPA codes (empty when the file can't be loaded). */
export async function provinceShapes(codes: string[]) {
  try { return (await loadGeoProvinces()).filter(p => codes.includes(p.code)) } catch { return [] }
}
