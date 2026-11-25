"""Videos 1–10."""
from common import *


def desc(lines, tags):
    return '\n'.join(lines) + '\n\n🪵 House Lite · Carpintería y muebles\n📲 Cotiza por WhatsApp: 378 170 8278\nLunes a sábado, 9:00 a 20:00 · Envío gratis en Tepatitlán\n\n' + ' '.join(tags)


BASE_TAGS = ['#Tepatitlan', '#LosAltosDeJalisco', '#MueblesAMedida', '#Carpinteria']


def cab_front(d, cx, y_floor, w, h, col=FIN, n=2, top=(120, 80, 46), legs=True, handles=True):
    y1 = y_floor - (30 if legs else 0)
    y0 = y1 - h
    if legs:
        for lx in (cx - w / 2 + 30, cx + w / 2 - 50):
            d.rectangle([lx, y1, lx + 20, y_floor], fill=INK)
    d.rectangle([cx - w / 2, y0, cx + w / 2, y1], fill=col, outline=mix(col, (0, 0, 0), 0.3), width=3)
    if top:
        d.rectangle([cx - w / 2 - 10, y0 - 20, cx + w / 2 + 10, y0], fill=top)
    for i in range(1, n):
        x = cx - w / 2 + w * i / n
        d.line([x, y0 + 6, x, y1 - 6], fill=mix(col, (0, 0, 0), 0.35), width=3)
    if handles:
        for i in range(n):
            x = cx - w / 2 + w * (i + 0.5) / n
            handle_bar(d, x + (24 if i % 2 == 0 else -24) * (n > 1), y0 + 70, True, 60, GOLD)
    return y0


def ceiling(d, y=600):
    d.rectangle([0, y, W, y + 16], fill=INK)


# =================================================================== 1
@HK([('3 COSAS QUE', 88, INK), ('NO PONDRÍA', 124, ACC), ('EN MI COCINA', 96, INK)])
def v1_0(img, d, t):
    room(d, 680, 1330, 1420)
    kitchen2(d, 140, 1330, 800, k=ease(seg(t, 0.4, 1.4)), base_h=260, upper_h=170, gap=170)
    big_mark(d, t, 'no', 860, 780, 70, 1.6)


@S('1', 'ALACENAS CORTAS', cap=['Arriba se junta el polvo', 'y pierdes espacio'])
def v1_1(img, d, t):
    room(d, 600, 1330, 1400)
    ceiling(d, 600)
    kitchen2(d, 140, 1330, 800, base_h=240, upper_h=150, gap=150)
    a = ease(seg(t, 0.6, 1.3))
    rnd = random.Random(5)
    for i in range(int(46 * a)):
        x, y = rnd.uniform(150, 930), rnd.uniform(626, 756)
        r = rnd.uniform(4, 9)
        d.ellipse([x - r, y - r, x + r, y + r], fill=(160, 150, 140))
    pill(d, W / 2, 690, 'ESPACIO PERDIDO', RED, back(seg(t, 1.0, 1.4)), 40)
    big_mark(d, t, 'no', W / 2, 1000, 90, 1.9)


@S('2', 'PUERTAS ABAJO', cap=['Mejor cajones:', 'ves todo de un vistazo'])
def v1_2(img, d, t):
    panel_box(d, 90, 620, 990, 1360)
    k1, k2 = ease(seg(t, 0.3, 0.8)), ease(seg(t, 0.6, 1.1))
    base_cab(d, 150, 1250, 340, 380, 'doors', FIN, k=k1)
    base_cab(d, 590, 1250, 340, 380, 'drawers', FIN, k=k2)
    label(d, 320, 1310, 'PUERTAS', 44, INK, k1)
    label(d, 760, 1310, 'CAJONES', 44, INK, k2)
    cross(d, 320, 1030, 64, a=back(seg(t, 1.2, 1.6)))
    check(d, 760, 1030, 64, a=back(seg(t, 1.9, 2.3)))


@S('3', 'COCINA SIN LUZ', cap=['Cocinas en tu', 'propia sombra'])
def v1_3(img, d, t):
    room(d, 600, 1330, 1400)
    on = seg(t, 1.5, 1.8)
    ov = kitchen2(d, 140, 1330, 800, base_h=260, upper_h=200, gap=200, led=on)
    dk = dark_overlay(1 - on, alpha=130)
    img.paste(dk, (0, 0), dk)
    paste(img, ov)
    icon(ImageDraw.Draw(img), 'bulb', W / 2, 760, 1.2, k=back(seg(t, 1.6, 2.0)))
    check(ImageDraw.Draw(img), 860, 760, 56, a=back(seg(t, 2.2, 2.6)))


@S('RESULTADO', 'MÁS GRANDE', 'Y MÁS PRÁCTICA', cap=['Hasta el techo, cajones', 'y luz bajo alacenas'], col=GREEN)
def v1_4(img, d, t):
    room(d, 600, 1330, 1400)
    ceiling(d, 600)
    ov = kitchen2(d, 140, 1330, 800, lower='drawers', upper='tall', ceiling=616, base_h=260, gap=200, led=1, k=ease(seg(t, 0, 0.8)) * 0.4 + 0.6)
    paste(img, ov)
    d = ImageDraw.Draw(img)
    big_mark(d, t, 'ok', W / 2, 950, 90, 1.0)
    for i, (x, y) in enumerate([(200, 700), (880, 760), (520, 1200)]):
        sparkle(d, x, y, t + i, 30, k=ease(seg(t, 1.2 + i * 0.2, 1.6 + i * 0.2)))


video('01', '2026-11-30', 'cocina_3cosas', [
    'Tres cosas que yo NO pondría en mi cocina. La tercera casi nadie la toma en cuenta.',
    'Uno: alacenas que no llegan al techo. Arriba se junta el polvo y pierdes espacio.',
    'Dos: puertas en los gabinetes de abajo. Todo se pierde al fondo. Mejor cajones: ves todo de un vistazo.',
    'Tres: una cocina sin luz bajo las alacenas. Terminas cocinando en tu propia sombra.',
    'Con estos cambios tu cocina se ve más grande, y es mucho más práctica.',
    '¿Quieres una así? ' + CTA_STD],
    [v1_0, v1_1, v1_2, v1_3, v1_4],
    '3 cosas que NO pondría en mi cocina ❌ #shorts',
    desc(['3 cosas que NO pondría en mi cocina ❌',
          '1️⃣ Alacenas que no llegan al techo: se junta el polvo.',
          '2️⃣ Puertas abajo: todo se pierde al fondo. Mejor cajones.',
          '3️⃣ Cocina sin luz bajo las alacenas.',
          '¿Cuál de estas tiene tu cocina? 👇'], BASE_TAGS + ['#CocinasIntegrales', '#Remodelacion']),
    ['cocina integral', 'errores cocina', 'cocinas a la medida', 'alacenas', 'cajones cocina', 'Tepatitlan', 'carpinteria', 'House Lite'],
    'Vertical Shorts cover, flat illustration style, warm cream background. A modern dark gray kitchen with a big red X. Huge bold Spanish text at top: "3 COSAS QUE NO PONDRÍA EN MI COCINA" in dark brown with "NO" in orange. High contrast, no people.')


