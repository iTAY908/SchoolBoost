"""Original soundtrack synthesised from scratch (no samples, no licensing issues).
usage: python3 audio.py events.json out.wav
Score (80 bpm, A minor -> C major):
  0-3    soft piano arpeggio
  3-6    + low drone and soft pulses (wall contact thud at 3.0)
  6-10.5 strings build a measured crescendo
  10.5   climax on the tear, ~0.4s breath, warm C-major chord at 10.95
  12-15  calm piano + faint leaves
SFX: footsteps from the animation's contact events, effort breaths, rubber creak, rip, deep final breath.
"""
import json, sys, wave
import numpy as np

SR = 48000
DUR = 15.0
N = int(SR * DUR)
rng = np.random.default_rng(7)
ev = json.load(open(sys.argv[1]))
OUT = sys.argv[2]
BURST = ev['burst']

music = np.zeros((N, 2))
sfx = np.zeros((N, 2))


def note_hz(n):
    names = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
    pc = names[n[0]] + (1 if '#' in n else -1 if 'b' in n[1:] else 0)
    octv = int(n[-1])
    return 440.0 * 2 ** ((pc + 12 * (octv + 1) - 69) / 12)


def place(buf, t0, sig, pan=0.0, gain=1.0):
    i0 = int(t0 * SR)
    if i0 >= N:
        return
    if i0 < 0:
        sig = sig[-i0:]
        i0 = 0
    sig = sig[: N - i0]
    l = np.cos((pan + 1) * np.pi / 4)
    r = np.sin((pan + 1) * np.pi / 4)
    buf[i0:i0 + len(sig), 0] += sig * gain * l
    buf[i0:i0 + len(sig), 1] += sig * gain * r


def fft_filter(x, lo=None, hi=None):
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    m = np.ones_like(f)
    if lo:
        m *= 1 / (1 + (lo / np.maximum(f, 1)) ** 4)
    if hi:
        m *= 1 / (1 + (f / hi) ** 4)
    return np.fft.irfft(X * m, len(x))


def piano(freq, dur, vel=0.6):
    n = int((dur + 1.2) * SR)
    t = np.arange(n) / SR
    y = np.zeros(n)
    B = 0.00035
    for h in range(1, 12):
        fh = freq * h * np.sqrt(1 + B * h * h)
        if fh > 16000:
            break
        amp = (1 / h ** 1.25) * (0.6 + 0.4 * vel) ** (h * 0.3)
        dec = 0.9 + 0.55 * h + freq / 600
        for det in (-0.6, 0.6):
            y += amp * np.exp(-t * dec) * np.sin(2 * np.pi * fh * (1 + det / 1730) * t + h)
    y *= np.minimum(1, t / 0.004)
    rel = np.clip((dur + 0.25 - t) / 0.25, 0, 1) * 0.85 + 0.15 * np.exp(-np.maximum(0, t - dur) * 3)
    y *= np.where(t < dur, 1, rel)
    ham = rng.standard_normal(int(0.012 * SR)) * np.exp(-np.arange(int(0.012 * SR)) / (0.002 * SR)) * 0.05
    y[:len(ham)] += ham
    return y * vel * 0.18


def strings(freq, dur, att=0.8, rel=1.0, bright=2400):
    n = int((dur + rel) * SR)
    t = np.arange(n) / SR
    y = np.zeros(n)
    for v in range(6):
        det = (v - 2.5) * 2.2
        vib = 1 + 0.003 * np.sin(2 * np.pi * (5.2 + v * 0.13) * t + v)
        ph = 2 * np.pi * np.cumsum(freq * (1 + det / 1730) * vib) / SR
        for h in range(1, 16):
            if freq * h > bright * 2.5:
                break
            y += np.sin(h * ph + v * h) / h * (1 / (1 + (freq * h / bright) ** 2))
    env = np.minimum(1, t / att) ** 1.5 * np.where(t < dur, 1, np.clip(1 - (t - dur) / rel, 0, 1))
    return y * env * 0.03


def pad(freq, dur, att=0.6, rel=2.0):
    n = int((dur + rel) * SR)
    t = np.arange(n) / SR
    y = sum(np.sin(2 * np.pi * freq * k * t * (1 + 0.0007 * k)) / k ** 1.6 for k in (1, 2, 3, 4))
    y *= (1 + 0.15 * np.sin(2 * np.pi * 0.7 * t))
    env = np.minimum(1, t / att) * np.where(t < dur, 1, np.clip(1 - (t - dur) / rel, 0, 1))
    return y * env * 0.05


