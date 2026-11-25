"""Tres videos nuevos de House Lite en el mismo estilo."""
import math, random, os, sys, subprocess
from PIL import Image, ImageDraw
import make
from make import (W, H, FPS, BG, INK, ACC, WOOD, WOOD_D, WOOD_L, FIN, BLUE, GREEN,
                  font, clamp, seg, ease, ease_io, back, mix, text_c, board, caption,
                  draw_cabinet, cabinet_parts, ORDER, render, s_cta)

RED = (214, 58, 47)
WALL = (232, 222, 208)
MDF = (176, 138, 98)
MEL = (236, 236, 232)


def tag_header(d, t, label, title, title2=None, col=ACC):
    a = ease(seg(t, 0, 0.35))
    f = font(38, 'ExtraBold')
    pw = d.textbbox((0, 0), label, font=f)[2] + 70
    y = 250 - 40 * (1 - a)
    d.rounded_rectangle([W / 2 - pw / 2, y - 35, W / 2 + pw / 2, y + 35], 35, fill=mix(BG, col, a))
    text_c(d, W / 2, y - 2, label, 38, 'ExtraBold', fill=(255, 255, 255), alpha=a)
    b = ease(seg(t, 0.12, 0.5))
    text_c(d, W / 2, 380 - 30 * (1 - b), title, 80, 'Black', alpha=b)
    if title2:
        text_c(d, W / 2, 470 - 30 * (1 - b), title2, 80, 'Black', alpha=b)


def dots(d, n, total):
    for i in range(total):
        x = W / 2 + (i - (total - 1) / 2) * 44
        r = 11 if i + 1 == n else 8
        d.ellipse([x - r, 1830 - r, x + r, 1830 + r], fill=ACC if i + 1 <= n else (214, 203, 190))


def new():
    img = Image.new('RGB', (W, H), BG)
    return img, ImageDraw.Draw(img)


def tape(d, x0, y, length, k, label=None, la=0.0, vertical=False):
    if k <= 0:
        return
    L = length * k
    if not vertical:
        d.rectangle([x0, y - 16, x0 + L, y + 16], fill=(250, 214, 60), outline=(180, 140, 20), width=2)
        for i in range(0, int(L), 20):
            d.line([x0 + i, y - 16, x0 + i, y - 16 + (22 if i % 100 == 0 else 12)], fill=INK, width=2)
        d.rounded_rectangle([x0 - 56, y - 40, x0 + 4, y + 40], 12, fill=(240, 196, 40), outline=INK, width=3)
    if label and la > 0:
        text_c(d, x0 + length / 2, y - 60, label, 54, 'Black', fill=ACC, scale=la, alpha=clamp(la))


def check(d, cx, cy, r, col=GREEN, a=1.0):
    if a <= 0:
        return
    r *= a
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=col)
    d.line([(cx - r * 0.45, cy), (cx - r * 0.1, cy + r * 0.35), (cx + r * 0.5, cy - r * 0.35)], fill=(255, 255, 255), width=max(3, int(r * 0.22)))


def cross(d, cx, cy, r, a=1.0):
    if a <= 0:
        return
    r *= a
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=RED)
    k = r * 0.42
    w = max(3, int(r * 0.22))
    d.line([cx - k, cy - k, cx + k, cy + k], fill=(255, 255, 255), width=w)
    d.line([cx - k, cy + k, cx + k, cy - k], fill=(255, 255, 255), width=w)