# =================================================================== 2
@HK([('¿TE DUELE', 96, INK), ('LA ESPALDA', 124, ACC), ('AL COCINAR?', 96, INK)])
def v2_0(img, d, t):
    room(d, 720, 1330, 1420)
    kitchen2(d, 140, 1330, 800, k=ease(seg(t, 0.4, 1.4)), base_h=260, upper_h=160, gap=180, )
    pill(d, 860, 800, '¡AY!', RED, back(seg(t, 1.5, 1.9)), 54)


@S('LA CUBIERTA', 'A 90 CM DEL PISO', cap=['Así no te agachas', 'de más'])
def v2_1(img, d, t):
    room(d, 600, 1330, 1400)
    kitchen2(d, 380, 1330, 600, n=3, upper='none', base_h=300, k=ease(seg(t, 0.2, 0.9)))
    dim_v(d, 320, 1006, 1330, '90 cm', seg(t, 0.9, 1.7), side=-1, size=60)
    check(d, 680, 800, 60, a=back(seg(t, 2.0, 2.4)))


def _kitchen_std(d, t, k=1.0):
    room(d, 600, 1330, 1400)
    kitchen2(d, 120, 1330, 760, base_h=300, upper_h=220, gap=220, k=k)
    d.rounded_rectangle([320, 900, 470, 1000], 10, fill=(60, 60, 66))
    d.rectangle([336, 916, 420, 984], fill=(120, 140, 160))


@S('EL ESPACIO', 'DE 50 A 60 CM', cap=['Para que quepan', 'tus aparatos'])
def v2_2(img, d, t):
    _kitchen_std(d, t)
    dim_v(d, 940, 786, 1006, '50-60 cm', seg(t, 0.6, 1.4), side=-1, size=50)


@S('LAS ALACENAS', 'QUE LAS ALCANCES', cap=['Sin subirte', 'a una silla'])
def v2_3(img, d, t):
    _kitchen_std(d, t)
    arrow(d, 690, 1000, 690, 830, ease(seg(t, 0.5, 1.2)), col=ACC, w=14, head=40)
    check(d, 790, 690, 56, a=back(seg(t, 1.4, 1.8)))


@S('RESULTADO', 'HECHA A TU MEDIDA', cap=['Si eres alto o bajito,', 'se ajusta a ti'], col=GREEN)
def v2_4(img, d, t):
    _kitchen_std(d, t)
    dim_v(d, 60, 1006, 1330, '', seg(t, 0.3, 0.9))
    dim_v(d, 940, 786, 1006, '', seg(t, 0.5, 1.1))
    big_mark(d, t, 'ok', W / 2, 1150, 90, 1.2)


video('02', '2026-12-01', 'cocina_altura', [
    '¿Te duele la espalda cuando cocinas? Puede ser la altura de tu cocina.',
    'La cubierta va más o menos a noventa centímetros del piso. Así no te agachas de más.',
    'Entre la cubierta y las alacenas deja de cincuenta a sesenta centímetros, para que quepan tus aparatos.',
    'Y las alacenas, que las alcances sin tener que subirte a una silla.',
    'Y si eres más alto o más bajito, se ajusta a tu medida. Para eso es a la medida.',
    CTA_STD],
    [v2_0, v2_1, v2_2, v2_3, v2_4],
    'La altura correcta de tu cocina 📏 (casi nadie la sabe) #shorts',
    desc(['¿Te duele la espalda al cocinar? 😣 Puede ser la altura de tu cocina.',
          '📏 Cubierta: más o menos a 90 cm del piso.',
          '📏 Entre cubierta y alacenas: de 50 a 60 cm.',
          '✅ Alacenas que alcances sin subirte a una silla.',
          '¿Tu cocina tiene buena altura? 👇'], BASE_TAGS + ['#CocinasIntegrales', '#Remodelacion']),
    ['altura cocina', 'medidas cocina integral', 'altura cubierta cocina', 'alacenas', 'cocinas a la medida', 'Tepatitlan', 'House Lite'],
    'Vertical Shorts cover, flat illustration: side of a kitchen counter with an orange measuring arrow labeled "90 cm". Huge bold Spanish text at top: "LA ALTURA CORRECTA DE TU COCINA" in dark brown and orange. Cream background, no people.')


# =================================================================== 3
@HK([('¿PUERTA', 124, INK), ('O PARED?', 150, ACC)])
def v3_0(img, d, t):
    room(d, 640, 1330, 1420, planks=True)
    wall_panel_door(d, 160, 680, 920, 1330, 0)
    a = 0.5 + 0.5 * math.sin(t * 6)
    if t > 1.2:
        pw = 760 / 5
        d.rectangle([160 + 2 * pw, 680, 160 + 3 * pw, 1330], outline=mix(WOOD_L, ACC, a), width=8)


@S('MIRA BIEN', 'UNA PARED NORMAL', cap=['Pero tiene', 'un secreto'])
def v3_1(img, d, t):
    room(d, 600, 1330, 1400)
    wall_panel_door(d, 140, 640, 860, 1330, 0)
    k = back(seg(t, 0.5, 1.0))
    if k > 0:
        d.polygon([(930 - 40 * k, 1330 - 120 * k), (930 + 40 * k, 1330 - 120 * k), (930 + 30 * k, 1330), (930 - 30 * k, 1330)], fill=ACC)
        for a in (-0.7, 0, 0.7):
            lx, ly = 930 + 90 * k * math.sin(a), 1210 - 120 * k * math.cos(a)
            d.ellipse([lx - 26 * k, ly - 46 * k, lx + 26 * k, ly + 46 * k], fill=PLANT)
    pill(d, 500, 980, '?', ACC, back(seg(t, 1.4, 1.8)), 90, pad=30)


@S('EL TRUCO', 'EMPUJAS Y SE ABRE', cap=['Una puerta', 'escondida'])
def v3_2(img, d, t):
    room(d, 600, 1330, 1400)
    k = ease(seg(t, 1.0, 2.2))
    wall_panel_door(d, 140, 640, 940, 1330, k)
    a = ease(seg(t, 0.2, 0.9)) * (1 - seg(t, 1.0, 1.2))
    if a > 0:
        arrow(d, 1040, 980, 860, 980, a, col=ACC, w=14, head=44)


