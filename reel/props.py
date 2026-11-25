"""Librería de dibujos y helpers para los videos de House Lite (mismo estilo que make.py / v2.py)."""
import math, random
from PIL import Image, ImageDraw
from make import (W, H, FPS, BG, INK, ACC, WOOD, WOOD_D, WOOD_L, FIN, FIN_D, BLUE, GREEN,
                  font, clamp, seg, ease, ease_io, back, mix, text_c, board, caption, draw_cabinet, s_cta)
from v2 import RED, WALL, MDF, MEL, tag_header, dots, check, cross, tape, closet

WHITE = (255, 255, 255)
FLOOR = (190, 170, 145)
FLOOR_D = (176, 140, 104)
STEEL = (170, 176, 184)
LIGHT = (236, 226, 210)      # melamina clara
YELLOW = (250, 214, 60)
SKY = (110, 170, 220)
PLANT = (70, 140, 80)
GOLD = (200, 170, 110)

STAGE_TOP, STAGE_BOT = 560, 1380


# ---- dibujo tolerante: ordena coordenadas y omite figuras degeneradas (animaciones a escala 0)
def _safe(orig, rounded=False):
    def f(self, xy, *a, **kw):
        try:
            if len(xy) == 4 and not isinstance(xy[0], (tuple, list)):
                x0, y0, x1, y1 = xy
            else:
                (x0, y0), (x1, y1) = xy
        except Exception:
            return orig(self, xy, *a, **kw)
        x0, x1 = sorted((x0, x1)); y0, y1 = sorted((y0, y1))
        if x1 - x0 < 1 or y1 - y0 < 1:
            return
        if rounded:
            r = a[0] if a else kw.pop('radius', 0)
            r = max(0, min(r, (x1 - x0) / 2, (y1 - y0) / 2))
            return orig(self, [x0, y0, x1, y1], r, *a[1:], **kw)
        return orig(self, [x0, y0, x1, y1], *a, **kw)
    return f


ImageDraw.ImageDraw.rectangle = _safe(ImageDraw.ImageDraw.rectangle)
ImageDraw.ImageDraw.ellipse = _safe(ImageDraw.ImageDraw.ellipse)
ImageDraw.ImageDraw.rounded_rectangle = _safe(ImageDraw.ImageDraw.rounded_rectangle, True)


def new(col=BG):
    img = Image.new('RGB', (W, H), col)
    return img, ImageDraw.Draw(img)


# ---------------------------------------------------------------- texto / UI
def hook_text(d, t, lines, y0=300, gap=None, start=0.0):
    """lines: [(texto, tamaño, color)] con pop escalonado."""
    y = y0
    for i, (s, size, col) in enumerate(lines):
        a = back(seg(t, start + i * 0.18, start + i * 0.18 + 0.5))
        text_c(d, W / 2, y, s, size, 'Black', fill=col, scale=a, alpha=clamp(a))
        y += (gap or size * 1.12)
    return y


def pill(d, cx, cy, s, col=ACC, k=1.0, size=44, fg=WHITE, weight='ExtraBold', pad=46):
    if k <= 0:
        return
    f = font(max(8, int(size * k)), weight)
    bb = d.textbbox((0, 0), s, font=f)
    w = (bb[2] - bb[0]) + pad * 2 * k
    h = size * 1.7 * k
    d.rounded_rectangle([cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2], int(h / 2), fill=col)
    text_c(d, cx, cy - 2, s, size, weight, fill=fg, scale=k)


def label(d, cx, cy, s, size=46, col=INK, k=1.0, weight='Black'):
    if k > 0:
        text_c(d, cx, cy, s, size, weight, fill=col, scale=k, alpha=clamp(k))


def alto(d, t, y=210, s='¡ALTO!'):
    a = back(seg(t, 0, 0.45))
    if a <= 0:
        return
    f = font(int(76 * a), 'Black')
    bb = d.textbbox((0, 0), s, font=f)
    w, h = bb[2] - bb[0] + 80 * a, 120 * a
    d.rounded_rectangle([W / 2 - w / 2, y - h / 2, W / 2 + w / 2, y + h / 2], int(24 * a), fill=RED)
    text_c(d, W / 2, y - 4, s, 76, 'Black', fill=WHITE, scale=a)