def kitchen(d, x0, y_floor, w, k=1.0, wood=FIN, seed=0):
    """Cocina integral sencilla: gabinetes bajos + altos."""
    n = 4
    cw = w / n
    base_h, top_h = 300, 260
    for i in range(n):
        q = ease(seg(k, i * 0.12, i * 0.12 + 0.5))
        if q <= 0:
            continue
        x = x0 + i * cw
        yb = y_floor - base_h + 200 * (1 - back(q))
        d.rectangle([x + 4, yb, x + cw - 4, y_floor], fill=wood, outline=mix(wood, (0, 0, 0), 0.3), width=3)
        d.rounded_rectangle([x + cw / 2 - 30, yb + 30, x + cw / 2 + 30, yb + 40], 4, fill=(200, 170, 110))
        yt = y_floor - base_h - 330 - 200 * (1 - back(q))
        d.rectangle([x + 4, yt, x + cw - 4, yt + top_h], fill=wood, outline=mix(wood, (0, 0, 0), 0.3), width=3)
        d.rounded_rectangle([x + cw / 2 - 30, yt + top_h - 40, x + cw / 2 + 30, yt + top_h - 30], 4, fill=(200, 170, 110))
    q = ease(seg(k, 0.6, 1.0))
    if q > 0:
        d.rectangle([x0 - 10, y_floor - base_h - 24, x0 + (w + 10) * q, y_floor - base_h], fill=(225, 220, 212), outline=(170, 165, 158), width=2)


# ================= VIDEO 1: medir la cocina =================
def k1_hook(t, D):
    img, d = new()
    # pared y cinta mal puesta
    d.rectangle([90, 760, 990, 1330], fill=WALL)
    d.rectangle([90, 1330, 990, 1370], fill=(190, 170, 145))
    tape(d, 200, 1050, 700, ease(seg(t, 0.2, 0.8)))
    a = back(seg(t, 0.0, 0.35))
    if a > 0:
        d.rounded_rectangle([W / 2 - 230 * a, 230 - 85 * a, W / 2 + 230 * a, 230 + 85 * a], int(40 * a), fill=RED)
        text_c(d, W / 2, 228, '¡ALTO!', 120, 'Black', fill=(255, 255, 255), scale=a)
    b = back(seg(t, 0.4, 0.8))
    text_c(d, W / 2, 440, 'NO MIDAS TU', 84, 'Black', scale=b, alpha=clamp(b))
    text_c(d, W / 2, 540, 'COCINA ASÍ', 100, 'Black', fill=ACC, scale=b, alpha=clamp(b))
    cross(d, W / 2, 1050, 130, back(seg(t, 0.9, 1.3)))
    caption(d, t, ['Este es el error más común'], 1.2)
    return img


def k1_crooked(t, D):
    img, d = new()
    tag_header(d, t, 'EL ERROR', 'LAS PAREDES', 'NO SON DERECHAS')
    k = ease_io(seg(t, 0.4, 1.4))
    off = 70 * k
    # pared torcida (exagerada)
    d.polygon([(150, 650), (930, 650), (930 - off, 1330), (150, 1330)], fill=WALL, outline=(200, 186, 166))
    d.rectangle([90, 1330, 990, 1370], fill=(190, 170, 145))
    # línea de referencia recta
    for y in range(650, 1330, 40):
        d.line([930, y, 930, y + 20], fill=BLUE, width=5)
    if k > 0.5:
        text_c(d, 860 - off, 990, f'{int(off * 0.4 + 0.5)} mm', 46, 'Black', fill=RED, alpha=seg(t, 1.0, 1.4))
    tape(d, 210, 760, 720, ease(seg(t, 1.3, 1.9)), '3.02 m', back(seg(t, 1.8, 2.2)))
    caption(d, t, ['Si mides una sola vez,', 'te puede salir mal'], 0.6)
    dots(d, 1, 4)
    return img


def k1_three(t, D):
    img, d = new()
    tag_header(d, t, 'EL TRUCO', 'MIDE 3 VECES')
    d.rectangle([90, 600, 990, 1330], fill=WALL)
    d.rectangle([90, 1330, 990, 1370], fill=(190, 170, 145))
    rows = [(720, 'ARRIBA', '3.02 m'), (970, 'EN MEDIO', '3.00 m'), (1220, 'ABAJO', '2.98 m')]
    for i, (y, lab, val) in enumerate(rows):
        s = 0.4 + i * 0.6
        k = ease_io(seg(t, s, s + 0.5))
        tape(d, 200, y, 640, k)
        la = back(seg(t, s + 0.4, s + 0.7))
        text_c(d, 330, y - 62, lab, 40, 'ExtraBold', fill=INK, alpha=clamp(la))
        text_c(d, 760, y - 62, val, 52, 'Black', fill=ACC, scale=la, alpha=clamp(la))
    h = back(seg(t, 2.4, 2.8))
    if h > 0:
        d.rounded_rectangle([610, 1145, 910, 1295], 24, outline=GREEN, width=8)
        check(d, 930, 1150, 46, a=h)
    caption(d, t, ['Usa siempre', 'la medida más chica'], 2.3)
    dots(d, 2, 4)
    return img