@S('¿PARA QUÉ?', 'ESCONDER ESPACIOS', cap=['Lavado, bodega', 'u oficina'])
def v3_3(img, d, t):
    for i, (lab, kind) in enumerate([('LAVADO', 'w'), ('BODEGA', 'b'), ('OFICINA', 'o')]):
        k = back(seg(t, 0.3 + i * 0.4, 0.8 + i * 0.4))
        if k <= 0:
            continue
        cx = 210 + i * 330
        panel_box(d, cx - 145 * k, 700, cx + 145 * k, 1250)
        if kind == 'w':
            washer(d, cx - 100 * k, 1150, 0.66 * k)
        elif kind == 'b':
            for j in range(3):
                board(d, cx - 90 * k, 1150 - j * 110 * k - 100 * k, cx + 90 * k, 1150 - j * 110 * k, col=[WOOD, WOOD_L, MDF][j], seed=j)
        else:
            d.rectangle([cx - 120 * k, 1040, cx + 120 * k, 1060], fill=WOOD)
            d.rectangle([cx - 110 * k, 1060, cx - 95 * k, 1150], fill=INK)
            d.rectangle([cx + 95 * k, 1060, cx + 110 * k, 1150], fill=INK)
            tv(d, cx, 950, 150 * k)
        label(d, cx, 1200, lab, 40, INK, k)


@S('RESULTADO', 'ACABADO LIMPIO', cap=['Y se hace a la medida', 'de tu espacio'], col=GREEN)
def v3_4(img, d, t):
    room(d, 600, 1330, 1400)
    k = 1 - ease(seg(t, 0.2, 1.0))
    wall_panel_door(d, 140, 640, 940, 1330, k * 0.6)
    big_mark(d, t, 'ok', W / 2, 960, 90, 1.2)
    for i, (x, y) in enumerate([(220, 720), (860, 800), (300, 1230)]):
        sparkle(d, x, y, t + i, 30, k=ease(seg(t, 1.4 + i * 0.2, 1.8 + i * 0.2)))


video('03', '2026-12-02', 'puerta_oculta', [
    '¿Puerta o pared? Fíjate bien.',
    'Parece una pared de madera normal, pero tiene un secreto.',
    'Empujas uno de los paneles, y se abre una puerta escondida.',
    'Sirve para esconder el cuarto de lavado, una bodega o hasta tu oficina.',
    'Queda un acabado limpio, sin marcos a la vista. Y se puede hacer a la medida de tu espacio.',
    '¿Te gustaría algo así en tu casa? ' + CTA_STD],
    [v3_0, v3_1, v3_2, v3_3, v3_4],
    '¿Puerta o pared? 👀 La puerta oculta #shorts',
    desc(['¿Puerta o pared? 👀',
          'Parece una pared de madera normal… pero empujas un panel y se abre una puerta escondida.',
          'Ideal para esconder el cuarto de lavado, una bodega o tu oficina.',
          '¿La pondrías en tu casa? 👇'], BASE_TAGS + ['#DecoracionDeInteriores', '#Hogar']),
    ['puerta oculta', 'puerta escondida', 'paneles de madera', 'muebles a la medida', 'ideas para casa', 'Tepatitlan', 'House Lite'],
    'Vertical Shorts cover, flat illustration: a wall of light wood panels where one panel is slightly open revealing a hidden door. Huge bold Spanish text at top: "¿PUERTA O PARED?" with "PARED" in orange. Cream background, no people.')


# =================================================================== 4
@HK([('¿QUÉ REGALAR', 92, INK), ('ESTA', 110, ACC), ('NAVIDAD?', 140, ACC)])
def v4_0(img, d, t):
    room(d, 760, 1330, 1420)
    xmas_tree(d, 290, 1330, 470, t)
    k = back(seg(t, 0.6, 1.1))
    if k > 0:
        gift_box(d, 700, 1200, 0.85 * k)


@S('PASO 1', 'ELIGE EL DISEÑO', cap=['Un nombre, una fecha', 'o una frase'])
def v4_1(img, d, t):
    icon(d, 'phone', W / 2, 1000, 3.0, col=(250, 246, 240))
    for i, s in enumerate(['Familia López', 'Ana · 2026', 'Feliz Navidad']):
        k = back(seg(t, 0.4 + i * 0.4, 0.8 + i * 0.4))
        if k <= 0:
            continue
        y = 790 + i * 150
        sel = (i == 1 and t > 2.0)
        d.rounded_rectangle([W / 2 - 135 * k, y - 50, W / 2 + 135 * k, y + 50], 20, fill=ACC if sel else WHITE, outline=INK, width=3)
        text_c(d, W / 2, y - 2, s, 32, 'ExtraBold', fill=WHITE if sel else INK, scale=k)


@S('PASO 2', 'GRABADO LÁSER', cap=['En madera, en nuestro', 'taller de Tepatitlán'])
def v4_2(img, d, t):
    k = seg(t, 0.4, 2.6)
    end = cutting_board(d, W / 2, 1080, 780, 420, text='Familia López', engrave=k)
    x = end if end else W / 2 - 330
    laser_head(d, x, 1080, t, on=0 < k < 1)


@S('PASO 3', 'UN REGALO ÚNICO', cap=['Que nadie más', 'va a tener'])
def v4_3(img, d, t):
    k = back(seg(t, 0.2, 0.7))
    if k > 0:
        gift_box(d, W / 2, 1080, 1.4 * k, text='Para Ana', engrave=1 if k >= 1 else 0, ribbon=None)
    icon(d, 'heart', 830, 760, 1.2, k=back(seg(t, 1.0, 1.4)))
    for i, (x, y) in enumerate([(230, 780), (880, 1250), (200, 1280)]):
        sparkle(d, x, y, t + i, 30, k=ease(seg(t, 1.2 + i * 0.2, 1.6 + i * 0.2)))


@S('IDEAS', 'CAJAS, TABLAS', 'Y RECUERDOS', cap=['Pídelo con tiempo', 'para Navidad'])
def v4_4(img, d, t):
    k1, k2, k3 = [back(seg(t, 0.3 + i * 0.35, 0.8 + i * 0.35)) for i in range(3)]
    if k1 > 0:
        gift_box(d, 220, 1060, 0.55 * k1)
    if k2 > 0:
        cutting_board(d, 560, 1060, 300 * k2, 200 * k2, text='Ana' if k2 >= 1 else None, engrave=1)
    if k3 > 0:
        r = 110 * k3
        d.line([880, 1060 - r - 60, 880, 1060 - r], fill=RED, width=6)
        d.ellipse([880 - r, 1060 - r, 880 + r, 1060 + r], fill=WOOD_L, outline=WOOD_D, width=5)
        icon(d, 'heart', 880, 1062, 1.0 * k3, col=(150, 90, 50))


