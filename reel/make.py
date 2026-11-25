import math, random, subprocess, sys, os
from functools import lru_cache
from PIL import Image, ImageDraw, ImageFont

W, H, FPS = 1080, 1920, 30
FONT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'fonts', 'Montserrat[wght].ttf')

BG = (244, 237, 228)
INK = (43, 33, 24)
ACC = (224, 122, 47)
WOOD = (205, 154, 98)
WOOD_D = (160, 112, 62)
WOOD_L = (224, 182, 130)
FIN = (52, 62, 68)        # pintura gris pizarra
FIN_D = (34, 41, 46)
BLUE = (52, 110, 190)
GREEN = (37, 170, 90)


@lru_cache(None)
def font(size, weight='Bold'):
    f = ImageFont.truetype(FONT, size)
    f.set_variation_by_name(weight)
    return f


def clamp(x, a=0.0, b=1.0):
    return max(a, min(b, x))


def seg(t, a, b):
    return clamp((t - a) / (b - a)) if b > a else float(t >= a)


def ease(x):
    x = clamp(x)
    return 1 - (1 - x) ** 3


def ease_io(x):
    x = clamp(x)
    return 3 * x * x - 2 * x * x * x


def back(x):
    x = clamp(x)
    if x <= 0:
        return 0.0
    c1 = 1.70158; c3 = c1 + 1
    return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2


def mix(c1, c2, k):
    return tuple(int(a + (b - a) * k) for a, b in zip(c1, c2))


def text_c(d, cx, y, s, size, weight='Bold', fill=INK, alpha=1.0, scale=1.0):
    if alpha <= 0:
        return
    sz = max(8, int(size * scale))
    f = font(sz, weight)
    bb = d.textbbox((0, 0), s, font=f)
    w = bb[2] - bb[0]
    col = fill if alpha >= 1 else mix(BG, fill, alpha)
    d.text((cx - w / 2 - bb[0], y - sz / 2), s, font=f, fill=col)


def board(d, x0, y0, x1, y1, col=WOOD, seed=1, grain=True, edge=None):
    x0, x1 = sorted((x0, x1)); y0, y1 = sorted((y0, y1))
    dark = mix(col, (0, 0, 0), 0.22)
    d.rectangle([x0, y0, x1, y1], fill=col, outline=dark, width=3)
    if grain and (x1 - x0) > 20 and (y1 - y0) > 20:
        rnd = random.Random(seed)
        gc = mix(col, (0, 0, 0), 0.10)
        horiz = (x1 - x0) >= (y1 - y0)
        n = 4 if horiz else 3
        for i in range(n):
            if horiz:
                yy = y0 + (y1 - y0) * (i + 1) / (n + 1) + rnd.uniform(-6, 6)
                pts = [(x, yy + 4 * math.sin(x / 60 + i * 2 + seed)) for x in range(int(x0 + 6), int(x1 - 6), 12)]
            else:
                xx = x0 + (x1 - x0) * (i + 1) / (n + 1) + rnd.uniform(-4, 4)
                pts = [(xx + 3 * math.sin(y / 50 + i * 2 + seed), y) for y in range(int(y0 + 6), int(y1 - 6), 12)]
            if len(pts) > 1:
                d.line(pts, fill=gc, width=2)


def header(d, t, n, title):
    a = ease(seg(t, 0, 0.35))
    pw, ph = 230, 70
    y = 250 - 40 * (1 - a)
    d.rounded_rectangle([W / 2 - pw / 2, y - ph / 2, W / 2 + pw / 2, y + ph / 2], 35, fill=mix(BG, ACC, a))
    text_c(d, W / 2, y - 2, f'PASO {n}', 38, 'ExtraBold', fill=(255, 255, 255), alpha=a)
    b = ease(seg(t, 0.12, 0.5))
    text_c(d, W / 2, 380 - 30 * (1 - b), title, 84, 'Black', alpha=b)


def caption(d, t, lines, start=0.4):
    a = ease(seg(t, start, start + 0.4))
    if a <= 0:
        return
    f = font(48, 'Bold')
    widths = [d.textbbox((0, 0), l, font=f)[2] for l in lines]
    bw = max(widths) + 80
    bh = 70 * len(lines) + 40
    y0 = 1430 + 30 * (1 - a)
    col = mix(BG, INK, a)
    d.rounded_rectangle([W / 2 - bw / 2, y0, W / 2 + bw / 2, y0 + bh], 28, fill=col)
    for i, l in enumerate(lines):
        text_c(d, W / 2, y0 + 20 + 35 + 70 * i, l, 48, 'Bold', fill=(255, 255, 255) if a > 0.6 else col)