def arrow(d, x0, y0, x1, y1, k=1.0, col=ACC, w=10, head=34):
    if k <= 0:
        return
    xe, ye = x0 + (x1 - x0) * k, y0 + (y1 - y0) * k
    d.line([x0, y0, xe, ye], fill=col, width=w)
    ang = math.atan2(ye - y0, xe - x0)
    pts = [(xe + head * math.cos(ang), ye + head * math.sin(ang)),
           (xe + head * 0.8 * math.cos(ang + 2.4), ye + head * 0.8 * math.sin(ang + 2.4)),
           (xe + head * 0.8 * math.cos(ang - 2.4), ye + head * 0.8 * math.sin(ang - 2.4))]
    d.polygon(pts, fill=col)


def dim_h(d, x0, x1, y, s, k=1.0, col=ACC, above=True, size=54):
    if k <= 0:
        return
    xm = (x0 + x1) / 2
    hw = (x1 - x0) / 2 * ease(k)
    d.line([xm - hw, y, xm + hw, y], fill=col, width=6)
    for x in (xm - hw, xm + hw):
        d.line([x, y - 22, x, y + 22], fill=col, width=6)
    la = back(seg(k, 0.6, 1.0))
    text_c(d, xm, y - 50 if above else y + 52, s, size, 'Black', fill=col, scale=la, alpha=clamp(la))


def dim_v(d, x, y0, y1, s, k=1.0, col=ACC, side=1, size=54):
    if k <= 0:
        return
    ym = (y0 + y1) / 2
    hh = (y1 - y0) / 2 * ease(k)
    d.line([x, ym - hh, x, ym + hh], fill=col, width=6)
    for y in (ym - hh, ym + hh):
        d.line([x - 22, y, x + 22, y], fill=col, width=6)
    la = back(seg(k, 0.6, 1.0))
    f = font(size, 'Black')
    w = d.textbbox((0, 0), s, font=f)[2]
    cx = x + side * (w / 2 + 40)
    text_c(d, cx, ym, s, size, 'Black', fill=col, scale=la, alpha=clamp(la))


def sparkle(d, cx, cy, t, r=26, col=YELLOW, k=1.0):
    if k <= 0:
        return
    s = r * k * (0.8 + 0.2 * math.sin(t * 8))
    d.polygon([(cx, cy - s), (cx + s * 0.25, cy - s * 0.25), (cx + s, cy), (cx + s * 0.25, cy + s * 0.25),
               (cx, cy + s), (cx - s * 0.25, cy + s * 0.25), (cx - s, cy), (cx - s * 0.25, cy - s * 0.25)], fill=col)


def room(d, top=STAGE_TOP, floor=1290, bottom=1400, wall=WALL, planks=True):
    d.rectangle([0, top, W, floor], fill=wall)
    d.rectangle([0, floor, W, bottom], fill=FLOOR_D)
    if planks:
        for x in range(0, W + 60, 120):
            d.line([x, floor, x - 40, bottom], fill=(160, 124, 90), width=3)


def panel_box(d, x0, y0, x1, y1, col=WALL, r=24):
    d.rounded_rectangle([x0, y0, x1, y1], r, fill=col)


def wipe_k(t, a, b):
    return ease_io(seg(t, a, b))