video('04', '2026-12-03', 'regalo_laser_navidad', [
    '¿No sabes qué regalar esta Navidad? Regala algo con su nombre.',
    'Primero eliges el diseño: un nombre, una fecha o una frase.',
    'Lo grabamos con láser en madera, aquí en nuestro taller de Tepatitlán.',
    'Y queda un regalo único, que nadie más va a tener.',
    'Cajas, tablas y recuerdos personalizados. Pídelo con tiempo para que esté listo en Navidad.',
    CTA_STD],
    [v4_0, v4_1, v4_2, v4_3, v4_4],
    'El regalo de Navidad que nadie más va a tener 🎁 #shorts',
    desc(['¿No sabes qué regalar esta Navidad? 🎁',
          'Regala algo con su nombre: lo grabamos con láser en madera, aquí en nuestro taller.',
          'Cajas, tablas y recuerdos personalizados ✨',
          'Pídelo con tiempo para que esté listo en Navidad.',
          '¿A quién se lo regalarías? 👇'], ['#Tepatitlan', '#LosAltosDeJalisco', '#GrabadoLaser', '#RegalosPersonalizados', '#Navidad', '#HechoEnMexico']),
    ['regalos personalizados', 'grabado laser', 'regalo navidad', 'regalos con nombre', 'Tepatitlan', 'House Lite'],
    'Vertical Shorts cover, flat illustration: a wooden gift box with a name laser-engraved and a red ribbon, next to a small Christmas tree. Huge bold Spanish text at top: "EL REGALO QUE NADIE MÁS TENDRÁ" in dark brown and orange. Cream background, no people.')


# =================================================================== 5
@HK([('¿TU MUEBLE', 96, INK), ('ES MÁS CHICO', 110, ACC), ('QUE TU TELE?', 96, INK)])
def v5_0(img, d, t):
    room(d, 700, 1320, 1420)
    tv(d, W / 2, 900, 640, t, back(seg(t, 0.4, 0.9)))
    tv_unit(d, W / 2, 1320, 360, 170, k=back(seg(t, 0.6, 1.1)))
    big_mark(d, t, 'no', 880, 760, 64, 1.6)


@S('EL ERROR', 'MUEBLE ANGOSTO', cap=['Se ve desproporcionado'])
def v5_1(img, d, t):
    room(d, 600, 1320, 1400)
    tv(d, W / 2, 830, 720, t)
    wob = 6 * math.sin(t * 9) * seg(t, 0.8, 1.2)
    tv_unit(d, W / 2 + wob, 1320, 400, 190)
    big_mark(d, t, 'no', W / 2, 830, 90, 1.4)


@S('LA REGLA', 'MÁS ANCHO', 'QUE LA TELE', cap=['Que sobre espacio', 'de cada lado'])
def v5_2(img, d, t):
    room(d, 600, 1320, 1400)
    tv(d, W / 2, 840, 520, t)
    tv_unit(d, W / 2, 1320, 880 * (0.5 + 0.5 * ease(seg(t, 0.3, 1.1))), 190)
    text_c(d, W / 2, 840, 'TV', 70, 'Black', fill=WHITE)
    text_c(d, W / 2, 1185, 'MUEBLE', 56, 'Black', fill=WHITE, alpha=1)
    dim_h(d, W / 2 - 260, W / 2 + 260, 650, '', seg(t, 1.1, 1.6))
    dim_h(d, W / 2 - 440, W / 2 + 440, 1360, '', seg(t, 1.4, 1.9))
    check(d, 900, 700, 56, a=back(seg(t, 2.0, 2.4)))


def _sala(d, t, items=1.0, unit_k=1.0):
    room(d, 600, 1320, 1400)
    tv(d, W / 2, 840, 520, t)
    top = tv_unit(d, W / 2, 1320, 880, 190, k=unit_k)
    k1, k2, k3 = [back(seg(items, i * 0.25, i * 0.25 + 0.4)) for i in range(3)]
    if k1 > 0:   # planta
        d.polygon([(170 - 40 * k1, top - 100 * k1), (170 + 40 * k1, top - 100 * k1), (170 + 30 * k1, top), (170 - 30 * k1, top)], fill=ACC)
        for a in (-0.7, 0, 0.7):
            lx, ly = 170 + 80 * k1 * math.sin(a), top - 100 * k1 - 100 * k1 * math.cos(a)
            d.ellipse([lx - 24 * k1, ly - 42 * k1, lx + 24 * k1, ly + 42 * k1], fill=PLANT)
    if k2 > 0:   # bocina
        d.rounded_rectangle([860, top - 200 * k2, 950, top], 12, fill=INK)
        d.ellipse([880, top - 90 * k2, 930, top - 40 * k2], fill=(90, 90, 98))
        d.ellipse([890, top - 170 * k2, 920, top - 140 * k2], fill=(90, 90, 98))
    if k3 > 0:   # libros
        for j, c in enumerate([(196, 82, 64), (70, 120, 170), (230, 190, 90)]):
            d.rectangle([270 + j * 30, top - (120 - j * 15) * k3, 296 + j * 30, top], fill=c)


@S('EXTRA', 'ESPACIO DE SOBRA', cap=['Para bocinas', 'y decoración'])
def v5_3(img, d, t):
    _sala(d, t, seg(t, 0.4, 2.0))


@S('RESULTADO', 'SALA EQUILIBRADA', cap=['Ordenada', 'y equilibrada'], col=GREEN)
def v5_4(img, d, t):
    _sala(d, t, 1.0)
    big_mark(d, t, 'ok', W / 2, 840, 90, 0.8)


video('05', '2026-12-04', 'mueble_tv_ancho', [
    '¿Tu mueble de TV es más chico que tu tele? Ese es el error.',
    'Cuando el mueble es más angosto que la pantalla, todo se ve desproporcionado.',
    'La regla: el mueble debe ser más ancho que la tele, y que sobre espacio de cada lado.',
    'Así también te queda lugar para bocinas, plantas y decoración.',
    'El resultado: una sala que se ve ordenada y equilibrada.',
    CTA_STD],
    [v5_0, v5_1, v5_2, v5_3, v5_4],
    'El error del mueble de TV que todos cometen 📺 #shorts',
    desc(['¿Tu mueble de TV es más chico que tu tele? 📺 Ese es el error.',
          '✅ La regla: el mueble debe ser más ancho que la pantalla, y que sobre espacio de cada lado.',
          'Así tu sala se ve ordenada y equilibrada.',
          '¿El tuyo pasa la prueba? 👇'], BASE_TAGS + ['#MuebleDeTV', '#DecoracionDeInteriores']),
    ['mueble de tv', 'centro de entretenimiento', 'medidas mueble tv', 'decoracion sala', 'muebles a la medida', 'Tepatitlan', 'House Lite'],
    'Vertical Shorts cover, flat illustration: a huge TV on top of a tiny TV stand with a red X, next to a wide TV stand with a green check. Huge bold Spanish text: "EL ERROR DEL MUEBLE DE TV". Cream background, no people.')


