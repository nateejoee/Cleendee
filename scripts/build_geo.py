"""Build the boundary files the site uses to tell which subdistrict/district/province a point is in.

Usage: python3 scripts/build_geo.py <path to GeoThai/boundaries checkout> <path to GeoThai/data checkout> 84 85 86
Writes public/geo/provinces.json (all provinces, rough outlines) and public/geo/<code>.json
(subdistricts of each listed province, DOPA province codes). Data: GeoThai, CC BY 4.0 (see public/geo/NOTICE.txt).
"""
import json, sys, os
from shapely.geometry import shape, mapping

bnd, data, codes = sys.argv[1], sys.argv[2], sys.argv[3:]
out = os.path.join(os.path.dirname(__file__), '..', 'public', 'geo')

def rings(geom, tol, nd):
    g = geom.simplify(tol, preserve_topology=True)
    m = mapping(g)
    polys = m['coordinates'] if m['type'] == 'MultiPolygon' else [m['coordinates']]
    return [[[[round(x, nd), round(y, nd)] for x, y in ring] for ring in poly] for poly in polys]

dist = {d['code']: d for d in json.load(open(os.path.join(data, 'json', 'districts.json')))}
subs = {s['code']: s for s in json.load(open(os.path.join(data, 'json', 'subdistricts.json')))}

prov = []
for f in json.load(open(os.path.join(bnd, 'provinces.geojson')))['features']:
    g = shape(f['geometry']); p = f['properties']
    minx, miny, maxx, maxy = g.bounds
    c = g.representative_point()
    prov.append({'code': p['code'], 'name_th': p['name_th'], 'name_en': p['name_en'],
                 'bbox': [round(minx, 3), round(miny, 3), round(maxx, 3), round(maxy, 3)],
                 'center': [round(c.y, 4), round(c.x, 4)], 'polygons': rings(g, 0.02, 3)})
json.dump(prov, open(os.path.join(out, 'provinces.json'), 'w'), ensure_ascii=False, separators=(',', ':'))

feats = json.load(open(os.path.join(bnd, 'subdistricts.geojson')))['features']
for code in codes:
    rows = []
    for f in feats:
        p = f['properties']
        if p['province_code'] != code: continue
        d = dist[p['district_code']]; s = subs.get(p['code'], {})
        rows.append({'subdistrict': p['name_th'], 'subdistrict_en': p['name_en'],
                     'district': d['name_th'], 'district_en': d['name_en'],
                     'postcode': (s.get('postal_codes') or [''])[0],
                     'polygons': rings(shape(f['geometry']), 0.0012, 5)})
    json.dump(rows, open(os.path.join(out, code + '.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
    print(code, len(rows), 'subdistricts', sum(len(r) for x in rows for poly in x['polygons'] for r in poly), 'points')