def k1_marks(t, D):
    img, d = new()
    tag_header(d, t, 'NO OLVIDES', 'MARCAR TODO')
    d.rectangle([90, 600, 990, 1330], fill=WALL)
    d.rectangle([90, 1330, 990, 1370], fill=(190, 170, 145))
    items = [(260, 1000, 'LUZ'), (540, 1180, 'AGUA'), (820, 1180, 'GAS')]
    for i, (x, y, lab) in enumerate(items):
        q = back(seg(t, 0.4 + i * 0.5, 0.8 + i * 0.5))
        if q <= 0:
            continue
        if lab == 'LUZ':
            d.rounded_rectangle([x - 45 * q, y - 60 * q, x + 45 * q, y + 60 * q], 12, fill=(250, 250, 248), outline=INK, width=4)
            for dy in (-22, 22):
                d.ellipse([x - 14 * q, y + dy * q - 8 * q, x - 2 * q, y + dy * q + 8 * q], fill=INK)
                d.ellipse([x + 2 * q, y + dy * q - 8 * q, x + 14 * q, y + dy * q + 8 * q], fill=INK)
        elif lab == 'AGUA':
            d.rectangle([x - 15 * q, y - 120 * q, x + 15 * q, y + 40 * q], fill=(150, 160, 172), outline=INK, width=3)
            d.rectangle([x - 60 * q, y - 120 * q, x + 15 * q, y - 90 * q], fill=(150, 160, 172), outline=INK, width=3)
            d.ellipse([x - 70 * q, y - 85 * q, x - 50 * q, y - 55 * q], fill=(80, 160, 230))
        else:
            d.rectangle([x - 15 * q, y - 120 * q, x + 15 * q, y + 40 * q], fill=(240, 196, 40), outline=INK, width=3)
            fl = 1 + 0.1 * math.sin(t * 12)
            d.polygon([(x, y - 230 * q * fl), (x + 40 * q, y - 150 * q), (x, y - 125 * q), (x - 40 * q, y - 150 * q)], fill=ACC)
            d.polygon([(x, y - 190 * q * fl), (x + 18 * q, y - 150 * q), (x, y - 138 * q), (x - 18 * q, y - 150 * q)], fill=(250, 214, 60))
        # pin
        d.ellipse([x - 26, 700 - 26 + (1 - q) * -60, x + 26, 700 + 26 + (1 - q) * -60], fill=RED)
        text_c(d, x, 780, lab, 48, 'Black', fill=INK, alpha=clamp(q))
    caption(d, t, ['Tomas de luz,', 'agua y gas'], 0.5)
    dots(d, 3, 4)
    return img


def k1_result(t, D):
    img, d = new()
    tag_header(d, t, 'RESULTADO', 'QUEDA PERFECTA', col=GREEN)
    d.rectangle([60, 600, 1020, 1330], fill=WALL)
    d.rectangle([60, 1330, 1020, 1370], fill=(176, 140, 104))
    kitchen(d, 100, 1330, 880, ease(seg(t, 0.2, 1.8)))
    check(d, W / 2, 980, 70, a=back(seg(t, 1.8, 2.2)))
    caption(d, t, ['Sin huecos', 'ni sorpresas'], 0.6)
    dots(d, 4, 4)
    return img