# =================================================================== 6
def kitchen_L_top(d, x0, y0, size, depth, mode='dead', t=0.0, k=1.0, pull=0.0):
    ctr = (120, 80, 46)
    floor_c = (226, 214, 196)
    d.rectangle([x0, y0, x0 + size, y0 + size], fill=floor_c)
    d.rectangle([x0, y0, x0 + size * k, y0 + depth], fill=ctr)
    d.rectangle([x0, y0, x0 + depth, y0 + size * k], fill=ctr)
    for i in range(1, 4):
        x = x0 + depth + (size - depth) * i / 4
        d.line([x, y0 + 6, x, y0 + depth - 6], fill=mix(ctr, (0, 0, 0), 0.3), width=3)
        y = y0 + depth + (size - depth) * i / 4
        d.line([x0 + 6, y, x0 + depth - 6, y], fill=mix(ctr, (0, 0, 0), 0.3), width=3)
    # parrilla y tarja
    gx = x0 + depth + (size - depth) * 0.6
    for dx in (-50, 50):
        for dy in (-40, 40):
            d.ellipse([gx + dx - 26, y0 + depth / 2 + dy - 26, gx + dx + 26, y0 + depth / 2 + dy + 26], outline=INK, width=6)
    sy = y0 + depth + (size - depth) * 0.6
    d.rounded_rectangle([x0 + 30, sy - 70, x0 + depth - 30, sy + 70], 16, fill=STEEL, outline=INK, width=3)
    c0, c1 = x0, x0 + depth
    cy0, cy1 = y0, y0 + depth
    if mode == 'dead':
        d.rectangle([c0, cy0, c1, cy1], fill=(60, 48, 38))
        text_c(d, (c0 + c1) / 2, (cy0 + cy1) / 2, '?', 110, 'Black', fill=ACC)
    else:
        d.rectangle([c0, cy0, c1, cy1], fill=mix(ctr, WHITE, 0.25))
        cx, cy = (c0 + c1) / 2 + pull * 120, (cy0 + cy1) / 2 + pull * 120
        r = depth * 0.42
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=STEEL, outline=INK, width=4)
        for i, c in enumerate([(196, 82, 64), (70, 120, 170), (230, 190, 90), (110, 150, 100)]):
            a = t * 2.2 + i * math.pi / 2
            px, py = cx + r * 0.55 * math.cos(a), cy + r * 0.55 * math.sin(a)
            d.ellipse([px - 22, py - 22, px + 22, py + 22], fill=c, outline=INK, width=2)


@HK([('LA ESQUINA', 110, INK), ('MUERTA', 150, ACC), ('DE TU COCINA', 92, INK)])
def v6_0(img, d, t):
    kitchen_L_top(d, 200, 720, 680, 200, 'dead', t, ease(seg(t, 0.4, 1.2)))


@S('EL PROBLEMA', 'UN HUECO SIN USO', cap=['Ahí se pierden', 'las cosas'])
def v6_1(img, d, t):
    kitchen_L_top(d, 160, 640, 760, 220, 'dead', t)
    for i, c in enumerate([(196, 82, 64), (70, 120, 170), (230, 190, 90)]):
        u = ease(seg(t, 0.4 + i * 0.35, 1.2 + i * 0.35))
        x = 160 + 600 - 480 * u
        y = 640 + 110 + 10 * i
        r = 26 * (1 - 0.8 * u)
        d.ellipse([x - r, y - r, x + r, y + r], fill=c, outline=INK)
    big_mark(d, t, 'no', 680, 1060, 90, 2.0)


@S('LA SOLUCIÓN', 'HERRAJE GIRATORIO', cap=['Charolas que giran', 'o salen hacia ti'])
def v6_2(img, d, t):
    kitchen_L_top(d, 160, 640, 760, 220, 'carousel', t * seg(t, 0.5, 0.8))
    pill(d, 640, 1080, 'GIRA', ACC, back(seg(t, 0.8, 1.2)), 54)
    arrow(d, 500, 1000, 360, 880, ease(seg(t, 1.0, 1.6)))


@S('EL BENEFICIO', 'TODO A LA MANO', cap=['Encuentras todo', 'sin agacharte tanto'])
def v6_3(img, d, t):
    kitchen_L_top(d, 160, 640, 760, 220, 'carousel', t, pull=ease(seg(t, 0.4, 1.3)))
    check(d, 720, 1060, 70, a=back(seg(t, 1.5, 1.9)))


@S('RESULTADO', 'CERO ESPACIO', 'PERDIDO', cap=['Tu esquina se vuelve', 'tu mejor espacio'], col=GREEN)
def v6_4(img, d, t):
    kitchen_L_top(d, 160, 640, 760, 220, 'carousel', t)
    big_mark(d, t, 'ok', 680, 1080, 90, 0.8)


video('06', '2026-12-05', 'esquina_cocina', [
    '¿Tienes una esquina en tu cocina donde las cosas desaparecen?',
    'En las cocinas en forma de L, la esquina queda como un hueco al que casi no llegas.',
    'La solución: un herraje giratorio, o charolas que salen hacia ti.',
    'Así aprovechas cada centímetro, y encuentras todo sin agacharte tanto.',
    'La esquina deja de ser un hueco, y se vuelve tu mejor espacio.',
    CTA_STD],
    [v6_0, v6_1, v6_2, v6_3, v6_4],
    'La esquina muerta de tu cocina (y cómo aprovecharla) 🔄 #shorts',
    desc(['¿Tienes una esquina en tu cocina donde las cosas desaparecen? 🫠',
          'En las cocinas en L, la esquina queda como un hueco al que casi no llegas.',
          '✅ La solución: un herraje giratorio o charolas que salen hacia ti.',
          '¿Tú qué guardas en esa esquina? 👇'], BASE_TAGS + ['#CocinasIntegrales', '#Remodelacion']),
    ['esquina cocina', 'cocina en L', 'herraje giratorio', 'organizar cocina', 'cocinas integrales', 'Tepatitlan', 'House Lite'],
    'Vertical Shorts cover, flat illustration top view of an L-shaped kitchen with a glowing rotating carousel shelf in the corner. Huge bold Spanish text: "LA ESQUINA MUERTA DE TU COCINA" with "MUERTA" in orange. Cream background, no people.')


