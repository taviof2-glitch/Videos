"""Genera una pista de música suave (sin derechos) para los videos.
Uso: python3 scripts/musica.py public/audio/musica.wav 36
"""
import math, random, struct, sys, wave

out = sys.argv[1]
secs = float(sys.argv[2]) if len(sys.argv) > 2 else 36
SR = 44100
BPM = 104
beat = 60 / BPM
n = int(SR * secs)
buf = [0.0] * n
random.seed(7)

def note(f, t0, dur, amp, kind="pluck"):
    s0 = int(t0 * SR)
    for i in range(int(dur * SR)):
        j = s0 + i
        if j >= n:
            break
        t = i / SR
        if kind == "pluck":
            env = math.exp(-t * 6) * min(1, t * 200)
            v = math.sin(2 * math.pi * f * t) + 0.3 * math.sin(4 * math.pi * f * t)
        elif kind == "pad":
            env = min(1, t / 0.4) * min(1, (dur - t) / 0.4)
            v = math.sin(2 * math.pi * f * t) + 0.5 * math.sin(2 * math.pi * f * 1.003 * t)
        elif kind == "kick":
            env = math.exp(-t * 18)
            v = math.sin(2 * math.pi * (50 + 90 * math.exp(-t * 30)) * t)
        elif kind == "hat":
            env = math.exp(-t * 60)
            v = random.uniform(-1, 1)
        buf[j] += v * env * amp

# I - V - vi - IV en Do mayor
chords = [[261.63, 329.63, 392.0], [196.0, 246.94, 293.66], [220.0, 261.63, 329.63], [174.61, 220.0, 261.63]]
bar = beat * 4
t = 0.0
k = 0
while t < secs:
    ch = chords[k % 4]
    for f in ch:
        note(f / 2, t, bar, 0.05, "pad")
    for b in range(8):
        f = ch[[0, 1, 2, 1, 0, 2, 1, 2][b]] * 2
        note(f, t + b * beat / 2, beat, 0.07)
    for b in range(4):
        note(0, t + b * beat, 0.3, 0.35, "kick")
        note(0, t + b * beat + beat / 2, 0.05, 0.04, "hat")
    t += bar
    k += 1

fade = int(SR * 1.5)
for i in range(fade):
    buf[n - 1 - i] *= i / fade
peak = max(abs(x) for x in buf) or 1
with wave.open(out, "w") as w:
    w.setnchannels(1)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(b"".join(struct.pack("<h", int(x / peak * 0.8 * 32767)) for x in buf))