# ================= VIDEO 2: materiales =================
def panel(d, x0, y0, x1, y1, kind, seed=1, k=1.0):
    if k <= 0:
        return
    if kind == 'madera':
        board(d, x0, y0, x1, y1, col=WOOD, seed=seed)
    elif kind == 'mdf':
        d.rectangle([x0, y0, x1, y1], fill=MDF, outline=mix(MDF, (0, 0, 0), 0.25), width=3)
        rnd = random.Random(seed)
        for _ in range(int((x1 - x0) * (y1 - y0) / 900)):
            px, py = rnd.uniform(x0 + 4, x1 - 4), rnd.uniform(y0 + 4, y1 - 4)
            d.point((px, py), fill=mix(MDF, (0, 0, 0), 0.12))
    else:
        d.rectangle([x0, y0, x1, y1], fill=MEL, outline=(170, 170, 165), width=3)
        d.rectangle([x0, y0, x1, y0 + 10], fill=(200, 200, 196))


def m_hook(t, D):
    img, d = new()
    names = [('madera', 'MADERA'), ('mdf', 'MDF'), ('mel', 'MELAMINA')]
    for i, (k, lab) in enumerate(names):
        q = back(seg(t, 0.1 + i * 0.25, 0.5 + i * 0.25))
        if q <= 0:
            continue
        cx = 210 + i * 330
        hh = 520 * q
        panel(d, cx - 130, 1150 - hh, cx + 130, 1150, k, seed=i + 2)
        text_c(d, cx, 1230, lab, 50, 'Black', alpha=clamp(q))
    a = back(seg(t, 0.0, 0.4))
    text_c(d, W / 2, 330, '¿CUÁL', 110, 'Black', scale=a, alpha=clamp(a))
    text_c(d, W / 2, 460, 'CONVIENE?', 110, 'Black', fill=ACC, scale=a, alpha=clamp(a))
    caption(d, t, ['Te digo cuál conviene', 'para tus muebles'], 1.0)
    return img


def bars(d, t, start, rows):
    for i, (lab, val, col) in enumerate(rows):
        y = 1170 + i * 80
        q = ease(seg(t, start + i * 0.25, start + i * 0.25 + 0.6))
        text_c(d, 290, y, lab, 42, 'ExtraBold', alpha=clamp(q * 2))
        d.rounded_rectangle([430, y - 20, 930, y + 20], 20, fill=(222, 212, 198))
        if q > 0:
            d.rounded_rectangle([430, y - 20, 430 + 500 * val * q, y + 20], 20, fill=col)


def m_madera(t, D):
    img, d = new()
    tag_header(d, t, '1', 'MADERA SÓLIDA')
    q = back(seg(t, 0.2, 0.7))
    panel(d, W / 2 - 330 * q, 620, W / 2 + 330 * q, 1100, 'madera', seed=4)
    s = 0.5 + 0.5 * math.sin(t * 2)
    bars(d, t, 0.9, [('Resistencia', 1.0, GREEN), ('Elegancia', 0.95, GREEN), ('Precio', 1.0, RED)])
    caption(d, t, ['La más resistente,', 'pero la más cara'], 0.6)
    return img


def m_mdf(t, D):
    img, d = new()
    tag_header(d, t, '2', 'MDF')
    x0, x1, y0, y1 = 210, 870, 620, 1100
    panel(d, x0, y0, x1, y1, 'mdf', seed=7)
    k = ease_io(seg(t, 0.5, 2.2))
    px = x0 + (x1 - x0) * k
    if k > 0:
        d.rectangle([x0, y0, px, y1], fill=(84, 130, 116), outline=mix((84, 130, 116), (0, 0, 0), 0.25), width=3)
        # rodillo
        if k < 1:
            d.rounded_rectangle([px - 40, y0 - 20, px + 40, y1 + 20], 30, fill=(240, 240, 236), outline=INK, width=4)
            d.line([px + 40, (y0 + y1) / 2, px + 120, (y0 + y1) / 2], fill=INK, width=8)
            d.line([px + 120, (y0 + y1) / 2, px + 120, y1 + 180], fill=INK, width=8)
            d.rounded_rectangle([px + 100, y1 + 150, px + 140, y1 + 260], 16, fill=ACC)
    bars(d, t, 2.3, [('Para pintar', 1.0, GREEN), ('Precio', 0.6, ACC)])
    caption(d, t, ['Lisa y perfecta', 'para pintar'], 0.6)
    return img