# =================================================================== 7
def cab_frame(d, x0, y0, w, h):
    d.rectangle([x0 - 16, y0 - 16, x0 + w + 16, y0 + h + 16], fill=(90, 100, 108))
    d.rectangle([x0, y0, x0 + w, y0 + h], fill=(60, 48, 38))
    d.rectangle([x0, y0 + h / 2 - 8, x0 + w, y0 + h / 2 + 8], fill=WOOD_L)
    for j, c in enumerate([(196, 82, 64), (70, 120, 170), (230, 190, 90)]):
        d.rectangle([x0 + 40 + j * 110, y0 + h / 2 - 120, x0 + 120 + j * 110, y0 + h / 2 - 8], fill=c)


@HK([('¿ESCUCHAS UN', 88, INK), ('¡PUM!', 160, RED), ('AL CERRAR?', 96, INK)])
def v7_0(img, d, t):
    shake = 10 * math.sin(t * 60) * (seg(t, 1.0, 1.05) - seg(t, 1.2, 1.4))
    cab_frame(d, 290 + shake, 820, 500, 480)
    ang = 1 - ease_io(seg(t, 0.5, 1.0)) ** 2
    door_swing(d, 290 + shake, 820, 500, 480, ang if t < 1.0 else 0)


@S('BISAGRA NORMAL', 'LA PUERTA GOLPEA', cap=['Con el tiempo se afloja', 'y se desajusta'])
def v7_1(img, d, t):
    shake = 10 * math.sin(t * 60) * (seg(t, 1.0, 1.05) - seg(t, 1.2, 1.4))
    cab_frame(d, 290 + shake, 700, 500, 560)
    u = seg(t, 0.4, 1.0)
    door_swing(d, 290 + shake, 700, 500, 560, 1 - u ** 3)
    burst(d, 700, 760, '¡PUM!', t, 1.0)
    big_mark(d, t, 'no', 540, 1000, 90, 1.9)


@S('CIERRE SUAVE', 'FRENA Y CIERRA SOLA', cap=['Sin golpes', 'y sin ruido'], col=GREEN)
def v7_2(img, d, t):
    cab_frame(d, 290, 700, 500, 560)
    u = seg(t, 0.4, 2.2)
    door_swing(d, 290, 700, 500, 560, 1 - ease(u))
    a = ease(seg(t, 1.4, 1.8)) * (1 - seg(t, 2.4, 2.6))
    text_c(d, 860, 760, 'shhh…', 56, 'ExtraBold', fill=ACC, alpha=a)
    big_mark(d, t, 'ok', 540, 1000, 90, 2.4)


@S('VENTAJAS', 'TU MUEBLE DURA MÁS')
def v7_3(img, d, t):
    list_rows(d, t, [('house', 'Cuida tus muebles', 'ok'), ('heart', 'Protege los dedos', 'ok'), ('bulb', 'Cero ruido', 'ok')], y0=760, gap=230)


@S('RESULTADO', 'UN DETALLE', 'QUE SE NOTA', cap=['Todos los días'], col=GREEN)
def v7_4(img, d, t):
    room(d, 600, 1330, 1400)
    kitchen2(d, 140, 1330, 800, base_h=280, upper_h=200, gap=200)
    big_mark(d, t, 'ok', W / 2, 1150, 90, 0.8)


video('07', '2026-12-06', 'bisagras_cierre_suave', [
    '¿Escuchas un ¡pum! cada vez que alguien cierra la alacena?',
    'Con bisagras normales la puerta golpea. Con el tiempo se aflojan y se desajustan.',
    'Las bisagras de cierre suave frenan la puerta al final, y cierra sola, sin ruido.',
    'Cuidan tus muebles, protegen los dedos de los niños, y tu cocina dura más.',
    'Un detalle pequeño, que se nota todos los días.',
    CTA_STD],
    [v7_0, v7_1, v7_2, v7_3, v7_4],
    '¿Bisagras de cierre suave? Mira la diferencia 🚪 #shorts',
    desc(['¿Escuchas un ¡PUM! cada vez que cierran la alacena? 🚪💥',
          'Con bisagras normales la puerta golpea y con el tiempo se desajusta.',
          '✅ Las de cierre suave frenan al final y cierran solas, sin ruido.',
          '¿Las tuyas cierran suave o hacen PUM? 👇'], BASE_TAGS + ['#CocinasIntegrales', '#Hogar']),
    ['bisagras cierre suave', 'bisagras cocina', 'herrajes muebles', 'cocinas integrales', 'Tepatitlan', 'House Lite'],
    'Vertical Shorts cover, flat illustration: a kitchen cabinet door slamming with a yellow comic burst "¡PUM!" on one side and a softly closing door with a green check on the other. Bold Spanish text: "¿CIERRE SUAVE?". Cream background, no people.')


# =================================================================== 8
@HK([('¿TU COCINA', 104, INK), ('ES CHICA?', 140, ACC)])
def v8_0(img, d, t):
    room(d, 640, 1330, 1420)
    kitchen2(d, 290, 1330, 500, n=3, base_h=260, upper_h=180, gap=180, k=ease(seg(t, 0.3, 1.1)))
    a = ease(seg(t, 1.2, 1.8))
    arrow(d, 270, 1000, 270 - 170 * a, 1000, 1 if a > 0 else 0)
    arrow(d, 810, 1000, 810 + 170 * a, 1000, 1 if a > 0 else 0)


def _small_kitchen(d, t, col, handles=True):
    room(d, 600, 1330, 1400)
    kitchen2(d, 140, 1330, 800, col=col, base_h=280, upper_h=200, gap=200, handles=handles)


@S('1', 'COLORES CLAROS', cap=['Reflejan la luz', 'y abren el espacio'])
def v8_1(img, d, t):
    k = ease(seg(t, 0.8, 1.8))
    _small_kitchen(d, t, mix(FIN, LIGHT, k))
    icon(d, 'sun', 900, 680, 0.9, k=back(seg(t, 1.6, 2.0)))


@S('2', 'UN SOLO TONO', cap=['Muchos colores', 'la hacen ver chica'])
def v8_2(img, d, t):
    k = ease(seg(t, 1.0, 2.0))
    cols = [(160, 70, 60), (70, 110, 150), WOOD, (110, 140, 90)]
    _small_kitchen(d, t, [mix(c, LIGHT, k) for c in cols])
    big_mark(d, t, 'no', 900, 700, 56, 0.4) if t < 1.0 else check(d, 900, 700, 56, a=back(seg(t, 2.0, 2.4)))


@S('3', 'SIN JALADERAS', cap=['Menos líneas,', 'más limpieza visual'])
def v8_3(img, d, t):
    _small_kitchen(d, t, LIGHT, handles=t < 1.2)
    for i, (x, y) in enumerate([(300, 1150), (620, 1150), (420, 760), (820, 760)]):
        sparkle(d, x, y, t + i, 28, k=ease(seg(t, 1.2 + i * 0.1, 1.5 + i * 0.1)) * (1 - seg(t, 2.4, 2.8)))


