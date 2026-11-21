import { useEffect, useState } from 'react'
import { sb, type District } from './supabase'

// Service areas: provinces and districts from the database, shared by every picker and name lookup.
export type Province = { code: string; name_th: string; name_en: string; active: boolean; dopa_code: string }
export type AreaGroup = { province: Province; districts: District[] }

let districtsP: Promise<District[]> | null = null
let provincesP: Promise<Province[]> | null = null
const listeners = new Set<() => void>()
const fetchAll = <T,>(q: PromiseLike<{ data: unknown; error: unknown }>) => Promise.resolve(q).then(({ data, error }) => { if (error) throw error; return (data as T[]) || [] })
const loadDistricts = () => (districtsP ??= fetchAll<District>(sb.from('districts').select('*').order('id')).catch(() => { districtsP = null; return [] }))
const loadProvinces = () => (provincesP ??= fetchAll<Province>(sb.from('provinces').select('*').order('code')).catch(() => { provincesP = null; return [] }))

// Forget the cached lists and load them again everywhere (after an admin opens or closes an area)
export function reloadAreas() { districtsP = null; provincesP = null; listeners.forEach(f => f()) }

function useCached<T>(load: () => Promise<T[]>): T[] | null {
  const [v, setV] = useState<T[] | null>(null)
  useEffect(() => {
    let alive = true
    const run = () => { load().then(x => { if (alive) setV(x) }) }
    run(); listeners.add(run)
    return () => { alive = false; listeners.delete(run) }
  }, [load])
  return v
}

/** Every district (open or not): use it to show the name for an id. */
export function useDistricts(): District[] { return useCached(loadDistricts) ?? [] }
/** Every province, or null while loading. */
export function useProvinces(): Province[] | null { return useCached(loadProvinces) }

/** Open districts of open provinces, grouped by province (for pickers). */
export function useServiceAreas() {
  const districts = useDistricts(); const provinces = useProvinces()
  const groups: AreaGroup[] = (provinces || []).filter(p => p.active)
    .map(p => ({ province: p, districts: districts.filter(d => d.active && d.province_code === p.code) }))
    .filter(g => g.districts.length > 0)
  return { districts, provinces, groups, open: groups.flatMap(g => g.districts) }
}

export const provName = (p: Province, lang: 'th' | 'en') => (lang === 'th' ? p.name_th : p.name_en)

/** Names of the open provinces joined for a sentence, e.g. 'จ.ชุมพร และ จ.ระนอง' / 'Chumphon and Ranong'. */
export function openProvinceNames(provinces: Province[] | null, lang: 'th' | 'en') {
  const names = (provinces || []).filter(p => p.active).map(p => (lang === 'th' ? 'จ.' + p.name_th : p.name_en))
  if (names.length < 2) return names[0] ?? ''
  return names.slice(0, -1).join(', ') + (lang === 'th' ? ' และ ' : ' and ') + names[names.length - 1]
}