# ---------------------------------------------------------------- iconos
def icon(d, kind, cx, cy, s=1.0, col=None, k=1.0):
    if k <= 0:
        return
    s *= k
    if kind == 'bulb':
        c = col or YELLOW
        d.ellipse([cx - 40 * s, cy - 60 * s, cx + 40 * s, cy + 20 * s], fill=c, outline=INK, width=3)
        d.rectangle([cx - 20 * s, cy + 18 * s, cx + 20 * s, cy + 48 * s], fill=STEEL, outline=INK, width=3)
    elif kind == 'drop':
        c = col or BLUE
        d.polygon([(cx, cy - 60 * s), (cx + 38 * s, cy + 5 * s), (cx - 38 * s, cy + 5 * s)], fill=c)
        d.ellipse([cx - 38 * s, cy - 30 * s, cx + 38 * s, cy + 45 * s], fill=c)
    elif kind == 'sun':
        c = col or (245, 170, 40)
        for i in range(8):
            a = i * math.pi / 4
            d.line([cx + 46 * s * math.cos(a), cy + 46 * s * math.sin(a), cx + 66 * s * math.cos(a), cy + 66 * s * math.sin(a)], fill=c, width=max(2, int(8 * s)))
        d.ellipse([cx - 36 * s, cy - 36 * s, cx + 36 * s, cy + 36 * s], fill=c)
    elif kind == 'bottle':
        c = col or (120, 170, 220)
        d.rounded_rectangle([cx - 38 * s, cy - 40 * s, cx + 38 * s, cy + 70 * s], int(14 * s), fill=c, outline=INK, width=3)
        d.rectangle([cx - 16 * s, cy - 70 * s, cx + 16 * s, cy - 40 * s], fill=c, outline=INK, width=3)
        d.rectangle([cx - 22 * s, cy - 84 * s, cx + 22 * s, cy - 70 * s], fill=RED)
    elif kind == 'cloth':
        c = col or (110, 180, 200)
        d.polygon([(cx - 60 * s, cy - 30 * s), (cx + 55 * s, cy - 40 * s), (cx + 65 * s, cy + 35 * s), (cx - 50 * s, cy + 40 * s)], fill=c, outline=INK)
        for i in range(3):
            d.line([cx - 40 * s, cy - 15 * s + i * 22 * s, cx + 45 * s, cy - 22 * s + i * 22 * s], fill=mix(c, INK, 0.25), width=3)
    elif kind == 'plug':
        d.rounded_rectangle([cx - 40 * s, cy - 50 * s, cx + 40 * s, cy + 50 * s], int(10 * s), fill=WHITE, outline=INK, width=3)
        for dx in (-14, 14):
            d.ellipse([cx + dx * s - 6 * s, cy - 10 * s, cx + dx * s + 6 * s, cy + 6 * s], fill=INK)
    elif kind == 'flame':
        c = col or ACC
        d.polygon([(cx, cy - 60 * s), (cx + 34 * s, cy + 10 * s), (cx + 22 * s, cy + 46 * s), (cx - 22 * s, cy + 46 * s), (cx - 34 * s, cy + 10 * s)], fill=c)
        d.polygon([(cx, cy - 10 * s), (cx + 14 * s, cy + 22 * s), (cx, cy + 44 * s), (cx - 14 * s, cy + 22 * s)], fill=YELLOW)
    elif kind == 'phone':
        d.rounded_rectangle([cx - 60 * s, cy - 110 * s, cx + 60 * s, cy + 110 * s], int(18 * s), fill=INK)
        d.rounded_rectangle([cx - 50 * s, cy - 92 * s, cx + 50 * s, cy + 92 * s], int(8 * s), fill=col or (230, 240, 236))
    elif kind == 'camera':
        d.rounded_rectangle([cx - 70 * s, cy - 40 * s, cx + 70 * s, cy + 50 * s], int(14 * s), fill=INK)
        d.rectangle([cx - 24 * s, cy - 58 * s, cx + 24 * s, cy - 40 * s], fill=INK)
        d.ellipse([cx - 32 * s, cy - 27 * s, cx + 32 * s, cy + 37 * s], fill=STEEL, outline=WHITE, width=4)
    elif kind == 'chat':
        c = col or GREEN
        d.rounded_rectangle([cx - 70 * s, cy - 50 * s, cx + 70 * s, cy + 40 * s], int(30 * s), fill=c)
        d.polygon([(cx - 40 * s, cy + 30 * s), (cx - 60 * s, cy + 70 * s), (cx - 10 * s, cy + 38 * s)], fill=c)
        for dx in (-34, 0, 34):
            d.ellipse([cx + dx * s - 9 * s, cy - 14 * s, cx + dx * s + 9 * s, cy + 4 * s], fill=WHITE)
    elif kind == 'house':
        c = col or ACC
        d.polygon([(cx, cy - 70 * s), (cx + 80 * s, cy), (cx - 80 * s, cy)], fill=c)
        d.rectangle([cx - 60 * s, cy, cx + 60 * s, cy + 70 * s], fill=c)
        d.rectangle([cx - 16 * s, cy + 24 * s, cx + 16 * s, cy + 70 * s], fill=BG)
    elif kind == 'key':
        c = col or GOLD
        d.ellipse([cx - 50 * s, cy - 24 * s, cx - 2 * s, cy + 24 * s], outline=c, width=max(3, int(12 * s)))
        d.line([cx - 4 * s, cy, cx + 60 * s, cy], fill=c, width=max(3, int(12 * s)))
        d.line([cx + 40 * s, cy, cx + 40 * s, cy + 20 * s], fill=c, width=max(3, int(10 * s)))
    elif kind == 'heart':
        c = col or RED
        d.ellipse([cx - 44 * s, cy - 40 * s, cx + 2 * s, cy + 6 * s], fill=c)
        d.ellipse([cx - 2 * s, cy - 40 * s, cx + 44 * s, cy + 6 * s], fill=c)
        d.polygon([(cx - 42 * s, cy - 8 * s), (cx + 42 * s, cy - 8 * s), (cx, cy + 46 * s)], fill=c)