@S('RESULTADO', 'SE VE MÁS AMPLIA', cap=['Mismo espacio,', 'se siente más grande'], col=GREEN)
def v8_4(img, d, t):
    _small_kitchen(d, t, LIGHT, handles=False)
    a = ease(seg(t, 0.3, 0.9))
    arrow(d, 120, 1000, 120 - 90 * a, 1000, 1 if a > 0 else 0)
    arrow(d, 960, 1000, 960 + 90 * a, 1000, 1 if a > 0 else 0)
    big_mark(d, t, 'ok', W / 2, 1150, 90, 1.0)


video('08', '2026-12-07', 'cocina_chica', [
    '¿Tu cocina es chica? Con estos tres trucos se ve más grande.',
    'Uno: colores claros. Reflejan la luz, y abren el espacio.',
    'Dos: un solo tono en toda la cocina. Mezclar muchos colores la hace ver más chica.',
    'Tres: puertas sin jaladeras, o jaladeras discretas. Menos líneas, más limpieza visual.',
    'Mismo espacio, pero se siente mucho más amplia.',
    CTA_STD],
    [v8_0, v8_1, v8_2, v8_3, v8_4],
    '3 trucos para que tu cocina chica se vea GRANDE ✨ #shorts',
    desc(['¿Tu cocina es chica? Con estos 3 trucos se ve más grande ✨',
          '1️⃣ Colores claros: reflejan la luz.',
          '2️⃣ Un solo tono: muchos colores la achican.',
          '3️⃣ Sin jaladeras o jaladeras discretas.',
          '¿Cuál vas a probar? 👇'], BASE_TAGS + ['#CocinasIntegrales', '#DecoracionDeInteriores']),
    ['cocina pequeña', 'cocina chica ideas', 'cocinas integrales', 'diseño de cocinas', 'Tepatitlan', 'House Lite'],
    'Vertical Shorts cover, flat illustration: a small light-colored kitchen with orange arrows pointing outward to show it looks bigger. Huge bold Spanish text: "COCINA CHICA QUE SE VE GRANDE" with "GRANDE" in orange. Cream background, no people.')


# =================================================================== 9
def _niche(d):
    d.rectangle([0, 600, W, 1300], fill=WALL)
    d.rectangle([140, 680, 940, 1300], fill=mix(WALL, (0, 0, 0), 0.08))
    d.rectangle([0, 1300, W, 1400], fill=FLOOR_D)


@HK([('¿DE TIENDA', 110, INK), ('O A LA', 110, INK), ('MEDIDA?', 150, ACC)])
def v9_0(img, d, t):
    d.rectangle([0, 760, W, 1320], fill=WALL)
    d.rectangle([0, 1320, W, 1420], fill=FLOOR_D)
    k = back(seg(t, 0.5, 1.0))
    if k > 0:
        cab_front(d, 300, 1320, 300 * k, 360, FIN, 2)
        cab_front(d, 780, 1320, 380 * k, 420, WOOD, 2)
        label(d, 300, 840, 'TIENDA', 44, INK, k)
        label(d, 780, 800, 'A LA MEDIDA', 44, ACC, k)


@S('DE TIENDA', 'MEDIDAS FIJAS', cap=['Casi nunca llena tu espacio', 'y te quedan huecos'])
def v9_1(img, d, t):
    _niche(d)
    cab_front(d, W / 2, 1300, 480, 460, FIN, 2)
    a = ease(seg(t, 0.8, 1.2)) * (0.6 + 0.4 * math.sin(t * 6))
    if a > 0:
        for x0, x1 in ((150, 290), (790, 930)):
            d.rectangle([x0, 690, x1, 1290], outline=mix(WALL, RED, a), width=8)
        pill(d, 220, 980, 'HUECO', RED, ease(seg(t, 1.0, 1.4)), 34, pad=24)
        pill(d, 860, 980, 'HUECO', RED, ease(seg(t, 1.0, 1.4)), 34, pad=24)
    big_mark(d, t, 'no', W / 2, 760, 64, 1.9)


@S('A LA MEDIDA', 'EXACTO A TU PARED', cap=['De esquina', 'a esquina'], col=GREEN)
def v9_2(img, d, t):
    _niche(d)
    k = ease(seg(t, 0.4, 1.4))
    cab_front(d, W / 2, 1300, 480 + 300 * k, 460 + 120 * k, WOOD, 2 + int(k > 0.5) + int(k > 0.95))
    dim_h(d, 150, 930, 650, '', seg(t, 1.4, 1.9))
    big_mark(d, t, 'ok', W / 2, 1000, 80, 2.0)


@S('TÚ ELIGES', 'COLOR Y DISEÑO', cap=['Los cajones y repisas', 'que de verdad necesitas'])
def v9_3(img, d, t):
    _niche(d)
    cols = [WOOD, FIN, LIGHT, (150, 70, 60)]
    i = int(clamp(t / 0.7, 0, 3.99))
    cab_front(d, W / 2, 1220, 780, 500, cols[i], 4)
    for j, c in enumerate(cols):
        x = W / 2 + (j - 1.5) * 120
        r = 40 if j == i else 30
        d.ellipse([x - r, 1340 - r, x + r, 1340 + r], fill=c, outline=ACC if j == i else INK, width=6 if j == i else 2)


@S('ADEMÁS', 'CON GARANTÍA', cap=['Hecho aquí', 'en Tepatitlán'], col=GREEN)
def v9_4(img, d, t):
    icon(d, 'house', W / 2, 920, 3.2, k=back(seg(t, 0.2, 0.7)))
    check(d, W / 2 + 230, 820, 80, a=back(seg(t, 0.9, 1.3)))
    pill(d, W / 2, 1250, 'Producto garantizado', INK, back(seg(t, 1.3, 1.7)), 48)


video('09', '2026-12-08', 'tienda_vs_medida', [
    '¿Mueble de tienda, o mueble a la medida? Te digo la diferencia.',
    'El de tienda viene en medidas fijas. Casi nunca llena tu espacio, y te quedan huecos.',
    'El de a la medida se hace exacto para tu pared, de esquina a esquina.',
    'Además, tú eliges el color, los cajones y las repisas que de verdad necesitas.',
    'Y lo hacemos aquí, en nuestro taller de Tepatitlán, con producto garantizado.',
    CTA_STD],
    [v9_0, v9_1, v9_2, v9_3, v9_4],
    '¿Mueble de tienda o a la medida? La diferencia 🤔 #shorts',
    desc(['¿Mueble de tienda o a la medida? 🤔',
          '❌ El de tienda viene en medidas fijas y te deja huecos.',
          '✅ El de a la medida queda exacto a tu pared, y tú eliges color, cajones y repisas.',
          'Hecho en nuestro taller de Tepatitlán, con garantía.',
          '¿Tú cuál prefieres? 👇'], BASE_TAGS + ['#HechoEnMexico', '#Hogar']),
    ['muebles a la medida', 'mueble de tienda', 'carpinteria', 'muebles personalizados', 'Tepatitlan', 'House Lite'],
    'Vertical Shorts cover, flat illustration: a small store-bought cabinet leaving red gaps in a wall niche versus a custom cabinet filling the wall perfectly with a green check. Bold Spanish text: "¿DE TIENDA O A LA MEDIDA?". Cream background, no people.')