def m_mel(t, D):
    img, d = new()
    tag_header(d, t, '3', 'MELAMINA')
    x0, x1, y0, y1 = 210, 870, 620, 1100
    q = back(seg(t, 0.2, 0.7))
    panel(d, W / 2 - 330 * q, y0, W / 2 + 330 * q, y1, 'mel', seed=8)
    # brillo que barre
    k = seg(t, 0.8, 1.6)
    if 0 < k < 1:
        sx = x0 + (x1 - x0 + 200) * k - 100
        d.polygon([(sx, y0 + 12), (sx + 60, y0 + 12), (sx - 40, y1), (sx - 100, y1)], fill=(255, 255, 255))
    # gota que se limpia
    g = seg(t, 1.6, 2.6)
    if 0 < g < 1:
        r = 50 * (1 - ease(seg(g, 0.4, 1)))
        d.ellipse([W / 2 - r, 860 - r * 0.7, W / 2 + r, 860 + r * 0.7], fill=(120, 80, 50))
        cx = W / 2 - 160 + 320 * ease(seg(g, 0.3, 1))
        d.rounded_rectangle([cx - 70, 820, cx + 70, 900], 20, fill=(90, 160, 220), outline=INK, width=3)
    bars(d, t, 1.8, [('Limpieza', 1.0, GREEN), ('Precio', 0.35, GREEN)])
    caption(d, t, ['Ya trae acabado', 'y es económica'], 0.6)
    return img


def m_depends(t, D):
    img, d = new()
    tag_header(d, t, '¿Y CUÁL ES MEJOR?', 'DEPENDE')
    # balanza
    ang = 0.18 * math.sin(t * 2.2) * (1 - seg(t, 2.2, 3.0))
    cx, cy = W / 2, 760
    d.polygon([(cx - 70, 1260), (cx + 70, 1260), (cx + 20, cy), (cx - 20, cy)], fill=INK)
    L = 260
    lx, ly = cx - L * math.cos(ang), cy - L * math.sin(ang)
    rx, ry = cx + L * math.cos(ang), cy + L * math.sin(ang)
    d.line([lx, ly, rx, ry], fill=INK, width=14)
    for (x, y, lab) in ((lx, ly, 'ESPACIO'), (rx, ry, 'PRESUPUESTO')):
        d.line([x, y, x, y + 150], fill=INK, width=4)
        d.chord([x - 150, y + 90, x + 150, y + 230], 0, 180, fill=ACC)
        text_c(d, x, y + 290, lab, 44, 'Black')
    d.ellipse([cx - 26, cy - 26, cx + 26, cy + 26], fill=ACC)
    caption(d, t, ['Te asesoramos', 'sin compromiso'], 0.8)
    return img


