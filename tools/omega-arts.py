# YGO Omega の絵違いの一覧（data/omega-arts.json）を作り直す：python tools/omega-arts.py "G:/YGO Omega"（または db ファイルのパス）
#   Omega のカードデータ（YGO Omega_Data/Files/Bundles/db ・中身は SQLite）の datas.alias から
#   「基本のパスコード → 絵違いのパスコード」を抜き出す。読むだけで Omega のファイルは変えない
#   ・OCG/TCG のカードだけ（ラッシュ・アニメ版などの 1億以上の番号は除く）
#   ・同じ種類のカードだけ。トークンは除く（別のトークンが別名でまとめられているため）
import sqlite3, json, sys, os, datetime
root = sys.argv[1] if len(sys.argv) > 1 else '.'
db = root if os.path.isfile(root) else os.path.join(root, 'YGO Omega_Data', 'Files', 'Bundles', 'db')
c = sqlite3.connect('file:' + db.replace('\\', '/') + '?mode=ro&immutable=1', uri=True)
arts = {}
for i, a in c.execute("select d.id, d.alias from datas d join datas b on b.id = d.alias where d.alias != 0 and d.type = b.type and (b.type & 16384) = 0 order by d.alias, d.id"):
    if i < 100000000 and a < 100000000:
        arts.setdefault(str(a), []).append(i)
out = os.path.join(os.path.dirname(__file__), '..', 'data', 'omega-arts.json')
json.dump({'app': 'untapへ転送', 'kind': 'YGO Omega の絵違い（基本のパスコード → 絵違いのパスコード）',
           'saved': datetime.datetime.now().isoformat(timespec='seconds'), 'arts': arts},
          open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=0, separators=(',', ':'))
print(len(arts), '種類', sum(map(len, arts.values())), '枚の絵違い →', out)