# =================================================================== 10
@HK([('¿CÓMO SE HACE', 92, INK), ('UN CAJÓN', 132, ACC), ('QUE DURE?', 96, INK)])
def v10_0(img, d, t):
    d.rectangle([230, 830, 850, 1090], fill=(90, 100, 108))
    o = 0.5 + 0.5 * math.sin(max(0, t - 0.6) * 2.4 - math.pi / 2)
    drawer_box(d, W / 2, 960, 560, 200, open_k=o * ease(seg(t, 0.5, 0.8)))


@S('PASO 1', 'CORTAR LAS PIEZAS', cap=['Costados, frente y fondo', 'a la medida'])
def v10_1(img, d, t):
    names = ['COSTADO', 'COSTADO', 'FRENTE', 'FONDO', 'PISO']
    for i, nm in enumerate(names):
        k = ease(seg(t, 0.3 + i * 0.3, 0.8 + i * 0.3))
        if k <= 0:
            continue
        y = 680 + i * 140
        x0 = 160 + 900 * (1 - k)
        board(d, x0, y, x0 + (760 if nm != 'PISO' else 760), y + 100, col=WOOD_L if nm != 'PISO' else MDF, seed=i)
        text_c(d, x0 + 380, y + 48, nm, 40, 'ExtraBold', fill=INK)


@S('PASO 2', 'ARMAR A ESCUADRA', cap=['Para que no', 'se tuerza'])
def v10_2(img, d, t):
    cx, cy, w, h, th = W / 2, 1000, 620, 460, 30
    d.rectangle([cx - w / 2 + th, cy - h / 2 + th, cx + w / 2 - th, cy + h / 2 - th], fill=MDF)
    sides = [(cx - w / 2, cy - h / 2, cx + w / 2, cy - h / 2 + th, (0, -500)), (cx - w / 2, cy + h / 2 - th, cx + w / 2, cy + h / 2, (0, 500)),
             (cx - w / 2, cy - h / 2, cx - w / 2 + th, cy + h / 2, (-600, 0)), (cx + w / 2 - th, cy - h / 2, cx + w / 2, cy + h / 2, (600, 0))]
    for i, (x0, y0, x1, y1, (ox, oy)) in enumerate(sides):
        q = seg(t, 0.3 + i * 0.3, 0.7 + i * 0.3)
        if q <= 0:
            continue
        e = back(q)
        board(d, x0 + ox * (1 - e), y0 + oy * (1 - e), x1 + ox * (1 - e), y1 + oy * (1 - e), col=WOOD_L, seed=i, grain=False)
    a = back(seg(t, 1.8, 2.2))
    if a > 0:
        d.line([cx - w / 2 + 50, cy - h / 2 + 50, cx - w / 2 + 50, cy - h / 2 + 110], fill=ACC, width=6)
        d.line([cx - w / 2 + 50, cy - h / 2 + 50, cx - w / 2 + 110, cy - h / 2 + 50], fill=ACC, width=6)
        pill(d, cx, cy, '90°', ACC, a, 70, pad=30)


@S('PASO 3', 'CORREDERAS', cap=['Para que abra suave', 'y sin trabarse'])
def v10_3(img, d, t):
    d.rectangle([140, 760, 940, 1240], fill=(90, 100, 108))
    d.rectangle([160, 780, 920, 1220], fill=(60, 48, 38))
    d.rectangle([160, 1040, 920, 1056], fill=STEEL)
    o = 0.5 + 0.5 * math.sin(max(0, t - 0.8) * 2.2 - math.pi / 2)
    x = 200 + 330 * o * ease(seg(t, 0.6, 1.0))
    d.rectangle([x, 880, x + 560, 1040], fill=WOOD_L, outline=WOOD_D, width=4)
    d.rectangle([x + 560, 860, x + 600, 1080], fill=FIN)
    for rx in (x + 40, x + 500):
        d.ellipse([rx - 12, 1036, rx + 12, 1060], fill=INK)
    pill(d, 540, 1150, 'CORREDERA', ACC, back(seg(t, 0.3, 0.7)), 40)


@S('PASO 4', 'EL FRENTE', cap=['Con el acabado y la', 'jaladera que elegiste'])
def v10_4(img, d, t):
    d.rectangle([230, 760, 850, 1020], fill=(90, 100, 108))
    k = back(seg(t, 0.3, 0.8))
    if k > 0:
        drawer_box(d, W / 2, 890, 560 * k, 200 * k, open_k=ease(seg(t, 1.4, 2.0)) * 0.9, front=WOOD)
    check(d, 880, 700, 56, a=back(seg(t, 2.2, 2.6)))


video('10', '2026-12-09', 'como_se_hace_cajon', [
    '¿Cómo se hace un cajón que dure años? Mira.',
    'Primero cortamos los costados, el frente y el fondo, a la medida exacta.',
    'Luego armamos la caja bien a escuadra, para que no se tuerza.',
    'Le ponemos correderas, para que abra suave y sin trabarse.',
    'Y al final, el frente con el acabado y la jaladera que tú elegiste.',
    'Así se hace en nuestro taller. ' + CTA_STD],
    [v10_0, v10_1, v10_2, v10_3, v10_4],
    'Así se hace un cajón que dura años 🪚 #shorts',
    desc(['¿Cómo se hace un cajón que dure años? 🪚',
          '1️⃣ Cortamos costados, frente y fondo a la medida.',
          '2️⃣ Armamos la caja a escuadra para que no se tuerza.',
          '3️⃣ Correderas para que abra suave.',
          '4️⃣ El frente con el acabado que elegiste.',
          '¿Sabías todo lo que lleva? 👇'], BASE_TAGS + ['#HechoEnMexico', '#ProcesoDeTaller']),
    ['como hacer un cajon', 'cajones de madera', 'correderas', 'carpinteria', 'taller de carpinteria', 'Tepatitlan', 'House Lite'],
    'Vertical Shorts cover, flat illustration: a wooden drawer sliding open on metal rails, with pieces of wood around it. Huge bold Spanish text: "ASÍ SE HACE UN CAJÓN" with "CAJÓN" in orange. Cream background, no people.')