# ---------------------------------------------------------------- muebles
def handle_bar(d, x, y, vertical=True, l=60, col=INK):
    if vertical:
        d.rounded_rectangle([x - 4, y - l / 2, x + 4, y + l / 2], 4, fill=col)
    else:
        d.rounded_rectangle([x - l / 2, y - 4, x + l / 2, y + 4], 4, fill=col)


def base_cab(d, x0, y_floor, w, h=300, kind='doors', col=FIN, counter=(120, 80, 46), k=1.0, open_k=0.0, handles=True):
    """Gabinete bajo. kind: doors | drawers."""
    if k <= 0:
        return
    hh = h * k
    y0 = y_floor - hh
    d.rectangle([x0, y_floor - 26, x0 + w, y_floor], fill=INK)
    d.rectangle([x0, y0, x0 + w, y_floor - 26], fill=col, outline=mix(col, (0, 0, 0), 0.3), width=3)
    if kind == 'doors':
        d.line([x0 + w / 2, y0 + 6, x0 + w / 2, y_floor - 30], fill=mix(col, (0, 0, 0), 0.35), width=3)
        if handles:
            handle_bar(d, x0 + w / 2 - 22, y0 + 60, True, 60, GOLD)
            handle_bar(d, x0 + w / 2 + 22, y0 + 60, True, 60, GOLD)
    else:
        n = 3
        ch = (hh - 26) / n
        for i in range(n):
            yy = y0 + i * ch
            off = open_k * 90 if i == 0 else 0
            if i:
                d.line([x0 + 6, yy, x0 + w - 6, yy], fill=mix(col, (0, 0, 0), 0.35), width=3)
            if handles:
                handle_bar(d, x0 + w / 2, yy + 30 + off * 0, False, 90, GOLD)
    if counter:
        d.rectangle([x0 - 10, y0 - 24, x0 + w + 10, y0], fill=counter)


def wall_cab(d, x0, y0, w, h=240, col=FIN, k=1.0, handles=True):
    if k <= 0:
        return
    hh = h * k
    d.rectangle([x0, y0, x0 + w, y0 + hh], fill=col, outline=mix(col, (0, 0, 0), 0.3), width=3)
    d.line([x0 + w / 2, y0 + 6, x0 + w / 2, y0 + hh - 6], fill=mix(col, (0, 0, 0), 0.35), width=3)
    if handles and hh > 80:
        handle_bar(d, x0 + w / 2 - 22, y0 + hh - 50, True, 50, GOLD)
        handle_bar(d, x0 + w / 2 + 22, y0 + hh - 50, True, 50, GOLD)


def kitchen2(d, x0, y_floor, w, n=4, col=FIN, lower='doors', upper='normal', upper_top=None, k=1.0, led=0.0,
             hood=True, sink=True, ceiling=STAGE_TOP + 20, handles=True, base_h=300, upper_h=240, gap=200):
    """upper: normal | tall | none."""
    cw = w / n
    for i in range(n):
        q = ease(seg(k, i * 0.1, i * 0.1 + 0.5))
        kind = lower if not isinstance(lower, list) else lower[i]
        ci = col[i % len(col)] if isinstance(col, list) else col
        base_cab(d, x0 + i * cw + 3, y_floor, cw - 6, base_h, kind, ci, k=q, handles=handles)
    y_counter = y_floor - base_h - 24
    if sink and k > 0.6:
        sx = x0 + cw * 0.5
        d.rectangle([sx - 60, y_counter - 6, sx + 60, y_counter + 4], fill=STEEL)
        d.line([sx + 30, y_counter - 6, sx + 30, y_counter - 70], fill=STEEL, width=8)
        d.line([sx + 30, y_counter - 70, sx, y_counter - 70], fill=STEEL, width=8)
    if upper == 'none':
        return
    top_y = y_counter - gap - upper_h
    hgt = upper_h
    if upper == 'tall':
        hgt = (y_counter - gap) - ceiling
        top_y = ceiling
    for i in range(n):
        if hood and i == 2:
            hx = x0 + i * cw
            q = ease(seg(k, 0.5, 0.9))
            if q > 0:
                d.polygon([(hx + 30, y_counter - gap), (hx + cw - 30, y_counter - gap), (hx + cw - 70, y_counter - gap - 80), (hx + 70, y_counter - gap - 80)], fill=STEEL, outline=INK)
                d.rectangle([hx + cw / 2 - 30, top_y if upper == 'tall' else y_counter - gap - upper_h, hx + cw / 2 + 30, y_counter - gap - 80], fill=STEEL)
            continue
        q = ease(seg(k, 0.4 + i * 0.1, 0.4 + i * 0.1 + 0.5))
        ci = col[(i + 1) % len(col)] if isinstance(col, list) else col
        wall_cab(d, x0 + i * cw + 3, top_y, cw - 6, hgt, ci, q, handles)
    if led > 0:
        y = y_counter - gap
        glow = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        g = ImageDraw.Draw(glow)
        for i in range(n):
            if hood and i == 2:
                continue
            xa, xb = x0 + i * cw + 10, x0 + (i + 1) * cw - 10
            g.polygon([(xa, y), (xb, y), (xb + 30, y_counter), (xa - 30, y_counter)], fill=(255, 236, 170, int(120 * led)))
            d.rectangle([xa, y, xb, y + 6], fill=mix(STEEL, (255, 244, 200), led))
        return glow


