import sys, os, subprocess, json
import v2
from make import render
name, voice = sys.argv[1], sys.argv[2]
bounds = json.loads(sys.argv[3])  # scene start times (first=0), plus end
fns = v2.VIDEOS[name]; nom = v2.NOMINAL[name]
os.makedirs('out', exist_ok=True)
parts = []
for i, fn in enumerate(fns):
    D = round(bounds[i+1] - bounds[i], 3)
    scale = 0 < i < len(fns) - 1
    k = nom[i] / D if scale else 1.0
    f = (lambda fn, k, D0: (lambda t, D: fn(min(t * k, D0) if k != 1.0 else t, D0 if k != 1.0 else D)))(fn, k, nom[i])
    render(f'{name}_{i}', f, D)
    parts.append(f'{name}_{i}.mp4')
total = bounds[-1]
open(f'out/{name}_list.txt', 'w').write(''.join(f"file '{p}'\n" for p in parts))
subprocess.run(['python3', 'music.py', str(total), f'out/{name}_music.wav'], check=True)
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', f'out/{name}_list.txt', '-c', 'copy', f'out/{name}_v.mp4'], check=True)
final = f'out/HouseLite_{name}.mp4'
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', f'out/{name}_v.mp4', '-i', f'out/{name}_music.wav', '-i', voice,
                '-filter_complex', '[1:a]volume=0.35[m];[2:a]aresample=44100,volume=1.7[v];[m][v]amix=inputs=2:duration=first:normalize=0,alimiter=limit=0.9[a]',
                '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', final], check=True)
print(final, total)