def progress_dots(d, n):
    for i in range(6):
        x = W / 2 + (i - 2.5) * 44
        r = 11 if i + 1 == n else 8
        d.ellipse([x - r, 1830 - r, x + r, 1830 + r], fill=ACC if i + 1 <= n else (214, 203, 190))


# ---------- mueble ----------
CX, CW, CH = W / 2, 820, 270    # centro, ancho, alto


def cabinet_parts(cx, cy, w=CW, h=CH):
    x0, x1 = cx - w / 2, cx + w / 2
    y0, y1 = cy - h / 2, cy + h / 2
    t = 24
    third = (w - 2 * t) / 3
    return {
        'bottom': (x0, y1 - t, x1, y1),
        'left': (x0, y0 + t, x0 + t, y1 - t),
        'right': (x1 - t, y0 + t, x1, y1 - t),
        'top': (x0 - 14, y0, x1 + 14, y0 + t),
        'div1': (x0 + t + third - t / 2, y0 + t, x0 + t + third + t / 2, y1 - t),
        'div2': (x0 + t + 2 * third - t / 2, y0 + t, x0 + t + 2 * third + t / 2, y1 - t),
        'shelf': (x0 + t + third + t / 2, (y0 + y1) / 2 - t / 2, x0 + t + 2 * third - t / 2, (y0 + y1) / 2 + t / 2),
        'back': (x0 + t, y0 + t, x1 - t, y1 - t),
        'doorL': (x0 + t + 4, y0 + t + 4, x0 + t + third - t / 2 - 4, y1 - t - 4),
        'doorR': (x0 + t + 2 * third + t / 2 + 4, y0 + t + 4, x1 - t - 4, y1 - t - 4),
    }


ORDER = ['back', 'bottom', 'left', 'right', 'top', 'div1', 'div2', 'shelf', 'doorL', 'doorR']


def draw_cabinet(d, cx, cy, show=None, offsets=None, paint=None, w=CW, h=CH, legs=True):
    """paint: x-position up to which the piece is painted (None = raw wood, inf = painted)."""
    parts = cabinet_parts(cx, cy, w, h)
    show = show if show is not None else {k: 1 for k in ORDER}
    offsets = offsets or {}
    if legs and show.get('bottom', 0) >= 1:
        for lx in (cx - w / 2 + 50, cx + w / 2 - 70):
            d.rectangle([lx, cy + h / 2, lx + 20, cy + h / 2 + 40], fill=INK)
    for i, k in enumerate(ORDER):
        if show.get(k, 0) <= 0:
            continue
        x0, y0, x1, y1 = parts[k]
        dx, dy = offsets.get(k, (0, 0))
        x0, x1, y0, y1 = x0 + dx, x1 + dx, y0 + dy, y1 + dy
        if k == 'back':
            base, fin = mix(WOOD_D, (0, 0, 0), 0.15), (120, 82, 48)
            board(d, x0, y0, x1, y1, col=base, seed=i, grain=False)
            continue
        wood = WOOD_L if k in ('doorL', 'doorR') else WOOD
        finc = FIN if k != 'top' else (120, 80, 46)
        board(d, x0, y0, x1, y1, col=wood, seed=i + 3)
        if paint is not None and paint > x0:
            px = min(x1, paint)
            board(d, x0, y0, px, y1, col=finc, seed=i + 3, grain=(k == 'top'))
        if k in ('doorL', 'doorR'):
            hx = x1 - 26 if k == 'doorL' else x0 + 18
            d.rounded_rectangle([hx, (y0 + y1) / 2 - 40, hx + 8, (y0 + y1) / 2 + 40], 4, fill=(200, 170, 110) if paint and paint > hx else INK)