# ================= VIDEO 3: closet =================
def closet(d, cx, cy, w=640, h=860, show=1.0, doors=0.0, color=FIN, inner=True):
    x0, x1, y0, y1 = cx - w / 2, cx + w / 2, cy - h / 2, cy + h / 2
    t = 22
    if show <= 0:
        return
    d.rectangle([x0, y0, x1, y1], fill=mix(WOOD_D, (0, 0, 0), 0.2))
    for r in [(x0, y0, x1, y0 + t), (x0, y1 - t, x1, y1), (x0, y0, x0 + t, y1), (x1 - t, y0, x1, y1), (cx - t / 2, y0, cx + t / 2, y1)]:
        board(d, *r, col=color if color != FIN else (90, 100, 108), seed=3, grain=False)
    if inner:
        # izquierda: tubo y ropa
        d.line([x0 + 40, y0 + 110, cx - 40, y0 + 110], fill=(190, 190, 196), width=10)
        cols = [(196, 82, 64), (70, 120, 170), (230, 190, 90), (110, 150, 100), (60, 60, 70)]
        for i, c in enumerate(cols):
            hx = x0 + 70 + i * 52
            d.line([hx, y0 + 110, hx, y0 + 130], fill=INK, width=3)
            d.polygon([(hx - 26, y0 + 135), (hx + 26, y0 + 135), (hx + 30, y0 + 430), (hx - 30, y0 + 430)], fill=c)
        # repisa baja izquierda con zapatos
        board(d, x0 + t, y1 - 200, cx - t / 2, y1 - 180, col=WOOD_L, seed=5, grain=False)
        # derecha: repisas y cajones
        for i in range(3):
            yy = y0 + 160 + i * 150
            board(d, cx + t / 2, yy, x1 - t, yy + 18, col=WOOD_L, seed=6, grain=False)
            for j in range(3):
                bx = cx + 40 + j * 85
                d.rectangle([bx, yy - 70, bx + 70, yy], fill=[(200, 160, 120), (150, 170, 190), (220, 210, 200)][j])
        for i in range(2):
            yy = y1 - 300 + i * 130
            d.rectangle([cx + t / 2 + 10, yy, x1 - t - 10, yy + 115], fill=WOOD_L, outline=WOOD_D, width=3)
            d.rounded_rectangle([cx + w / 4 - 40, yy + 50, cx + w / 4 + 40, yy + 62], 5, fill=INK)
    if doors > 0:
        dw = (w / 2 - t) * doors
        dc = color if color != FIN else FIN
        d.rectangle([x0 + t, y0 + t, x0 + t + dw, y1 - t], fill=dc, outline=mix(dc, (0, 0, 0), 0.3), width=3)
        d.rectangle([x1 - t - dw, y0 + t, x1 - t, y1 - t], fill=dc, outline=mix(dc, (0, 0, 0), 0.3), width=3)


def c_hook(t, D):
    img, d = new()
    a = back(seg(t, 0.0, 0.4))
    text_c(d, W / 2, 300, 'POR FIN,', 92, 'Black', scale=a, alpha=clamp(a))
    text_c(d, W / 2, 410, 'EL CLOSET QUE', 92, 'Black', fill=ACC, scale=a, alpha=clamp(a))
    text_c(d, W / 2, 510, 'SIEMPRE QUISISTE', 86, 'Black', fill=ACC, scale=a, alpha=clamp(a))
    op = ease_io(seg(t, 0.8, 1.8))
    closet(d, W / 2, 1020, h=760, doors=1 - op)
    caption(d, t, ['Así lo hacemos'], 1.8)
    return img


def c_design(t, D):
    img, d = new()
    make.header(d, t, 1, 'DISEÑAR')
    p = ease(seg(t, 0.3, 2.0))
    x0, x1, y0, y1 = W / 2 - 320, W / 2 + 320, 640, 1360
    col = mix(BG, BLUE, p)
    d.rectangle([x0, y0, x1, y1], outline=col, width=5)
    d.line([W / 2, y0, W / 2, y1], fill=col, width=5)
    labs = []
    if p > 0.3:
        d.line([x0 + 40, y0 + 100, W / 2 - 40, y0 + 100], fill=col, width=5)
        labs.append((x0 + 160, y0 + 160, 'TUBO'))
    if p > 0.5:
        for i in range(3):
            yy = y0 + 160 + i * 150
            d.line([W / 2, yy, x1, yy], fill=col, width=5)
        labs.append((x1 - 160, y0 + 120, 'REPISAS'))
    if p > 0.7:
        for i in range(2):
            yy = y1 - 300 + i * 130
            d.rectangle([W / 2 + 15, yy, x1 - 15, yy + 115], outline=col, width=5)
        labs.append((x1 - 160, y1 - 330, 'CAJONES'))
    for (x, y, l) in labs:
        text_c(d, x, y, l, 40, 'ExtraBold', fill=BLUE)
    caption(d, t, ['A tu gusto: cajones,', 'repisas y tubos'], 0.6)
    dots(d, 1, 4)
    return img


