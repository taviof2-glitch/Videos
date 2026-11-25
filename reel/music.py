import numpy as np, wave
import sys
SR=44100; DUR=float(sys.argv[1]); BPM=100; beat=60/BPM
t=np.arange(int(SR*DUR))/SR; out=np.zeros_like(t)
def n2f(n): return 440*2**((n-69)/12)
chords=[[60,64,67,71],[57,60,64,67],[53,57,60,64],[55,59,62,65]]
bar=beat*4
for b in range(int(DUR/bar)+1):
    ch=chords[b%4]; t0=b*bar
    idx=(t>=t0)&(t<t0+bar); tt=t[idx]-t0
    env=np.minimum(tt/0.3,1)*np.exp(-tt*0.35)
    for n in ch:
        f=n2f(n); out[idx]+=0.05*env*(np.sin(2*np.pi*f*tt)+0.3*np.sin(2*np.pi*2*f*tt))
    for k in range(8):  # arpegio
        s0=t0+k*beat/2; n=ch[[0,1,2,3,2,1,2,3][k]]+12
        i2=(t>=s0)&(t<s0+0.4); tt=t[i2]-s0
        out[i2]+=0.06*np.exp(-tt*9)*np.sin(2*np.pi*n2f(n)*tt)
    bass=ch[0]-24
    for k in (0,2.5):
        s0=t0+k*beat; i2=(t>=s0)&(t<s0+0.6); tt=t[i2]-s0
        out[i2]+=0.18*np.exp(-tt*4)*np.sin(2*np.pi*n2f(bass)*tt)
rng=np.random.default_rng(1)
for k in range(int(DUR/beat)+1):
    s0=k*beat
    if k%2==0:
        i2=(t>=s0)&(t<s0+0.25); tt=t[i2]-s0
        out[i2]+=0.35*np.exp(-tt*18)*np.sin(2*np.pi*(50+90*np.exp(-tt*30))*tt)
    else:
        i2=(t>=s0)&(t<s0+0.2); tt=t[i2]-s0
        out[i2]+=0.12*np.exp(-tt*25)*rng.standard_normal(i2.sum())
    for h in (0.5,):
        s1=s0+h*beat; i2=(t>=s1)&(t<s1+0.05); tt=t[i2]-s1
        out[i2]+=0.05*np.exp(-tt*80)*rng.standard_normal(i2.sum())
out[t<0.05]*=t[t<0.05]/0.05
fo=t>DUR-2.5; out[fo]*=(DUR-t[fo])/2.5
out/=np.abs(out).max()*1.15
data=(np.stack([out,out],1)*32767).astype(np.int16)
w=wave.open(''+sys.argv[2]+'','wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(data.tobytes()); w.close()