# ---------- escenas ----------
def s_hook(t, D):
    img = Image.new('RGB', (W, H), BG); d = ImageDraw.Draw(img)
    a = back(seg(t, 0.0, 0.5))
    text_c(d, W / 2, 330, '¿CÓMO SE HACE', 92, 'Black', scale=a, alpha=clamp(a))
    b = back(seg(t, 0.25, 0.75))
    text_c(d, W / 2, 440, 'UN MUEBLE', 120, 'Black', fill=ACC, scale=b, alpha=clamp(b))
    text_c(d, W / 2, 560, 'DE TV?', 120, 'Black', fill=ACC, scale=b, alpha=clamp(b))
    # sala con TV
    c = ease(seg(t, 0.5, 1.2))
    cy = 1180 + 300 * (1 - c)
    tv = ease(seg(t, 0.9, 1.5))
    if tv > 0:
        tw, th = 640 * tv, 360 * tv
        d.rounded_rectangle([W / 2 - tw / 2 - 12, 880 - th / 2 - 12, W / 2 + tw / 2 + 12, 880 + th / 2 + 12], 14, fill=INK)
        glow = mix((40, 60, 90), (90, 150, 210), 0.5 + 0.5 * math.sin(t * 3))
        d.rectangle([W / 2 - tw / 2, 880 - th / 2, W / 2 + tw / 2, 880 + th / 2], fill=glow)
    if c > 0:
        draw_cabinet(d, W / 2, cy, paint=10_000)
    e = ease(seg(t, 1.6, 2.1))
    text_c(d, W / 2, 1480, 'Te lo explico en 30 segundos', 52, 'SemiBold', alpha=e)
    return img


def s_measure(t, D):
    img = Image.new('RGB', (W, H), BG); d = ImageDraw.Draw(img)
    header(d, t, 1, 'MEDIR Y DISEÑAR')
    # pared
    d.rectangle([90, 600, 990, 1300], fill=(232, 222, 208))
    d.rectangle([90, 1300, 990, 1340], fill=(190, 170, 145))
    # cinta horizontal
    k = ease_io(seg(t, 0.4, 1.4))
    x0, y = 140, 1240
    x1 = x0 + 800 * k
    if k > 0:
        d.rounded_rectangle([x0 - 50, y - 40, x0 + 10, y + 40], 12, fill=(240, 196, 40), outline=INK, width=3)
        d.rectangle([x0, y - 16, x1, y + 16], fill=(250, 214, 60), outline=(180, 140, 20), width=2)
        for i in range(0, int(x1 - x0), 20):
            hgt = 12 if i % 100 else 22
            d.line([x0 + i, y - 16, x0 + i, y - 16 + hgt], fill=INK, width=2)
    la = back(seg(t, 1.3, 1.7))
    text_c(d, W / 2, 1180, '1.80 m', 70, 'Black', fill=ACC, scale=la, alpha=clamp(la))
    # cinta vertical
    kv = ease_io(seg(t, 1.6, 2.3))
    if kv > 0:
        xv = 930
        yv1 = 1300 - 280 * kv
        d.rectangle([xv - 16, yv1, xv + 16, 1300], fill=(250, 214, 60), outline=(180, 140, 20), width=2)
    lb = back(seg(t, 2.2, 2.6))
    text_c(d, 830, 1080, '45 cm', 52, 'Black', fill=ACC, scale=lb, alpha=clamp(lb))
    # plano azul
    p = ease(seg(t, 2.4, 3.4))
    if p > 0:
        parts = cabinet_parts(W / 2, 880, 720, 240)
        for idx, kk in enumerate(['bottom', 'left', 'right', 'top', 'div1', 'div2', 'shelf']):
            q = seg(p, idx / 9, idx / 9 + 0.35)
            if q <= 0:
                continue
            x0_, y0_, x1_, y1_ = parts[kk]
            col = mix((232, 222, 208), BLUE, q)
            d.rectangle([x0_, y0_, x1_, y1_], outline=col, width=4)
    caption(d, t, ['Medimos tu espacio', 'y lo diseñamos a la medida'], 0.6)
    progress_dots(d, 1)
    return img