def pulse(t0, gain=1.0, f0=62):
    n = int(0.7 * SR)
    t = np.arange(n) / SR
    f = f0 * (1 + 0.8 * np.exp(-t * 30))
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 6.5) * np.minimum(1, t / 0.006)
    place(music, t0, y * 0.33, 0, gain)


# ---------------------------------------------------------------- music
beat = 0.75
# 0-3 : gentle piano (Am add9 -> Fmaj7)
arp = [('A2', 0.0, 2.8, 0.45), ('E4', 0.0, 0.7, 0.4), ('A4', 0.375, 0.7, 0.33), ('B4', 0.75, 0.7, 0.36), ('C5', 1.125, 0.9, 0.4),
       ('F2', 1.5, 1.6, 0.42), ('A4', 1.5, 0.7, 0.36), ('C5', 1.875, 0.7, 0.33), ('E5', 2.25, 0.8, 0.38), ('C5', 2.625, 0.5, 0.3)]
# 3-10.5 : piano keeps a heartbeat figure under the build
prog = [(3.0, ['A2', 'E3'], ['C5', 'E5']), (4.5, ['F2', 'C3'], ['A4', 'C5']), (6.0, ['C3', 'G3'], ['G4', 'E5']), (7.5, ['G2', 'D3'], ['B4', 'D5']),
        (9.0, ['A2', 'E3'], ['C5', 'E5']), (9.75, ['G2', 'D3'], ['B4', 'D5'])]
for n, t0, d, v in arp:
    place(music, t0, piano(note_hz(n), d, v), pan=-0.15 if n[-1] in '23' else 0.15)
for t0, low, hi in prog:
    for n in low:
        place(music, t0, piano(note_hz(n), 1.4, 0.38), -0.1)
    for k, n in enumerate(hi):
        place(music, t0 + 0.375 * (k + 1), piano(note_hz(n), 0.6, 0.3), 0.2)

# low drone from the wall contact
drone_t = 3.0
dn = int((BURST - drone_t) * SR)
td = np.arange(dn) / SR
drone = (np.sin(2 * np.pi * 55 * td) + 0.4 * np.sin(2 * np.pi * 82.4 * td)) * np.minimum(1, td / 2.5) * (0.5 + 0.5 * td / td[-1])
place(music, drone_t, drone * 0.09)
# soft pulses, doubling in the last bar before the tear
pt = 3.0
while pt < BURST - 0.05:
    g = 0.6 + 0.6 * (pt - 3) / (BURST - 3)
    pulse(pt, g)
    pt += beat if pt < 9.0 else beat / 2
place(music, 3.0, np.sin(2 * np.pi * 48 * np.arange(int(0.9 * SR)) / SR) * np.exp(-np.arange(int(0.9 * SR)) / SR * 5) * 0.35)

# strings: measured crescendo 6 -> 10.5 (consonant, rising)
sc = [(6.0, 1.6, ['A3', 'C4', 'E4']), (7.5, 1.6, ['F3', 'A3', 'C4']), (9.0, 0.8, ['G3', 'C4', 'D4']), (9.75, 0.8, ['G3', 'B3', 'D4'])]
for t0, d, chord in sc:
    g = 0.5 + 0.9 * (t0 - 6) / 4.5
    for n in chord:
        place(music, t0, strings(note_hz(n), d, att=0.5, rel=0.4), (hash(n) % 7 - 3) / 8, g)
mel = [(6.0, 'E5', 1.4), (7.5, 'F5', 1.4), (9.0, 'G5', 0.7), (9.75, 'A5', 0.8)]
for t0, n, d in mel:
    place(music, t0, strings(note_hz(n), d, att=0.35, rel=0.3, bright=3800), 0.25, 0.5 + 0.9 * (t0 - 6) / 4.5)
# swell into the climax (noise riser, gentle)
rn = int(1.6 * SR)
tr_ = np.arange(rn) / SR
riser = fft_filter(rng.standard_normal(rn), 800, 6000) * (tr_ / tr_[-1]) ** 3
place(music, BURST - 1.6, riser * 0.05)
# climax hit exactly on the tear, then silence
for n in ['A2', 'E3', 'A3', 'E4', 'A4']:
    place(music, BURST, piano(note_hz(n), 0.12, 0.7) * 0.8)
