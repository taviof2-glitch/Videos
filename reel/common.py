"""Fábricas de escenas y registro de videos."""
from props import *
from PIL import Image

VIDEOS = {}      # id -> dict

CTA_STD = ("House Lite, carpintería y muebles en Tepatitlán. Cotiza por WhatsApp al tres, siete, ocho... "
           "uno, siete, cero... ochenta y dos, setenta y ocho.")


def _apply(img, res):
    if isinstance(res, Image.Image):
        if res.mode == 'RGBA':
            img.paste(res, (0, 0), res)
        else:
            img.paste(res, (0, 0))


def scene(label, title, title2=None, cap=None, draw=None, col=ACC, n=1):
    def fn(t, D):
        img, d = new()
        if draw:
            _apply(img, draw(img, d, t))
        tag_header(d, t, label, title, title2, col)
        if cap:
            caption(d, t, cap, 0.6)
        dots(d, n, 6)
        return img
    fn.n = n
    return fn


def hook(lines, draw=None, cap=None, stop=False, y0=None):
    def fn(t, D):
        img, d = new()
        if draw:
            _apply(img, draw(img, d, t))
        if stop:
            alto(d, t)
        yy = y0 if y0 else (360 if stop else 300)
        hook_text(d, t, lines, yy, start=0.15 if stop else 0.0)
        if cap:
            caption(d, t, cap, 1.2)
        return img
    return fn


def video(vid, date, slug, narr, scenes, yt_title, caption_text, tags, cover):
    assert len(narr) == 6 and len(scenes) == 5, vid
    fns = [scenes[0]] + [s(i) for i, s in enumerate(scenes[1:], 1)]
    VIDEOS[vid] = dict(id=vid, date=date, slug=slug, narr=narr, fns=fns + [s_cta],
                       nominal=[3.0, 3.2, 3.2, 3.2, 3.2, 5.0], yt_title=yt_title,
                       caption=caption_text, tags=tags, cover=cover)


def S(label, title, title2=None, cap=None, col=ACC):
    """Decorador: define una escena de contenido; el número de punto se asigna al registrar."""
    def deco(draw):
        def factory(n):
            return scene(label, title, title2, cap, draw, col, n)
        factory.is_factory = True
        return factory
    return deco


def HK(lines, cap=None, stop=False, y0=None):
    def deco(draw):
        return hook(lines, draw, cap, stop, y0)
    return deco


# ------------------------------------------------------------ helpers de escena
def list_rows(d, t, rows, y0=700, gap=200, start=0.3, step=0.45, size=54):
    """rows: [(icono, texto, estado)] estado: None | 'ok' | 'no'."""
    for i, (ic, s, st) in enumerate(rows):
        k = back(seg(t, start + i * step, start + i * step + 0.45))
        if k <= 0:
            continue
        y = y0 + i * gap
        x = 170 + 400 * (1 - ease(seg(t, start + i * step, start + i * step + 0.45))) * 0
        d.rounded_rectangle([110, y - 75, 970, y + 75], 36, fill=mix(BG, WHITE, 0.7 * clamp(k)))
        if ic:
            icon(d, ic, 210, y + (8 if ic in ('drop', 'bulb') else 0), 0.85, k=k)
        f = font(size, 'ExtraBold')
        col = mix(BG, INK, clamp(k))
        d.text((300, y - size * 0.62), s, font=f, fill=col)
        if st == 'ok':
            check(d, 900, y, 40, a=back(seg(t, start + i * step + 0.3, start + i * step + 0.7)))
        elif st == 'no':
            cross(d, 900, y, 40, a=back(seg(t, start + i * step + 0.3, start + i * step + 0.7)))


def dark_overlay(k, box=(0, STAGE_TOP, W, 1400), alpha=150):
    ov = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    if k > 0:
        ImageDraw.Draw(ov).rectangle(box, fill=INK + (int(alpha * k),))
    return ov


def big_mark(d, t, kind, cx=W / 2, cy=980, r=110, at=1.4):
    a = back(seg(t, at, at + 0.45))
    (check if kind == 'ok' else cross)(d, cx, cy, r, a=a)


def burst(d, cx, cy, s, t, at, col=RED, size=96):
    a = back(seg(t, at, at + 0.3)) * (1 - seg(t, at + 0.9, at + 1.2))
    if a <= 0:
        return
    pts = []
    for i in range(16):
        r = (150 if i % 2 == 0 else 95) * a
        ang = i * math.pi / 8
        pts.append((cx + r * math.cos(ang), cy + r * 0.75 * math.sin(ang)))
    d.polygon(pts, fill=YELLOW, outline=col)
    text_c(d, cx, cy - 4, s, size, 'Black', fill=col, scale=a)


def cover_frame(fn, t, D):
    return fn(t, D)
