"""Arma un video completo: python3 build2.py 01 [02 ...]
Lee voz/<id>.mp3, detecta pausas, sincroniza las 6 escenas con los párrafos de la narración,
renderiza, mezcla música + voz y deja out/HouseLite_<id>_<slug>.mp4
"""
import sys, os, re, subprocess, json, importlib
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.chdir(os.path.dirname(os.path.abspath(__file__)))
import common
from make import render
for m in ('vids1', 'vids2', 'vids3'):
    try:
        importlib.import_module(m)
    except ModuleNotFoundError as e:
        if e.name != m:
            raise


def duration(path):
    return float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path]).decode())


def silences(path):
    out = subprocess.run(['ffmpeg', '-hide_banner', '-i', path, '-af', 'silencedetect=noise=-35dB:d=0.25', '-f', 'null', '-'],
                         capture_output=True, text=True).stderr
    st = [float(x) for x in re.findall(r'silence_start: ([\d.]+)', out)]
    en = [float(x) for x in re.findall(r'silence_end: ([\d.]+)', out)]
    return list(zip(st, en))


def bounds_for(vid):
    v = common.VIDEOS[vid]
    mp3 = f'voz/{vid}.mp3'
    total_voice = duration(mp3)
    sil = [(a, b) for a, b in silences(mp3) if a > 0.3 and b < total_voice - 0.1]
    lens = [len(p) for p in v['narr']]
    tot = sum(lens)
    import itertools
    exp = [total_voice * sum(lens[:i]) / tot for i in range(1, 6)]
    best = None
    for comb in itertools.combinations(range(len(sil)), 5):
        pts = [0.0] + [sil[j][0] for j in comb]
        if min(b - a for a, b in zip(pts, pts[1:])) < 2.0:
            continue
        sc = 0.0
        for e, j in zip(exp, comb):
            a, b = sil[j]
            sc += (((a + b) / 2 - e) / 2.0) ** 2 - 6 * (b - a)
        if best is None or sc < best[0]:
            best = (sc, comb)
    starts = []
    for j in best[1]:
        a, b = sil[j]
        starts.append(round(a + min(0.25, (b - a) / 2), 3))
    starts.sort()
    end = round(total_voice + 1.2, 3)
    return [0.0] + starts + [end], total_voice


def build(vid):
    v = common.VIDEOS[vid]
    b, tv = bounds_for(vid)
    name = f"{vid}_{v['slug']}"
    os.makedirs('out', exist_ok=True)
    parts = []
    for i, fn in enumerate(v['fns']):
        D = round(b[i + 1] - b[i], 3)
        nom = v['nominal'][i]
        if 0 < i < 5:
            k = nom / D
            f = (lambda fn, k, D0: (lambda t, D: fn(min(t * k, D0), D0)))(fn, k, nom)
        else:
            f = fn
        render(f'{name}_{i}', f, D)
        parts.append(f'{name}_{i}.mp4')
    total = b[-1]
    open(f'out/{name}_list.txt', 'w').write(''.join(f"file '{p}'\n" for p in parts))
    subprocess.run(['python3', 'music.py', str(total), f'out/{name}_music.wav'], check=True)
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', f'out/{name}_list.txt', '-c', 'copy', f'out/{name}_v.mp4'], check=True)
    final = f'out/HouseLite_{name}.mp4'
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', f'out/{name}_v.mp4', '-i', f'out/{name}_music.wav', '-i', f'voz/{vid}.mp3',
                    '-filter_complex', '[1:a]volume=0.35[m];[2:a]aresample=44100,adelay=150|150,volume=1.7[v];[m][v]amix=inputs=2:duration=first:normalize=0,alimiter=limit=0.9[a]',
                    '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', final], check=True)
    for p in parts + [f'{name}_v.mp4', f'{name}_music.wav', f'{name}_list.txt']:
        try:
            os.remove(f'out/{p}')
        except FileNotFoundError:
            pass
    json.dump({'bounds': b, 'voice': tv}, open(f'out/{name}.json', 'w'))
    print(final, round(total, 2), b, flush=True)


if __name__ == '__main__':
    for vid in sys.argv[1:]:
        build(vid)