def c_cut(t, D):
    img = make.s_cut(t, D)
    d = ImageDraw.Draw(img)
    d.rectangle([0, 180, W, 460], fill=BG)
    d.rectangle([0, 1810, W, 1850], fill=BG)
    make.header(d, t, 2, 'CORTAR')
    dots(d, 2, 4)
    return img


def c_build(t, D):
    img, d = new()
    make.header(d, t, 3, 'ARMAR Y PINTAR')
    q = back(seg(t, 0.2, 0.9))
    off = 700 * (1 - q)
    closet(d, W / 2 - off, 1010, h=760, show=1 if q > 0 else 0, inner=seg(t, 0.9, 1.0) >= 1, color=WOOD)
    k = ease_io(seg(t, 1.4, 2.8))
    if k > 0:
        dc = (84, 130, 116)
        x0 = W / 2 - 320
        d.rectangle([x0, 630, x0 + 640 * k, 650], fill=dc)
        d.rectangle([x0, 1370, x0 + 640 * k, 1390], fill=dc)
        d.rectangle([x0, 630, x0 + 22, 1390], fill=dc)
        if k > 0.5:
            d.rectangle([W / 2 - 11, 630, W / 2 + 11, 1390], fill=dc)
        if k >= 1:
            d.rectangle([W / 2 + 298, 630, W / 2 + 320, 1390], fill=dc)
    caption(d, t, ['Con el acabado', 'que tú elijas'], 0.6)
    dots(d, 3, 4)
    return img


def c_deliver(t, D):
    img, d = new()
    make.header(d, t, 4, 'ENTREGAR')
    d.rectangle([0, 560, W, 1400], fill=(222, 210, 192))
    d.rectangle([0, 1400, W, 1500], fill=(176, 140, 104))
    q = back(seg(t, 0.2, 0.8))
    cy = 990 - 700 * (1 - q)
    if q > 0:
        closet(d, W / 2 - 120, cy + 0, w=560, h=800, color=(84, 130, 116))
    # cama
    b = back(seg(t, 0.8, 1.2))
    if b > 0:
        d.rounded_rectangle([700, min(1380, 1240 + 200 * (1 - b)), 1060, 1400], 20, fill=(240, 236, 228), outline=INK, width=3)
        d.rounded_rectangle([720, 1210 + 200 * (1 - b), 840, 1260 + 200 * (1 - b)], 16, fill=(255, 255, 255), outline=INK, width=2)
    ok = back(seg(t, 1.4, 1.9))
    if ok > 0:
        d.rounded_rectangle([W / 2 - 200 * ok, 520, W / 2 + 200 * ok, 620], 50, fill=GREEN)
        text_c(d, W / 2, 567, '¡LISTO!', 64, 'Black', fill=(255, 255, 255), scale=ok)
    caption(d, t, ['Te lo llevamos a casa', 'Envío gratis en Tepatitlán'], 0.6)
    dots(d, 4, 4)
    return img


VIDEOS = {
    'cocina': [k1_hook, k1_crooked, k1_three, k1_marks, k1_result, s_cta],
    'materiales': [m_hook, m_madera, m_mdf, m_mel, m_depends, s_cta],
    'closet': [c_hook, c_design, c_cut, c_build, c_deliver, s_cta],
}
NOMINAL = {
    'cocina': [3.0, 3.0, 3.2, 3.0, 3.0, 5.0],
    'materiales': [3.0, 3.0, 3.4, 3.0, 3.2, 5.0],
    'closet': [3.0, 3.0, 3.6, 3.2, 3.0, 5.0],
}

if __name__ == '__main__':
    os.makedirs('out2', exist_ok=True)
    from PIL import Image as I
    for name, fns in VIDEOS.items():
        ims = [fn(NOMINAL[name][i] * 0.85, NOMINAL[name][i]).resize((270, 480)) for i, fn in enumerate(fns)]
        s = I.new('RGB', (270 * 6, 480))
        for i, im in enumerate(ims):
            s.paste(im, (i * 270, 0))
        s.save(f'out2/sheet_{name}.png')