place(music, BURST, np.sin(2 * np.pi * 40 * np.arange(int(0.5 * SR)) / SR) * np.exp(-np.arange(int(0.5 * SR)) / SR * 7) * 0.45)
# hard duck everything before the pause
gate = np.ones(N)
i0, i1 = int((BURST + 0.06) * SR), int((BURST + 0.12) * SR)
gate[i0:i1] = np.linspace(1, 0, i1 - i0)
gate[i1:] = 0
music *= gate[:, None]

# warm hopeful chord after the pause (C add9, open voicing)
HOPE = BURST + 0.45
for n, v in [('C2', 0.5), ('G2', 0.4), ('C3', 0.42), ('E4', 0.4), ('G4', 0.36), ('D5', 0.34)]:
    place(music, HOPE, piano(note_hz(n), 2.6, v), 0.0)
for n in ['C3', 'G3', 'E4', 'G4', 'C5']:
    place(music, HOPE, strings(note_hz(n), 2.2, att=0.25, rel=1.6, bright=3000), (hash(n) % 5 - 2) / 6, 0.9)
    place(music, HOPE, pad(note_hz(n), 3.2, att=0.3, rel=1.4), 0, 0.8)
# 12-15 : calm piano, settles home
tail = [('E5', 12.15, 0.7, 0.3), ('D5', 12.6, 0.7, 0.28), ('C5', 13.05, 1.0, 0.3), ('F2', 13.05, 1.4, 0.3), ('A4', 13.5, 0.5, 0.26),
        ('C5', 13.8, 0.6, 0.26), ('G4', 14.1, 1.2, 0.27), ('C3', 14.1, 1.3, 0.3), ('E4', 14.1, 1.2, 0.22)]
for n, t0, d, v in tail:
    place(music, t0, piano(note_hz(n), d, v), 0.1)

# ---------------------------------------------------------------- SFX
def noise_burst(dur, lo, hi, decay):
    n = int(dur * SR)
    t = np.arange(n) / SR
    return fft_filter(rng.standard_normal(n), lo, hi) * np.exp(-t * decay) * np.minimum(1, t / 0.003)


for e in ev['events']:
    ph = e['phase']
    pan = 0.12 if e['leg'] else -0.12
    if ph == 'run':
        s = noise_burst(0.09, 80, 1800, 45) * 0.5 + np.sin(2 * np.pi * 85 * np.arange(int(0.09 * SR)) / SR) * np.exp(-np.arange(int(0.09 * SR)) / SR * 40) * 0.35
        place(sfx, e['t'], s, pan, 0.45)
    elif ph in ('push', 'burst'):
        s = noise_burst(0.22, 120, 2500, 14) * 0.6 + np.sin(2 * np.pi * 70 * np.arange(int(0.22 * SR)) / SR) * np.exp(-np.arange(int(0.22 * SR)) / SR * 22) * 0.4
        place(sfx, e['t'], s, pan, 0.5)
    else:  # outside, on soft grass
        s = noise_burst(0.14, 900, 6500, 24)
        place(sfx, e['t'], s, pan, 0.28 if e['t'] < 13.5 else 0.18)


def breath(dur, gain, inhale=False, lo=500, hi=2600):
    n = int(dur * SR)
    t = np.arange(n) / SR
    env = np.sin(np.pi * t / dur) ** (0.7 if inhale else 1.6)
    if not inhale:
        env *= np.exp(-t * 1.5)
    return fft_filter(rng.standard_normal(n), lo, hi) * env * gain


# effort exhales while pushing (no shouting), a gasp at the tear, deep breath at the end
for bt in [3.35, 4.7, 6.0, 7.35, 8.5, 8.95, 9.75, 10.3]:
    place(sfx, bt, breath(0.42, 0.11), 0.0)
place(sfx, BURST + 0.2, breath(0.35, 0.09, inhale=True, lo=700, hi=3500))
place(sfx, 12.95, breath(0.75, 0.10, inhale=True, lo=600, hi=3200))
place(sfx, 13.9, breath(1.1, 0.10, lo=350, hi=2200))