def paste(img, overlay):
    if overlay is not None:
        img.paste(overlay, (0, 0), overlay)


def tv(d, cx, cy, w, t=0.0, k=1.0):
    if k <= 0:
        return
    w *= k
    h = w * 0.56
    d.rounded_rectangle([cx - w / 2 - 12, cy - h / 2 - 12, cx + w / 2 + 12, cy + h / 2 + 12], 14, fill=INK)
    d.rectangle([cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2], fill=mix((40, 70, 110), SKY, 0.5 + 0.5 * math.sin(t * 2.5)))


def tv_unit(d, cx, y_floor, w, h=200, col=FIN, floating=False, k=1.0, top=(120, 80, 46)):
    if k <= 0:
        return
    w *= k
    y1 = y_floor - (120 if floating else 30)
    y0 = y1 - h
    if not floating:
        for lx in (cx - w / 2 + 40, cx + w / 2 - 60):
            d.rectangle([lx, y1, lx + 20, y_floor], fill=INK)
    d.rectangle([cx - w / 2, y0, cx + w / 2, y1], fill=col, outline=mix(col, (0, 0, 0), 0.3), width=3)
    d.rectangle([cx - w / 2 - 10, y0 - 20, cx + w / 2 + 10, y0], fill=top)
    n = max(2, int(w // 260))
    for i in range(1, n):
        x = cx - w / 2 + w * i / n
        d.line([x, y0 + 6, x, y1 - 6], fill=mix(col, (0, 0, 0), 0.35), width=3)
    for i in range(n):
        x = cx - w / 2 + w * (i + 0.5) / n
        handle_bar(d, x, y0 + 40, False, 60, GOLD)
    return y0 - 20


def cables(d, x, y_top, y_bot, t, k=1.0, n=4):
    if k <= 0:
        return
    cols = [INK, (90, 90, 90), (40, 40, 40), (120, 110, 100)]
    for i in range(n):
        pts = []
        for j in range(30):
            u = j / 29
            yy = y_top + (y_bot - y_top) * u * k
            xx = x + (i - n / 2) * 18 + 40 * math.sin(u * 7 + i * 1.7) * u
            pts.append((xx, yy))
        d.line(pts, fill=cols[i % 4], width=7)


def door_swing(d, x_hinge, y0, w, h, ang, col=FIN, side=1):
    """Puerta vista de frente girando sobre la bisagra; ang 0=cerrada, 1=abierta 90°."""
    ww = w * math.cos(ang * math.pi / 2)
    if ww < 2:
        d.rectangle([x_hinge - 4, y0, x_hinge + 4, y0 + h], fill=mix(col, (0, 0, 0), 0.3))
        return
    xa, xb = (x_hinge, x_hinge + side * ww)
    skew = 30 * math.sin(ang * math.pi / 2)
    pts = [(xa, y0), (xb, y0 - skew), (xb, y0 + h + skew), (xa, y0 + h)]
    d.polygon(pts, fill=col, outline=mix(col, (0, 0, 0), 0.35))
    handle_bar(d, xa + side * ww * 0.85, y0 + h * 0.5, True, 60, GOLD)


def bed(d, cx, y_floor, w=760, drawers=0.0, col=WOOD, blanket=(120, 160, 190)):
    h = 170
    y0 = y_floor - h
    d.rectangle([cx - w / 2 - 20, y0 - 200, cx - w / 2 + 30, y_floor], fill=mix(col, (0, 0, 0), 0.15))
    d.rectangle([cx - w / 2, y0, cx + w / 2, y_floor - 10], fill=col, outline=mix(col, (0, 0, 0), 0.3), width=3)
    d.rounded_rectangle([cx - w / 2 + 10, y0 - 70, cx + w / 2, y0 + 10], 30, fill=blanket)
    d.rounded_rectangle([cx - w / 2 + 50, y0 - 110, cx - w / 2 + 230, y0 - 40], 30, fill=WHITE, outline=(210, 210, 210), width=2)
    if drawers > 0:
        for i in range(2):
            dw = w / 2 - 50
            x = cx - w / 2 + 30 + i * (dw + 40)
            off = 60 * drawers
            d.rectangle([x, y0 + 30 + off * 0.2, x + dw, y_floor - 20 + off * 0.2], fill=mix(col, WHITE, 0.15), outline=INK, width=3)
            handle_bar(d, x + dw / 2, y0 + 60 + off * 0.2, False, 90, INK)


def drawer_box(d, cx, cy, w=520, h=200, open_k=0.0, col=WOOD_L, front=FIN, stuff=True):
    """Cajón visto de frente-arriba: el cuerpo sale hacia abajo al abrir."""
    off = 220 * ease(open_k)
    if off > 4:
        d.polygon([(cx - w / 2 + 20, cy - h / 2), (cx + w / 2 - 20, cy - h / 2), (cx + w / 2, cy - h / 2 + off), (cx - w / 2, cy - h / 2 + off)], fill=col, outline=mix(col, (0, 0, 0), 0.3))
        if stuff:
            for i, c in enumerate([(200, 80, 70), (80, 130, 200), (230, 190, 70)]):
                x = cx - w / 3 + i * w / 3
                d.rounded_rectangle([x - 60, cy - h / 2 + off * 0.2, x + 60, cy - h / 2 + off * 0.85], 12, fill=c)
    d.rectangle([cx - w / 2, cy - h / 2 + off, cx + w / 2, cy + h / 2 + off], fill=front, outline=mix(front, (0, 0, 0), 0.35), width=3)
    handle_bar(d, cx, cy + off, False, 140, GOLD)


def gift_box(d, cx, cy, s=1.0, col=WOOD, text=None, engrave=0.0, lid=0.0, ribbon=RED):
    w, h = 360 * s, 260 * s
    board(d, cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2, col=col, seed=4)
    lid_off = -180 * s * ease(lid)
    board(d, cx - w / 2 - 14, cy - h / 2 - 50 * s + lid_off, cx + w / 2 + 14, cy - h / 2 + lid_off, col=mix(col, WHITE, 0.1), seed=7)
    if ribbon and lid < 0.05:
        d.rectangle([cx - 16 * s, cy - h / 2 - 50 * s, cx + 16 * s, cy + h / 2], fill=ribbon)
        d.ellipse([cx - 70 * s, cy - h / 2 - 100 * s, cx - 4 * s, cy - h / 2 - 46 * s], outline=ribbon, width=int(14 * s))
        d.ellipse([cx + 4 * s, cy - h / 2 - 100 * s, cx + 70 * s, cy - h / 2 - 46 * s], outline=ribbon, width=int(14 * s))
    if text and engrave > 0:
        engrave_text(d, cx, cy + 20 * s, text, int(64 * s), engrave)


def engrave_text(d, cx, cy, text, size, k, col=(92, 56, 28)):
    """Texto 'grabado' que aparece de izquierda a derecha."""
    f = font(size, 'ExtraBold')
    bb = d.textbbox((0, 0), text, font=f)
    w = bb[2] - bb[0]
    x0 = cx - w / 2 - bb[0]
    tmp = Image.new('L', (int(w + 20), int(size * 1.6)), 0)
    ImageDraw.Draw(tmp).text((10 - bb[0], size * 0.3), text, font=f, fill=255)
    cut = int((w + 20) * clamp(k))
    if cut <= 0:
        return None
    mask = Image.new('L', tmp.size, 0)
    mask.paste(tmp.crop((0, 0, cut, tmp.size[1])), (0, 0))
    d._image.paste(col, (int(x0 - 10), int(cy - size * 0.8)), mask)
    return x0 - 10 + cut


def laser_head(d, x, y_beam_end, t, on=True):
    d.rectangle([60, 640, W - 60, 680], fill=(90, 90, 98))
    d.rounded_rectangle([x - 50, 620, x + 50, 720], 12, fill=(60, 60, 68), outline=INK, width=3)
    if on:
        d.line([x, 720, x, y_beam_end], fill=(255, 60, 40), width=5)
        r = 14 + 4 * math.sin(t * 40)
        d.ellipse([x - r, y_beam_end - r, x + r, y_beam_end + r], fill=(255, 200, 120))
        rnd = random.Random(int(t * FPS))
        for i in range(6):
            px, py = x + rnd.uniform(-30, 30), y_beam_end - rnd.uniform(10, 80)
            d.ellipse([px - 6, py - 6, px + 6, py + 6], fill=(200, 200, 200))


def cutting_board(d, cx, cy, w=600, h=380, col=WOOD, text=None, engrave=0.0, sub=None):
    d.rounded_rectangle([cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2], 50, fill=col, outline=mix(col, (0, 0, 0), 0.3), width=4)
    d.ellipse([cx + w / 2 - 90, cy - 30, cx + w / 2 - 40, cy + 20], fill=BG)
    end = None
    if text and engrave > 0:
        end = engrave_text(d, cx - 30, cy - (30 if sub else 0), text, 70, engrave)
    if sub and engrave > 0.6:
        engrave_text(d, cx - 30, cy + 60, sub, 40, (engrave - 0.6) / 0.4)
    return end


def stool(d, x, y_floor, h=300, col=INK, seat=WOOD):
    d.line([x - 40, y_floor, x - 20, y_floor - h], fill=col, width=8)
    d.line([x + 40, y_floor, x + 20, y_floor - h], fill=col, width=8)
    d.line([x - 32, y_floor - h * 0.35, x + 32, y_floor - h * 0.35], fill=col, width=6)
    d.rounded_rectangle([x - 60, y_floor - h - 24, x + 60, y_floor - h], 10, fill=seat)


def counter_shop(d, cx, y_floor, w=760, h=380, col=FIN, top=WOOD, logo=0.0, logo_text='TU LOGO'):
    y0 = y_floor - h
    d.rectangle([cx - w / 2, y0, cx + w / 2, y_floor], fill=col, outline=mix(col, (0, 0, 0), 0.3), width=3)
    d.rectangle([cx - w / 2 - 30, y0 - 30, cx + w / 2 + 30, y0], fill=top)
    for i in range(1, 6):
        x = cx - w / 2 + w * i / 6
        d.line([x, y0 + 20, x, y_floor - 20], fill=mix(col, (0, 0, 0), 0.25), width=3)
    if logo > 0:
        a = back(logo)
        d.rounded_rectangle([cx - 230 * a, y0 + h / 2 - 70 * a, cx + 230 * a, y0 + h / 2 + 70 * a], int(30 * a), fill=ACC)
        text_c(d, cx, y0 + h / 2 - 4, logo_text, 60, 'Black', fill=WHITE, scale=a)


def washer(d, x0, y_floor, s=1.0):
    w, h = 300 * s, 360 * s
    y0 = y_floor - h
    d.rounded_rectangle([x0, y0, x0 + w, y_floor], 18, fill=(240, 240, 240), outline=INK, width=3)
    d.line([x0, y0 + 70 * s, x0 + w, y0 + 70 * s], fill=INK, width=2)
    d.ellipse([x0 + w / 2 - 95 * s, y0 + 120 * s, x0 + w / 2 + 95 * s, y0 + 310 * s], fill=(190, 210, 225), outline=INK, width=5)
    d.ellipse([x0 + 26 * s, y0 + 24 * s, x0 + 50 * s, y0 + 48 * s], fill=ACC)


def shoe(d, x, y, s=1.0, col=(170, 70, 60), ang=0.0):
    c, sn = math.cos(ang), math.sin(ang)
    pts = [(-50, 0), (-50, -40), (-10, -40), (10, -20), (50, -14), (54, 0)]
    pts = [(x + (px * c - py * sn) * s, y + (px * sn + py * c) * s) for px, py in pts]
    d.polygon(pts, fill=col, outline=INK)


def level_tool(d, cx, cy, w=520, bubble=0.0):
    d.rounded_rectangle([cx - w / 2, cy - 40, cx + w / 2, cy + 40], 12, fill=YELLOW, outline=INK, width=4)
    d.rounded_rectangle([cx - 80, cy - 20, cx + 80, cy + 20], 20, fill=(200, 235, 170), outline=INK, width=3)
    d.line([cx - 26, cy - 20, cx - 26, cy + 20], fill=INK, width=3)
    d.line([cx + 26, cy - 20, cx + 26, cy + 20], fill=INK, width=3)
    bx = cx + 50 * bubble
    d.ellipse([bx - 18, cy - 14, bx + 18, cy + 14], fill=WHITE)


def stairs(d, x0, y_floor, n=6, step_w=110, step_h=95, col=WOOD, storage=0.0, scol=FIN):
    for i in range(n):
        x = x0 + i * step_w
        y = y_floor - (i + 1) * step_h
        d.rectangle([x, y, x + step_w, y + 20], fill=col, outline=mix(col, (0, 0, 0), 0.3), width=2)
    d.polygon([(x0, y_floor), (x0 + n * step_w, y_floor - n * step_h), (x0 + n * step_w, y_floor - n * step_h + 30), (x0 + 30, y_floor)], fill=mix(col, (0, 0, 0), 0.2))
    if storage > 0:
        for i in range(n - 1):
            q = ease(seg(storage, i / n, i / n + 0.4))
            if q <= 0:
                continue
            x = x0 + 30 + i * step_w
            top = y_floor - (i + 1) * step_h + 30
            d.rectangle([x + 4, top + (y_floor - top) * (1 - q), x + step_w - 4, y_floor - 4], fill=scol, outline=mix(scol, (0, 0, 0), 0.35), width=3)
            handle_bar(d, x + step_w / 2, top + 40, False, 50, GOLD)


def xmas_tree(d, cx, y_floor, h=420, t=0.0):
    d.rectangle([cx - 20, y_floor - 60, cx + 20, y_floor], fill=WOOD_D)
    for i in range(3):
        w = 300 - i * 70
        yb = y_floor - 50 - i * (h * 0.24)
        d.polygon([(cx - w / 2, yb), (cx + w / 2, yb), (cx, yb - h * 0.42)], fill=(46, 120, 70))
    rnd = random.Random(3)
    for i in range(12):
        px = cx + rnd.uniform(-110, 110) * (1 - i / 14)
        py = y_floor - 80 - i * h * 0.06
        on = (math.sin(t * 5 + i) > 0)
        c = [RED, YELLOW, SKY][i % 3] if on else mix([RED, YELLOW, SKY][i % 3], INK, 0.4)
        d.ellipse([px - 10, py - 10, px + 10, py + 10], fill=c)
    sparkle(d, cx, y_floor - h - 10, t, 34)


def hanger(d, cx, y_rod, w=120, shirt=(80, 130, 200), long=False):
    d.line([cx, y_rod, cx, y_rod + 20], fill=INK, width=4)
    d.line([cx - w / 2, y_rod + 50, cx, y_rod + 20, cx + w / 2, y_rod + 50], fill=INK, width=4)
    if shirt:
        hh = 330 if long else 200
        d.polygon([(cx - w / 2, y_rod + 50), (cx + w / 2, y_rod + 50), (cx + w / 2 - 10, y_rod + 50 + hh), (cx - w / 2 + 10, y_rod + 50 + hh)], fill=shirt)


def wall_panel_door(d, x0, y0, x1, y1, open_k=0.0, col=WOOD_L):
    """Pared de paneles con una puerta escondida en medio."""
    n = 5
    pw = (x1 - x0) / n
    for i in range(n):
        board(d, x0 + i * pw + 2, y0, x0 + (i + 1) * pw - 2, y1, col=col, seed=20 + i, grain=True)
    dx0, dx1 = x0 + 2 * pw + 2, x0 + 3 * pw - 2
    if open_k > 0:
        d.rectangle([dx0, y0, dx1, y1], fill=(60, 50, 40))
        d.rectangle([dx0 + 10, y1 - 300, dx1 - 10, y1], fill=(90, 80, 70))
        door_swing(d, dx0, y0, dx1 - dx0, y1 - y0, open_k * 0.75, col=col, side=1)
