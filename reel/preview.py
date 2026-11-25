"""Hoja de contacto: python3 preview.py 01 02 ...  -> out/sheet_<id>.png"""
import sys, os, importlib
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common
for m in ('vids1', 'vids2', 'vids3'):
    try:
        importlib.import_module(m)
    except ModuleNotFoundError as e:
        if e.name != m:
            raise

os.makedirs('out', exist_ok=True)
ids = sys.argv[1:] or sorted(common.VIDEOS)
for vid in ids:
    v = common.VIDEOS[vid]
    fracs = (0.35, 0.95)
    cols = []
    for i, fn in enumerate(v['fns']):
        D = v['nominal'][i]
        for f in fracs:
            cols.append(fn(D * f, D).resize((216, 384)))
    s = Image.new('RGB', (216 * 6, 384 * 2), (255, 255, 255))
    for i, im in enumerate(cols):
        s.paste(im, ((i // 2) * 216, (i % 2) * 384))
    s.save(f'out/sheet_{vid}.png')
    print('ok', vid)