def s_cut(t, D):
    img = Image.new('RGB', (W, H), BG); d = ImageDraw.Draw(img)
    header(d, t, 2, 'CORTAR')
    # mesa
    d.rectangle([60, 1150, 1020, 1190], fill=(110, 110, 118))
    d.rectangle([110, 1190, 140, 1360], fill=(90, 90, 98)); d.rectangle([940, 1190, 970, 1360], fill=(90, 90, 98))
    split = ease(seg(t, 2.1, 2.6))
    top_y0, cut_y, bot_y1 = 780, 960, 1140
    board(d, 120, top_y0 - 30 * split, 960, cut_y - 30 * split, seed=5)
    board(d, 120, cut_y + 4, 960, bot_y1, seed=9)
    # línea de corte
    if split < 0.3:
        for x in range(120, 960, 36):
            d.line([x, cut_y, x + 18, cut_y], fill=INK, width=3)
    # sierra
    k = ease_io(seg(t, 0.5, 2.1))
    sx = 60 + 960 * k
    if 0 < seg(t, 0.3, 2.3) < 1:
        R = 95
        cy = cut_y
        d.ellipse([sx - R, cy - R, sx + R, cy + R], fill=(200, 205, 212), outline=INK, width=3)
        ang = t * 25
        teeth = []
        for i in range(48):
            a = ang + i * 2 * math.pi / 48
            r = R + (10 if i % 2 == 0 else 0)
            teeth.append((sx + r * math.cos(a), cy + r * math.sin(a)))
        d.polygon(teeth, outline=INK, fill=(200, 205, 212))
        for i in range(3):
            a = ang * 0.5 + i * 2 * math.pi / 3
            d.line([sx, cy, sx + 70 * math.cos(a), cy + 70 * math.sin(a)], fill=(150, 155, 165), width=6)
        d.ellipse([sx - 18, cy - 18, sx + 18, cy + 18], fill=INK)
        # aserrín
        rnd = random.Random(int(t * FPS))
        for i in range(26):
            px = sx - rnd.uniform(10, 260)
            py = cy + rnd.uniform(-140, 60)
            r = rnd.uniform(4, 10)
            d.ellipse([px - r, py - r, px + r, py + r], fill=WOOD_L)
    pa = back(seg(t, 2.7, 3.1))
    if pa > 0:
        d.rounded_rectangle([W / 2 - 170, 660, W / 2 + 170, 750], 45, fill=ACC)
        text_c(d, W / 2, 703, '10 piezas', 52, 'ExtraBold', fill=(255, 255, 255), scale=pa)
    caption(d, t, ['Cortamos cada pieza', 'con precisión'], 0.6)
    progress_dots(d, 2)
    return img


def s_sand(t, D):
    img = Image.new('RGB', (W, H), BG); d = ImageDraw.Draw(img)
    header(d, t, 3, 'CANTEAR Y LIJAR')
    x0, y0, x1, y1 = 150, 820, 930, 1180
    smooth = ease(seg(t, 1.8, 3.4))
    board(d, x0, y0, x1, y1, col=mix(WOOD, WOOD_L, smooth), seed=11)
    # canto
    k = ease_io(seg(t, 0.4, 1.6))
    if k > 0:
        ex = x0 + (x1 - x0) * k
        d.rectangle([x0, y0 - 14, ex, y0 + 4], fill=(110, 72, 40))
        d.ellipse([ex - 40, y0 - 45, ex + 40, y0 + 35], fill=(120, 120, 128), outline=INK, width=3)
    # lijadora
    if seg(t, 1.7, 3.5) > 0 and t < 3.6:
        s = seg(t, 1.7, 3.5)
        sx = W / 2 + 280 * math.sin(s * math.pi * 3)
        sy = 1000 + 50 * math.sin(s * math.pi * 7)
        jit = 3 * math.sin(t * 90)
        d.rounded_rectangle([sx - 130 + jit, sy - 50, sx + 130 + jit, sy + 50], 24, fill=ACC, outline=INK, width=4)
        d.rounded_rectangle([sx - 70 + jit, sy - 120, sx + 70 + jit, sy - 50], 30, fill=INK)
        rnd = random.Random(int(t * FPS) + 7)
        for i in range(30):
            px = sx + rnd.uniform(-220, 220)
            py = sy + rnd.uniform(-120, 120)
            r = rnd.uniform(3, 8)
            d.ellipse([px - r, py - r, px + r, py + r], fill=(236, 214, 182))
    caption(d, t, ['Canteamos y lijamos', 'para un acabado fino'], 0.6)
    progress_dots(d, 3)
    return img


