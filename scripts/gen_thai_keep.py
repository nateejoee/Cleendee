# สร้างรายการคำไทยที่ห้ามตัดบรรทัดกลางคำ -> src/lib/thaiKeepWords.ts
# วิธี: ตัดคำข้อความไทยทั้งหมดในโค้ด (+ ไฟล์ข้อความจากฐานข้อมูลถ้ามี) ด้วย pythainlp (พจนานุกรม ยึดคำประสมเป็นคำเดียว)
#       แล้วเก็บเฉพาะคำที่ตัวตัดคำของเบราว์เซอร์ (ICU / Intl.Segmenter) แยกเป็นหลายท่อน = จุดที่เบราว์เซอร์อาจตัดบรรทัดกลางคำ
# ใช้: pip install pythainlp && python3 scripts/gen_thai_keep.py [ไฟล์ข้อความเพิ่มเติม.txt]
import re, glob, json, sys, subprocess
from pythainlp.tokenize import word_tokenize
txt = ''.join(open(p).read() + '\n' for p in sys.argv[1:])
for f in glob.glob('src/**/*.ts*', recursive=True) + ['index.html']:
    if f.endswith('thaiKeepWords.ts'): continue
    s = open(f).read(); s = re.sub(r'//[^\n]*', '', s); s = re.sub(r'/\*.*?\*/', '', s, flags=re.S); txt += '\n' + s
toks = set()
for run in re.findall(r'[฀-๿]+', txt):
    for w in word_tokenize(run.replace('⁠', ''), engine='newmm', keep_whitespace=False):
        if len(w) >= 3 and re.fullmatch(r'[฀-๿]+', w): toks.add(w)
js = 'const t=JSON.parse(require("fs").readFileSync(0,"utf8"));const s=new Intl.Segmenter("th",{granularity:"word"});' \
     'process.stdout.write(JSON.stringify(t.filter(w=>[...s.segment(w)].filter(x=>x.segment.trim()).length>1)))'
keep = json.loads(subprocess.run(['node', '-e', js], input=json.dumps(sorted(toks)), capture_output=True, text=True, check=True).stdout)
open('src/lib/thaiKeepWords.ts', 'w').write('// สร้างอัตโนมัติจาก scripts/gen_thai_keep.py — อย่าแก้มือ (รันสคริปต์ใหม่เมื่อเพิ่มข้อความ)\nexport const THAI_KEEP_WORDS = ' + json.dumps(keep, ensure_ascii=False) + '\n')
print(len(keep), 'words')
