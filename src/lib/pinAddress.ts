type Point = [number, number]
type Area = { subdistrict: string; district: string; postcode: string; polygons: Point[][][] }
type Feature = { geometry?: { coordinates: Point }; properties: { housenumber?: string; street?: string; name?: string; osm_key?: string; district?: string; city?: string; county?:string; state?: string; postcode?: string } }

function contains(ring: Point[], x: number, y: number) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [a,b] = ring[i], [c,d] = ring[j]
    if ((b > y) !== (d > y) && x < (c-a)*(y-b)/(d-b) + a) inside = !inside
  }
  return inside
}

export async function addressForPin([lat,lon]: Point, signal: AbortSignal) {
  const params = new URLSearchParams({lat:String(lat),lon:String(lon),radius:'0.05',limit:'3'})
  async function json(url:string) {
    const response = await fetch(url,{signal,referrerPolicy:'no-referrer',credentials:'omit'})
    if (!response.ok) throw Error('Address lookup failed')
    return response.json()
  }
  const [local,nearby] = await Promise.allSettled([
    json('/geo/chumphon.json') as Promise<Area[]>,
    json('https://photon.komoot.io/reverse?' + params) as Promise<{features:Feature[]}>
  ])
  const area = local.status === 'fulfilled' && local.value.find(a => a.polygons.some(([outer,...holes]) =>
    contains(outer,lon,lat) && !holes.some(ring => contains(ring,lon,lat))))
  const features = nearby.status === 'fulfilled' ? nearby.value.features || [] : []
  const located = features.map(f => {
    const coords = f.geometry?.coordinates
    const distance = coords ? Math.hypot((coords[0]-lon)*Math.cos(lat*Math.PI/180), coords[1]-lat)*111320 : Infinity
    return {p:f.properties,distance}
  }).filter(f => f.distance <= 50).sort((a,b) => a.distance-b.distance)
  const building = located.find(f => f.p.housenumber && f.distance <= 10)?.p
  const street = building?.street || located.find(f => f.p.street)?.p.street || located.find(f => f.p.osm_key === 'highway')?.p.name
  const region = located[0]?.p
  const parts = area ? ['ต.'+area.subdistrict,'อ.'+area.district,'จ.ชุมพร',area.postcode] :
    [region?.district,region?.city,region?.county,region?.state,region?.postcode]
  const text = [...new Set([building?.housenumber,street,...parts].filter(Boolean))].join(' ')
  return {text,district:area ? area.district : region?.county}
}