# rubber: impact thump, creaking stretch, squeaks, crack ping, rip, elastic snap & whoosh
place(sfx, 3.0, noise_burst(0.35, 60, 600, 9) * 0.5 + np.sin(2 * np.pi * np.cumsum(90 * np.exp(-np.arange(int(0.35 * SR)) / SR * 4)) / SR) * np.exp(-np.arange(int(0.35 * SR)) / SR * 8) * 0.4, 0, 0.55)
cs, ce = 3.05, ev['crack']
cn = int((ce - cs) * SR)
tc = np.arange(cn) / SR
f_c = 150 + 260 * (tc / tc[-1]) ** 1.2
creak_src = np.sign(np.sin(2 * np.pi * np.cumsum(f_c * (1 + 0.04 * np.sin(2 * np.pi * 9 * tc))) / SR)) * 0.5
creak = fft_filter(creak_src, 150, 1500) * (0.35 + 0.65 * (0.5 + 0.5 * np.sin(2 * np.pi * tc / 1.75 - 1))) * np.minimum(1, tc / 0.6)
creak += fft_filter(rng.standard_normal(cn), 200, 900) * 0.25
place(sfx, cs, creak * 0.05)
for sq in [4.1, 5.9, 7.7, 9.4]:
    n = int(0.28 * SR)
    t = np.arange(n) / SR
    f = 620 + 260 * t / t[-1]
    place(sfx, sq, np.sin(2 * np.pi * np.cumsum(f * (1 + 0.02 * np.sin(2 * np.pi * 23 * t))) / SR) * np.sin(np.pi * t / t[-1]) ** 2 * 0.03, 0.1)
n = int(0.3 * SR)
t = np.arange(n) / SR
place(sfx, ce, np.sin(2 * np.pi * 1450 * t) * np.exp(-t * 12) * 0.05 + noise_burst(0.3, 2000, 8000, 20) * 0.08)
rip_n = int(0.45 * SR)
rt = np.arange(rip_n) / SR
crackle = (rng.random(rip_n) < 0.02 * (1 - rt / rt[-1])) * rng.standard_normal(rip_n) * 2
rip = fft_filter(rng.standard_normal(rip_n) + crackle, 900, 7000) * np.exp(-rt * 6) * np.minimum(1, rt / 0.005)
place(sfx, BURST - 0.01, rip * 0.4)
sn = int(0.6 * SR)
st = np.arange(sn) / SR
snap = np.sin(2 * np.pi * np.cumsum(140 * np.exp(-st * 3) + 45) / SR) * np.exp(-st * 6) * (1 + 0.3 * np.sin(2 * np.pi * 14 * st))
place(sfx, BURST + 0.02, snap * 0.35)
wn = int(0.9 * SR)
wt = np.arange(wn) / SR
whoosh = fft_filter(rng.standard_normal(wn), 300, 3000) * np.sin(np.pi * wt / wt[-1]) ** 2
place(sfx, BURST + 0.05, whoosh * 0.09, -0.3)
place(sfx, BURST + 0.05, whoosh[::-1] * 0.07, 0.3)

# leaves rustle, outside only
ls = BURST + 0.5
ln = N - int(ls * SR)
lt = np.arange(ln) / SR
for ch in (0, 1):
    leaf = fft_filter(rng.standard_normal(ln), 2200, 9000)
    leaf *= (0.55 + 0.45 * np.sin(2 * np.pi * 0.33 * lt + ch * 1.7)) * (0.7 + 0.3 * np.sin(2 * np.pi * 1.9 * lt + ch))
    leaf *= np.minimum(1, lt / 1.2)
    sfx[int(ls * SR):, ch] += leaf * 0.012


# ---------------------------------------------------------------- reverb & master
def reverb(x, sec=2.2, wet=0.28):
    n = int(sec * SR)
    t = np.arange(n) / SR
    out = np.zeros_like(x)
    for ch in (0, 1):
        ir = rng.standard_normal(n) * np.exp(-t * 3.0 / sec * 2.3)
        ir = fft_filter(ir, 120, 7000)
        ir /= np.sqrt(np.sum(ir ** 2))
        L = len(x) + n
        y = np.fft.irfft(np.fft.rfft(x[:, ch], L) * np.fft.rfft(ir, L), L)[:len(x)]
        out[:, ch] = x[:, ch] + wet * y
    return out


mix = reverb(music, 2.4, 0.32) + reverb(sfx, 0.9, 0.12)
t_all = np.arange(N) / SR
mix *= np.minimum(1, t_all / 0.05)[:, None] * np.minimum(1, (DUR - t_all) / 0.6)[:, None]
mix = np.tanh(mix / np.max(np.abs(mix)) * 1.15) / np.tanh(1.15) * 0.89
pcm = (mix * 32767).astype(np.int16)
with wave.open(OUT, 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print('wrote', OUT, f'{N / SR:.2f}s')