def s_build(t, D):
    img = Image.new('RGB', (W, H), BG); d = ImageDraw.Draw(img)
    header(d, t, 4, 'ARMAR')
    show, off = {}, {}
    n = len(ORDER)
    flashes = []
    for i, k in enumerate(ORDER):
        a0 = 0.35 + i * 0.3
        q = seg(t, a0, a0 + 0.35)
        if q <= 0:
            continue
        show[k] = 1
        e = back(q)
        side = -1 if i % 2 == 0 else 1
        off[k] = (side * 700 * (1 - e), -500 * (1 - e) if k in ('top', 'shelf') else 0)
        if 0.95 < q and t < a0 + 0.55:
            flashes.append(k)
    draw_cabinet(d, W / 2, 1000, show=show, offsets=off)
    parts = cabinet_parts(W / 2, 1000)
    for k in flashes:
        x0, y0, x1, y1 = parts[k]
        d.rectangle([x0 - 6, y0 - 6, x1 + 6, y1 + 6], outline=(255, 255, 255), width=5)
    caption(d, t, ['Armamos la estructura', 'en nuestro taller'], 0.6)
    progress_dots(d, 4)
    return img


def s_paint(t, D):
    img = Image.new('RGB', (W, H), BG); d = ImageDraw.Draw(img)
    header(d, t, 5, 'PINTAR')
    k = ease_io(seg(t, 0.5, 3.2))
    x_left = W / 2 - CW / 2 - 20
    px = x_left + (CW + 60) * k
    draw_cabinet(d, W / 2, 1000, paint=px if k > 0 else None)
    if seg(t, 0.3, 0.5) > 0 and k < 1:
        gx = px + 170
        gy = 700 + 15 * math.sin(t * 9)
        ty = 1000 + 110 * math.sin(t * 8)
        rnd = random.Random(int(t * FPS) + 3)
        nx, ny = gx - 60, gy
        for i in range(140):
            u = rnd.random()
            tx = px + rnd.uniform(-30, 30)
            tyy = ty + rnd.uniform(-150, 150) * u
            qx = nx + (tx - nx) * u
            qy = ny + (tyy - ny) * u
            r = rnd.uniform(2, 6)
            d.ellipse([qx - r, qy - r, qx + r, qy + r], fill=mix(FIN, BG, 0.35 * (1 - u)))
        # pistola HVLP
        d.polygon([(gx - 60, gy - 10), (gx, gy - 28), (gx + 130, gy - 28), (gx + 130, gy + 22), (gx, gy + 22), (gx - 60, gy + 10)], fill=(160, 166, 175), outline=INK)
        d.polygon([(gx + 70, gy + 22), (gx + 110, gy + 22), (gx + 125, gy + 130), (gx + 85, gy + 130)], fill=(120, 126, 135), outline=INK)
        d.polygon([(gx + 25, gy - 28), (gx + 85, gy - 28), (gx + 100, gy - 130), (gx + 10, gy - 130)], fill=(210, 214, 220), outline=INK)
        d.line([gx + 45, gy + 22, gx + 55, gy + 85], fill=INK, width=8)
    caption(d, t, ['Pintamos con pistola HVLP', 'para un acabado parejo'], 0.6)
    progress_dots(d, 5)
    return img


def s_install(t, D):
    img = Image.new('RGB', (W, H), BG); d = ImageDraw.Draw(img)
    header(d, t, 6, 'ENTREGAR')
    # sala
    d.rectangle([0, 560, W, 1290], fill=(222, 210, 192))
    d.rectangle([0, 1290, W, 1400], fill=(176, 140, 104))
    for x in range(0, W, 120):
        d.line([x, 1290, x - 40, 1400], fill=(160, 124, 90), width=3)
    c = ease(seg(t, 0.2, 0.9))
    cy = 1145 - 600 * (1 - back(c)) if c < 1 else 1145
    if c > 0:
        draw_cabinet(d, W / 2, cy, paint=10_000, w=760, h=250)
    tv = back(seg(t, 0.9, 1.4))
    if tv > 0:
        tw, th = 620 * tv, 350 * tv
        d.rounded_rectangle([W / 2 - tw / 2 - 12, 790 - th / 2 - 12, W / 2 + tw / 2 + 12, 790 + th / 2 + 12], 14, fill=INK)
        d.rectangle([W / 2 - tw / 2, 790 - th / 2, W / 2 + tw / 2, 790 + th / 2], fill=mix((40, 70, 110), (110, 170, 220), 0.5 + 0.5 * math.sin(t * 2.5)))
    pl = back(seg(t, 1.3, 1.7))
    if pl > 0:
        px, base = 970, 1290
        d.polygon([(px - 45 * pl, base - 120 * pl), (px + 45 * pl, base - 120 * pl), (px + 32 * pl, base), (px - 32 * pl, base)], fill=ACC)
        for i, a in enumerate([-0.9, -0.4, 0, 0.4, 0.9]):
            lx = px + 120 * pl * math.sin(a)
            ly = base - 120 * pl - 150 * pl * math.cos(a)
            d.ellipse([lx - 30 * pl, ly - 50 * pl, lx + 30 * pl, ly + 50 * pl], fill=(70, 140, 80))
    ok = back(seg(t, 1.8, 2.3))
    if ok > 0:
        d.rounded_rectangle([W / 2 - 200 * ok, 560 - 20, W / 2 + 200 * ok, 560 + 100], 50, fill=GREEN)
        text_c(d, W / 2, 607, '¡LISTO!', 64, 'Black', fill=(255, 255, 255), scale=ok)
    caption(d, t, ['Te lo llevamos a casa', 'Envío gratis en Tepatitlán'], 0.6)
    progress_dots(d, 6)
    return img


def s_cta(t, D):
    img = Image.new('RGB', (W, H), INK); d = ImageDraw.Draw(img)

    def tc(cx, y, s, size, weight, fill, a, scale=1.0):
        if a <= 0:
            return
        sz = max(8, int(size * scale)); f = font(sz, weight)
        bb = d.textbbox((0, 0), s, font=f)
        d.text((cx - (bb[2] - bb[0]) / 2 - bb[0], y - sz / 2), s, font=f, fill=mix(INK, fill, clamp(a)))

    a = back(seg(t, 0.0, 0.5))
    tc(W / 2, 420, 'HOUSE LITE', 130, 'Black', (255, 255, 255), a, a)
    b = ease(seg(t, 0.3, 0.7))
    tc(W / 2, 540, 'Carpintería y muebles', 58, 'SemiBold', WOOD_L, b)
    d.line([W / 2 - 120, 620, W / 2 + 120, 620], fill=mix(INK, ACC, b), width=6)
    c = ease(seg(t, 0.6, 1.0))
    tc(W / 2, 720, 'Diseñamos y fabricamos', 56, 'Bold', (255, 255, 255), c)
    tc(W / 2, 795, 'a la medida', 56, 'Bold', (255, 255, 255), c)
    tc(W / 2, 880, 'Hecho en nuestro taller de Tepatitlán', 44, 'Medium', (220, 210, 196), c)
    e = back(seg(t, 1.0, 1.5))
    if e > 0:
        pulse = 1 + 0.03 * math.sin(max(0, t - 1.5) * 6)
        bw, bh = 820 * e * pulse, 210 * e * pulse
        d.rounded_rectangle([W / 2 - bw / 2, 1100 - bh / 2, W / 2 + bw / 2, 1100 + bh / 2], int(60 * e), fill=GREEN)
        tc(W / 2, 1055, 'Cotiza por WhatsApp', 52, 'Bold', (255, 255, 255), 1, e)
        tc(W / 2, 1135, '378 170 8278', 92, 'Black', (255, 255, 255), 1, e)
    g = ease(seg(t, 1.6, 2.0))
    tc(W / 2, 1300, 'Lunes a sábado · 9:00 a 20:00', 46, 'SemiBold', (220, 210, 196), g)
    tc(W / 2, 1370, 'Envío gratis en Tepatitlán', 46, 'SemiBold', ACC, g)
    return img


SCENES = [
    ('s1', s_hook, 3.0),
    ('s2', s_measure, 4.0),
    ('s3', s_cut, 3.8),
    ('s4', s_sand, 3.8),
    ('s5', s_build, 4.0),
    ('s6', s_paint, 3.8),
    ('s7', s_install, 3.6),
    ('s8', s_cta, 5.0),
]


def render(name, fn, D):
    tmp = f'out/{name}.tmp.mp4'
    n = int(round(D * FPS))
    p = subprocess.Popen(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
                          '-c:v', 'libx264', '-crf', '18', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-r', str(FPS), tmp], stdin=subprocess.PIPE)
    for i in range(n):
        p.stdin.write(fn(i / FPS, D).tobytes())
    p.stdin.close()
    if p.wait() == 0:
        os.replace(tmp, f'out/{name}.mp4')
    else:
        sys.exit(f'fail {name}')


if __name__ == '__main__':
    os.makedirs('out', exist_ok=True)
    mode = sys.argv[1]
    if mode == 'preview':
        for name, fn, D in SCENES:
            fn(D * 0.8, D).save(f'out/prev_{name}.png')
    else:
        for name, fn, D in SCENES:
            render(name, fn, D)
            print(name, 'ok', flush=True)
