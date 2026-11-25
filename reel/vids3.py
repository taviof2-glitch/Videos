"""Videos 21–30."""
from common import *
from vids1 import desc, BASE_TAGS, cab_front, ceiling, cab_frame


# =================================================================== 21
def entry(d, t, tray=0.0, shoes=0.0, hooks=0.0, key_drop=0.0):
    room(d, 600, 1330, 1400)
    cx, w = W / 2, 620
    d.rectangle([cx - w / 2, 1000, cx + w / 2, 1330], fill=WOOD, outline=WOOD_D, width=3)
    d.rectangle([cx - w / 2 - 20, 980, cx + w / 2 + 20, 1004], fill=WOOD_D)
    d.rectangle([cx - w / 2 + 20, 1150, cx + w / 2 - 20, 1166], fill=WOOD_D)
    d.rectangle([cx - w / 2 + 20, 1020, cx + w / 2 - 20, 1130], fill=mix(WOOD, WHITE, 0.15), outline=WOOD_D, width=3)
    handle_bar(d, cx, 1075, False, 120, INK)
    if tray > 0:
        d.rounded_rectangle([cx + 80, 960 - 6 * tray, cx + 260, 980], 10, fill=mix(BG, INK, tray))
        if key_drop > 0:
            y = 700 + (950 - 700) * ease(key_drop)
            icon(d, 'key', cx + 170, y, 0.9)
    if shoes > 0:
        for i, c in enumerate([(170, 70, 60), (60, 80, 120), (40, 40, 40)]):
            q = ease(seg(shoes, i * 0.2, i * 0.2 + 0.5))
            if q > 0:
                shoe(d, cx - 200 + i * 190 + 300 * (1 - q), 1310, 1.1, c)
    if hooks > 0:
        d.rectangle([cx - 300, 700, cx + 300, 730], fill=WOOD_D)
        for i in range(4):
            q = back(seg(hooks, i * 0.15, i * 0.15 + 0.4))
            if q > 0:
                x = cx - 220 + i * 150
                d.ellipse([x - 12 * q, 740 - 12 * q, x + 12 * q, 740 + 12 * q], fill=GOLD)
        q = ease(seg(hooks, 0.6, 1.0))
        if q > 0:
            d.rounded_rectangle([cx - 270, 760, cx - 150, 760 + 170 * q], 26, fill=(70, 120, 170))
            d.polygon([(cx + 30, 760), (cx + 130, 760), (cx + 160, 760 + 190 * q), (cx, 760 + 190 * q)], fill=(150, 90, 60))


@HK([('¿SIEMPRE', 110, INK), ('PIERDES', 120, ACC), ('LAS LLAVES?', 110, INK)])
def v21_0(img, d, t):
    for i, (x, y) in enumerate([(300, 900), (780, 1000), (520, 1200)]):
        k = back(seg(t, 0.4 + i * 0.25, 0.8 + i * 0.25))
        text_c(d, x, y, '?', 140, 'Black', fill=ACC, scale=k, alpha=clamp(k))
    icon(d, 'key', 540 + 30 * math.sin(t * 5), 1000 + 20 * math.cos(t * 4), 1.8, k=back(seg(t, 0.2, 0.6)))


@S('ARRIBA', 'LLAVES Y CARTERA', cap=['Un lugar fijo', 'para todo'])
def v21_1(img, d, t):
    entry(d, t, tray=1, key_drop=seg(t, 0.6, 1.4))


@S('ABAJO', 'ESPACIO PARA ZAPATOS', cap=['Para no meter', 'la tierra a la casa'])
def v21_2(img, d, t):
    entry(d, t, tray=1, shoes=seg(t, 0.3, 1.6))


@S('EN LA PARED', 'GANCHOS', cap=['Para la mochila', 'o la chamarra'])
def v21_3(img, d, t):
    entry(d, t, tray=1, shoes=1, hooks=seg(t, 0.3, 1.6))


@S('RESULTADO', 'ENTRADA ORDENADA', cap=['Y sales más rápido'], col=GREEN)
def v21_4(img, d, t):
    entry(d, t, 1, 1, 1, 1)
    big_mark(d, t, 'ok', 860, 900, 64, 0.8)


video('21', '2026-12-20', 'recibidor', [
    '¿Siempre pierdes las llaves al salir? Esto es para ti.',
    'Un mueble de entrada te da un lugar fijo para las llaves, la cartera y los lentes.',
    'Abajo, espacio para zapatos, para no meter la tierra a la casa.',
    'Y en la pared, unos ganchos para la mochila o la chamarra.',
    'Sales más rápido, y la entrada se ve ordenada.',
    CTA_STD],
    [v21_0, v21_1, v21_2, v21_3, v21_4],
    '¿Siempre pierdes las llaves? 🔑 Necesitas esto #shorts',
    desc(['¿Siempre pierdes las llaves al salir? 🔑',
          'Un mueble de entrada te da un lugar fijo para llaves, cartera y lentes.',
          '👟 Abajo, zapatos. 🧥 En la pared, ganchos.',
          '¿Te pasa seguido? 👇'], BASE_TAGS + ['#Recibidor', '#Hogar']),
    ['mueble recibidor', 'mueble de entrada', 'organizar entrada', 'zapatera', 'muebles a la medida', 'Tepatitlan', 'House Lite'],
    'Vertical Shorts cover, flat illustration: a wooden entryway cabinet with a key tray, shoes below and hooks with a backpack above. Huge bold Spanish text: "¿SIEMPRE PIERDES LAS LLAVES?" with "LLAVES" in orange. Cream background, no people.')


# =================================================================== 22
def desk(d, cx, y_floor, w=640, h=300, monitor=True, shelves=0.0, t=0.0):
    top = y_floor - h
    d.rectangle([cx - w / 2, top, cx + w / 2, top + 26], fill=WOOD)
    d.rectangle([cx - w / 2 + 10, top + 26, cx - w / 2 + 34, y_floor], fill=INK)
    d.rectangle([cx + w / 2 - 230, top + 26, cx + w / 2 - 10, y_floor], fill=FIN, outline=mix(FIN, (0, 0, 0), 0.3), width=3)
    for j in range(3):
        y = top + 26 + j * (h - 26) / 3
        d.line([cx + w / 2 - 230, y, cx + w / 2 - 10, y], fill=mix(FIN, (0, 0, 0), 0.35), width=3)
        handle_bar(d, cx + w / 2 - 120, y + 40, False, 70, GOLD)
    if monitor:
        tv(d, cx - 60, top - 140, 300, t)
        d.rectangle([cx - 70, top - 50, cx - 50, top], fill=INK)
    if shelves > 0:
        for i in range(2):
            q = ease(seg(shelves, i * 0.3, i * 0.3 + 0.5))
            if q <= 0:
                continue
            y = top - 300 - i * 150
            d.rectangle([cx - w / 2, y, cx - w / 2 + w * q, y + 18], fill=WOOD)
            for j, c in enumerate([(196, 82, 64), (70, 120, 170), (230, 190, 90), (110, 150, 100)]):
                qb = back(seg(shelves, 0.5 + j * 0.1, 0.8 + j * 0.1))
                if qb > 0:
                    d.rectangle([cx - w / 2 + 40 + j * 34 + i * 300, y - 90 * qb, cx - w / 2 + 66 + j * 34 + i * 300, y], fill=c)


@HK([('¿HOME OFFICE', 100, INK), ('Y DOLOR DE', 100, INK), ('CUELLO?', 140, ACC)])
def v22_0(img, d, t):
    room(d, 700, 1330, 1420)
    desk(d, W / 2, 1330, t=t)


@S('LA ALTURA', '75 CM DEL PISO', cap=['Más o menos'])
def v22_1(img, d, t):
    room(d, 600, 1330, 1400)
    desk(d, 600, 1330, t=t)
    dim_v(d, 220, 1030, 1330, '75', seg(t, 0.5, 1.3), side=-1, size=60)


@S('LA PANTALLA', 'A UN BRAZO', 'DE DISTANCIA', cap=['Que tenga fondo', 'suficiente'])
def v22_2(img, d, t):
    room(d, 640, 1330, 1400)
    d.rectangle([200, 1030, 900, 1056], fill=WOOD)
    d.rectangle([220, 1056, 244, 1330], fill=INK)
    d.rectangle([856, 1056, 880, 1330], fill=INK)
    d.rectangle([820, 820, 850, 1030], fill=INK)
    d.rectangle([800, 740, 840, 960], fill=(60, 70, 80))
    dim_h(d, 260, 800, 980, 'UN BRAZO', seg(t, 0.6, 1.4), size=48)
    big_mark(d, t, 'ok', 540, 1190, 64, 1.8)


@S('ORDEN', 'REPISAS Y CAJONES', cap=['Para que no se llene', 'de papeles'])
def v22_3(img, d, t):
    room(d, 600, 1330, 1400)
    desk(d, W / 2, 1330, shelves=seg(t, 0.3, 1.8), t=t)


@S('RESULTADO', 'A TU MEDIDA', cap=['En el rincón', 'que tengas'], col=GREEN)
def v22_4(img, d, t):
    room(d, 600, 1330, 1400)
    desk(d, W / 2, 1330, shelves=1, t=t)
    big_mark(d, t, 'ok', 860, 760, 64, 0.8)


video('22', '2026-12-21', 'escritorio_home_office', [
    '¿Trabajas desde casa, y terminas con dolor de cuello?',
    'El escritorio debe estar más o menos a setenta y cinco centímetros del piso.',
    'Que tenga fondo suficiente, para que la pantalla quede a un brazo de distancia.',
    'Y repisas o cajones, para que no se llene de papeles.',
    'Un escritorio a tu medida, en el rincón que tengas.',
    CTA_STD],
    [v22_0, v22_1, v22_2, v22_3, v22_4],
    'La medida de escritorio que te quita el dolor de cuello 💻 #shorts',
    desc(['¿Trabajas desde casa y terminas con dolor de cuello? 💻',
          '📏 Escritorio: más o menos a 75 cm del piso.',
          '🖥️ La pantalla a un brazo de distancia.',
          '✅ Repisas y cajones para el orden.',
          '¿Cómo es tu escritorio? 👇'], BASE_TAGS + ['#HomeOffice', '#Hogar']),
    ['escritorio a la medida', 'home office', 'altura escritorio', 'escritorio de madera', 'Tepatitlan', 'House Lite'],
    'Vertical Shorts cover, flat illustration: a wooden home office desk with a monitor, drawers and shelves, with an orange measuring arrow "75 cm". Huge bold Spanish text: "EL ESCRITORIO QUE TE QUITA EL DOLOR". Cream background, no people.')


# =================================================================== 23
@HK([('¿QUÉ HAY', 110, INK), ('DEBAJO DE TU', 96, INK), ('ESCALERA?', 130, ACC)])
def v23_0(img, d, t):
    room(d, 760, 1330, 1420)
    stairs(d, 200, 1330, n=6, step_w=110, step_h=90)


def _junk(d, k):
    rnd = random.Random(4)
    for i in range(7):
        q = back(seg(k, i * 0.1, i * 0.1 + 0.4))
        if q <= 0:
            continue
        x = rnd.uniform(260, 700)
        w, h = rnd.uniform(80, 140) * q, rnd.uniform(60, 120) * q
        d.rectangle([x, 1330 - h - (i % 2) * 50, x + w, 1330 - (i % 2) * 50], fill=[MDF, (196, 82, 64), (70, 120, 170), WOOD_L][i % 4], outline=INK, width=2)


@S('EL HUECO', 'ESPACIO PERDIDO', cap=['Vacío, o lleno de cosas', 'sin orden'])
def v23_1(img, d, t):
    room(d, 600, 1330, 1400)
    stairs(d, 160, 1330, n=7, step_w=110, step_h=95)
    _junk(d, seg(t, 0.4, 1.4))
    big_mark(d, t, 'no', 820, 1100, 70, 1.8)


@S('LA SOLUCIÓN', 'CAJONES A LA MEDIDA', cap=['Se vuelve una', 'bodega completa'], col=GREEN)
def v23_2(img, d, t):
    room(d, 600, 1330, 1400)
    stairs(d, 160, 1330, n=7, step_w=110, step_h=95, storage=seg(t, 0.3, 2.0))


@S('PARA QUÉ', 'TODO EN SU LUGAR', cap=['Zapatos, escobas', 'y herramienta'])
def v23_3(img, d, t):
    room(d, 600, 1330, 1400)
    stairs(d, 160, 1330, n=7, step_w=110, step_h=95, storage=1)
    for i, (ic, x) in enumerate([('house', 300), ('key', 520), ('bottle', 740)]):
        k = back(seg(t, 0.4 + i * 0.3, 0.8 + i * 0.3))
        if k > 0:
            d.ellipse([x - 70 * k, 760 - 70 * k, x + 70 * k, 760 + 70 * k], fill=WHITE, outline=ACC, width=5)
            icon(d, ic, x, 760, 0.7, k=k)


@S('RESULTADO', 'AHORA TRABAJA', 'PARA TI', cap=['El espacio que', 'no usabas'], col=GREEN)
def v23_4(img, d, t):
    room(d, 600, 1330, 1400)
    stairs(d, 160, 1330, n=7, step_w=110, step_h=95, storage=1)
    big_mark(d, t, 'ok', 820, 800, 70, 0.8)


video('23', '2026-12-22', 'bajo_escalera', [
    '¿Qué hay debajo de tu escalera? Seguro puro tiradero.',
    'Ese hueco casi siempre se queda vacío, o se llena de cosas sin orden.',
    'Con cajones y puertas a la medida, se vuelve una bodega completa.',
    'Zapatos, escobas, herramienta: todo en su lugar.',
    'El espacio que no usabas, ahora trabaja para ti.',
    CTA_STD],
    [v23_0, v23_1, v23_2, v23_3, v23_4],
    'El espacio debajo de tu escalera que estás desperdiciando 🪜 #shorts',
    desc(['¿Qué hay debajo de tu escalera? 🪜',
          'Ese hueco casi siempre se queda vacío o lleno de cosas sin orden.',
          '✅ Con cajones y puertas a la medida se vuelve una bodega completa.',
          '¿El tuyo cómo está? 👇'], BASE_TAGS + ['#Hogar', '#Remodelacion']),
    ['debajo de la escalera', 'aprovechar espacio escalera', 'cajones bajo escalera', 'muebles a la medida', 'Tepatitlan', 'House Lite'],
    'Vertical Shorts cover, flat illustration: a wooden staircase with built-in dark drawers underneath, one open. Huge bold Spanish text: "EL ESPACIO QUE ESTÁS DESPERDICIANDO". Cream background, no people.')


# =================================================================== 24
def closet_led(img, d, t, on=0.0, dark=0.0):
    closet(d, W / 2, 1000, 640, 720)
    if on > 0:
        ov = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        g = ImageDraw.Draw(ov)
        for x0, x1 in ((W / 2 - 298, W / 2 - 11), (W / 2 + 11, W / 2 + 298)):
            g.polygon([(x0, 662), (x1, 662), (x1, 1000), (x0, 1000)], fill=(255, 236, 170, int(90 * on)))
            d.rectangle([x0, 662, x1, 668], fill=mix(STEEL, (255, 244, 200), on))
        img.paste(ov, (0, 0), ov)
    if dark > 0:
        dk = dark_overlay(dark, box=(0, 560, W, 1400), alpha=150)
        img.paste(dk, (0, 0), dk)


@HK([('ANTES', 140, INK), ('Y DESPUÉS', 130, ACC)])
def v24_0(img, d, t):
    on = seg(t, 1.2, 1.5)
    closet_led(img, d, t, on=on, dark=1 - on)


@S('ANTES', 'SIN LUZ', cap=['Todo se ve oscuro', 'y no encuentras nada'])
def v24_1(img, d, t):
    closet_led(img, d, t, dark=1)
    d = ImageDraw.Draw(img)
    for i, (x, y) in enumerate([(380, 900), (700, 1100)]):
        k = back(seg(t, 0.6 + i * 0.3, 1.0 + i * 0.3))
        text_c(d, x, y, '?', 120, 'Black', fill=ACC, scale=k, alpha=clamp(k))


@S('DESPUÉS', 'LED EN EL CLOSET', cap=['Encuentras tu ropa', 'al instante'], col=GREEN)
def v24_2(img, d, t):
    on = seg(t, 0.5, 0.9)
    closet_led(img, d, t, on=on, dark=1 - on)
    icon(ImageDraw.Draw(img), 'bulb', 900, 680, 1.0, k=back(seg(t, 0.9, 1.3)))


@S('EN LA SALA', 'UN TOQUE ELEGANTE', cap=['En tu mueble de TV', 'o una vitrina'])
def v24_3(img, d, t):
    room(d, 600, 1320, 1400)
    on = seg(t, 0.6, 1.0)
    ov = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    g = ImageDraw.Draw(ov)
    g.ellipse([W / 2 - 440, 640, W / 2 + 440, 1060], fill=(255, 236, 170, int(110 * on)))
    g.polygon([(W / 2 - 430, 1170), (W / 2 + 430, 1170), (W / 2 + 480, 1320), (W / 2 - 480, 1320)], fill=(255, 236, 170, int(120 * on)))
    img.paste(ov, (0, 0), ov)
    d = ImageDraw.Draw(img)
    tv(d, W / 2, 850, 560, t)
    tv_unit(d, W / 2, 1290, 860, 160, floating=True)


@S('RESULTADO', 'DE REVISTA', cap=['Un detalle que', 'cambia todo'], col=GREEN)
def v24_4(img, d, t):
    closet_led(img, d, t, on=1)
    d = ImageDraw.Draw(img)
    for i, (x, y) in enumerate([(200, 720), (880, 800), (240, 1260), (860, 1240)]):
        sparkle(d, x, y, t + i, 30, k=ease(seg(t, 0.4 + i * 0.15, 0.8 + i * 0.15)))
    big_mark(d, t, 'ok', W / 2, 1000, 80, 1.2)


video('24', '2026-12-23', 'luz_led', [
    'Así cambia un mueble con luz LED. Mira el antes, y el después.',
    'Sin luz, el closet se ve oscuro, y no encuentras nada.',
    'Con luz LED dentro del closet, encuentras tu ropa al instante.',
    'Y en un mueble de TV o una vitrina, le da un toque elegante a tu sala.',
    'Un detalle que hace que tu casa se vea de revista.',
    CTA_STD],
    [v24_0, v24_1, v24_2, v24_3, v24_4],
    'Antes y después: así cambia un mueble con luz LED 💡 #shorts',
    desc(['Antes y después: así cambia un mueble con luz LED 💡',
          'Sin luz, el closet se ve oscuro y no encuentras nada.',
          '✅ Con LED encuentras tu ropa al instante, y en la sala se ve elegante.',
          '¿Le pondrías LED a tus muebles? 👇'], BASE_TAGS + ['#Closets', '#DecoracionDeInteriores']),
    ['luz led closet', 'muebles con luz led', 'iluminacion closet', 'mueble tv flotante led', 'Tepatitlan', 'House Lite'],
    'Vertical Shorts cover, flat illustration split in two: a dark closet on the left labeled "ANTES" and the same closet glowing with warm LED light on the right labeled "DESPUÉS". Bold Spanish text: "ASÍ CAMBIA CON LUZ LED". Cream background, no people.')


# =================================================================== 25
def pot(d, cx, y, w, col, t=0.0, steam=True):
    d.rounded_rectangle([cx - w / 2, y - w * 0.6, cx + w / 2, y], 14, fill=col, outline=INK, width=3)
    d.rectangle([cx - w / 2 - 20, y - w * 0.6, cx - w / 2, y - w * 0.6 + 14], fill=INK)
    d.rectangle([cx + w / 2, y - w * 0.6, cx + w / 2 + 20, y - w * 0.6 + 14], fill=INK)
    if steam:
        for i in range(3):
            x = cx - 30 + i * 30
            pts = [(x + 10 * math.sin(t * 4 + j * 0.8 + i), y - w * 0.6 - 10 - j * 14) for j in range(6)]
            d.line(pts, fill=(200, 200, 200), width=5)


@HK([('POV:', 120, ACC), ('ESTA NAVIDAD', 92, INK), ('ESTRENAS COCINA', 86, INK)])
def v25_0(img, d, t):
    room(d, 720, 1330, 1420)
    kitchen2(d, 120, 1330, 640, n=3, base_h=260, upper_h=160, gap=170, k=ease(seg(t, 0.3, 1.1)), col=WOOD)
    xmas_tree(d, 900, 1330, 420, t)


@S('TODO A LA MANO', 'CAJONES SUAVES', cap=['Abres y encuentras', 'todo'])
def v25_1(img, d, t):
    d.rectangle([230, 760, 850, 1020], fill=(120, 80, 46))
    drawer_box(d, W / 2, 890, 560, 200, open_k=ease(seg(t, 0.5, 1.6)), front=WOOD)


@S('ESPACIO', 'PARA TODO', cap=['El bacalao, los romeritos', 'y el ponche'])
def v25_2(img, d, t):
    room(d, 600, 1330, 1400)
    kitchen2(d, 120, 1330, 840, n=4, upper='none', base_h=300, col=WOOD)
    for i, (x, c, w) in enumerate([(260, (196, 82, 64), 170), (540, STEEL, 200), (820, (150, 90, 60), 160)]):
        k = back(seg(t, 0.4 + i * 0.35, 0.8 + i * 0.35))
        if k > 0:
            pot(d, x, 1006, w * k, c, t)


@S('LA FAMILIA', 'EN LA BARRA', cap=['Mientras tú', 'cocinas'])
def v25_3(img, d, t):
    room(d, 600, 1330, 1400)
    d.rectangle([120, 960, 960, 990], fill=(120, 80, 46))
    d.rectangle([140, 990, 940, 1330], fill=WOOD)
    for i in range(3):
        stool(d, 260 + i * 280, 1360, 280)
        icon(d, 'heart', 260 + i * 280, 860, 0.9, k=back(seg(t, 0.6 + i * 0.3, 1.0 + i * 0.3)))


@S('¡FELIZ NAVIDAD!', 'DE PARTE DE', 'HOUSE LITE', cap=['De todo nuestro equipo'], col=RED)
def v25_4(img, d, t):
    room(d, 640, 1330, 1400)
    xmas_tree(d, W / 2, 1330, 560, t)
    for i, (x, c) in enumerate([(300, (196, 82, 64)), (780, (70, 120, 170))]):
        k = back(seg(t, 0.5 + i * 0.3, 0.9 + i * 0.3))
        if k > 0:
            gift_box(d, x, 1250, 0.55 * k, col=c, ribbon=YELLOW)


video('25', '2026-12-24', 'pov_navidad_cocina', [
    'POV: esta Navidad, la cena se prepara en tu cocina nueva.',
    'Todo a la mano, con cajones que se abren suave.',
    'Espacio en la cubierta para el bacalao, los romeritos y el ponche.',
    'Y la familia junta en la barra, mientras tú cocinas.',
    '¡Feliz Navidad, de parte de todo el equipo de House Lite!',
    'Y si el próximo año quieres estrenar cocina, cotiza por WhatsApp al tres, siete, ocho... uno, siete, cero... ochenta y dos, setenta y ocho.'],
    [v25_0, v25_1, v25_2, v25_3, v25_4],
    'POV: esta Navidad estrenas cocina 🎄 #shorts',
    desc(['POV: esta Navidad la cena se prepara en tu cocina nueva 🎄',
          'Todo a la mano, espacio para el bacalao y los romeritos, y la familia en la barra.',
          '¡Feliz Navidad de parte de todo el equipo de House Lite! ✨',
          '¿Qué no puede faltar en tu cena? 👇'], BASE_TAGS + ['#Navidad', '#CocinasIntegrales']),
    ['cocina integral', 'navidad', 'cocina nueva', 'cocinas a la medida', 'Tepatitlan', 'House Lite'],
    'Vertical Shorts cover, flat illustration: a cozy wooden kitchen with steaming pots on the counter and a decorated Christmas tree beside it. Huge bold Spanish text: "POV: ESTA NAVIDAD ESTRENAS COCINA" with "POV" in orange. Cream background, no people.')


# =================================================================== 26
def tilted_cab(img, cx, y_floor, ang, door_open=0.0):
    w, h = 520, 520
    lay = Image.new('RGBA', (w + 200, h + 200), (0, 0, 0, 0))
    g = ImageDraw.Draw(lay)
    ox, oy = 100, 100
    g.rectangle([ox, oy, ox + w, oy + h], fill=FIN + (255,), outline=mix(FIN, (0, 0, 0), 0.3) + (255,), width=3)
    g.rectangle([ox - 10, oy - 20, ox + w + 10, oy], fill=(120, 80, 46, 255))
    g.line([ox + w / 2, oy + 6, ox + w / 2, oy + h - 6], fill=mix(FIN, (0, 0, 0), 0.35) + (255,), width=3)
    if door_open > 0:
        ww = (w / 2) * math.cos(door_open * math.pi / 2.4)
        g.rectangle([ox + w / 2, oy, ox + w - 4, oy + h], fill=(60, 48, 38, 255))
        g.polygon([(ox + w - 2, oy), (ox + w - 2 + (w / 2 - ww) * 0.6, oy - 20), (ox + w - 2 + (w / 2 - ww) * 0.6, oy + h + 20), (ox + w - 2, oy + h)], fill=mix(FIN, WHITE, 0.1) + (255,))
    for x in (ox + w / 2 - 24, ox + w / 2 + 24):
        g.rounded_rectangle([x - 4, oy + 60, x + 4, oy + 120], 4, fill=GOLD + (255,))
    lay = lay.rotate(ang, resample=Image.BICUBIC, center=(ox + w / 2, oy + h))
    img.paste(lay, (int(cx - ox - w / 2), int(y_floor - oy - h)), lay)


@HK([('¿LA PUERTA', 104, INK), ('SE ABRE', 120, ACC), ('SOLA?', 140, ACC)])
def v26_0(img, d, t):
    room(d, 760, 1330, 1420)
    tilted_cab(img, W / 2, 1330, -3, door_open=0.5 + 0.5 * math.sin(max(0, t - 0.8) * 2.5 - math.pi / 2))


@S('LA CAUSA', 'PISO DISPAREJO', cap=['El mueble se inclina', 'y las puertas se mueven'])
def v26_1(img, d, t):
    d.rectangle([0, 600, W, 1400], fill=WALL)
    a = 4 * ease(seg(t, 0.3, 1.0))
    d.polygon([(0, 1300), (W, 1300 - 75 * a / 4), (W, 1400), (0, 1400)], fill=FLOOR_D)
    tilted_cab(img, W / 2, 1300 - 38 * a / 4, -a, door_open=seg(t, 1.2, 2.0) * 0.6)
    pill(ImageDraw.Draw(img), 850, 760, '¡CHUECO!', RED, back(seg(t, 1.0, 1.4)), 44)


@S('LA SOLUCIÓN', 'NIVELARLO', cap=['Con patas niveladoras', 'o calzas'], col=GREEN)
def v26_2(img, d, t):
    room(d, 600, 1330, 1400)
    k = ease(seg(t, 0.6, 1.8))
    tilted_cab(img, W / 2, 1330, -3 * (1 - k))
    d = ImageDraw.Draw(img)
    level_tool(d, W / 2, 760, 520, bubble=-0.9 * (1 - k))
    check(d, 900, 760, 50, a=back(seg(t, 2.0, 2.4)))


@S('SI SIGUE', 'AJUSTA LAS BISAGRAS', cap=['Con un desarmador'])
def v26_3(img, d, t):
    d.rounded_rectangle([300, 760, 780, 1260], 30, fill=(90, 100, 108))
    d.rounded_rectangle([360, 860, 720, 1160], 40, fill=STEEL, outline=INK, width=4)
    for x in (440, 640):
        d.ellipse([x - 34, 980, x + 34, 1048], fill=(130, 136, 144), outline=INK, width=3)
        a = t * 4 * (x == 640) * seg(t, 0.6, 2.0)
        d.line([x - 24 * math.cos(a), 1014 - 24 * math.sin(a), x + 24 * math.cos(a), 1014 + 24 * math.sin(a)], fill=INK, width=6)
    q = ease(seg(t, 0.3, 0.7))
    sx = 640 + 300 * (1 - q)
    d.polygon([(sx + 30, 1006), (sx + 220, 990), (sx + 220, 1038), (sx + 30, 1022)], fill=STEEL, outline=INK)
    d.rounded_rectangle([sx + 220, 970, sx + 380, 1058], 30, fill=ACC, outline=INK, width=3)


@S('RESULTADO', 'CIERRA PERFECTO', cap=['Un mueble bien instalado', 'siempre se nivela'], col=GREEN)
def v26_4(img, d, t):
    room(d, 600, 1330, 1400)
    tilted_cab(img, W / 2, 1330, 0)
    d = ImageDraw.Draw(img)
    level_tool(d, W / 2, 740, 520, 0)
    big_mark(d, t, 'ok', W / 2, 1050, 80, 0.8)


video('26', '2026-12-25', 'nivelar_mueble', [
    '¿La puerta de tu mueble se abre sola? No está roto.',
    'Casi siempre es el piso: si no está parejo, el mueble se inclina, y las puertas se mueven.',
    'La solución: nivelarlo. Con patas niveladoras o calzas, hasta que la burbuja quede al centro.',
    'Y si sigue, se ajustan las bisagras con un desarmador.',
    'Mueble nivelado, y puertas que cierran perfecto. Por eso un mueble bien instalado siempre se nivela.',
    CTA_STD],
    [v26_0, v26_1, v26_2, v26_3, v26_4],
    '¿La puerta de tu mueble se abre sola? 🤔 No está roto #shorts',
    desc(['¿La puerta de tu mueble se abre sola? 🤔 No está roto.',
          'Casi siempre es el piso disparejo: el mueble se inclina.',
          '✅ Nivélalo con patas niveladoras o calzas, y si sigue, ajusta las bisagras.',
          '¿Te ha pasado? 👇'], BASE_TAGS + ['#TipsDelHogar', '#Hogar']),
    ['puerta se abre sola', 'nivelar mueble', 'ajustar bisagras', 'tips carpinteria', 'Tepatitlan', 'House Lite'],
    'Vertical Shorts cover, flat illustration: a tilted dark cabinet on an uneven floor with its door swinging open and a yellow spirit level above. Huge bold Spanish text: "¿SE ABRE SOLA?". Cream background, no people.')


# =================================================================== 27
def shoe_rack(img, d, t, tilt=0.0, boots=0.0):
    x0, x1, y0, y1 = 220, 860, 640, 1330
    d.rectangle([x0 - 20, y0, x1 + 20, y1], fill=WOOD_D)
    d.rectangle([x0, y0 + 20, x1, y1 - 20], fill=(60, 48, 38))
    n = 4
    cols = [(170, 70, 60), (60, 80, 120), (40, 40, 40), (200, 160, 90), (120, 150, 110)]
    for i in range(n):
        y = y0 + 150 + i * 150 - (60 if (boots > 0 and i == 0) else 0) * boots
        ang = -0.35 * tilt
        lay = Image.new('RGBA', (x1 - x0, 60), (0, 0, 0, 0))
        ImageDraw.Draw(lay).rectangle([0, 20, x1 - x0, 36], fill=WOOD + (255,))
        lay = lay.rotate(math.degrees(-ang) * 0.35, resample=Image.BICUBIC)
        img.paste(lay, (x0, int(y - 30)), lay)
        if i == 0 and boots > 0:
            continue
        for j in range(4 if tilt > 0.5 else 3):
            x = x0 + 80 + j * (140 if tilt > 0.5 else 190)
            shoe(d, x, y - 4 - 8 * tilt * (j % 2), 1.0 + 0.2 * (1 - tilt), cols[(i + j) % 5], ang=-0.25 * tilt)
    if boots > 0:
        for j in range(2):
            x = x0 + 150 + j * 300
            q = back(boots)
            d.polygon([(x - 30, 640 + 100 - 140 * q + 120), (x + 10, 640 + 100 - 140 * q + 120), (x + 10, 790), (x + 60, 790), (x + 60, 810), (x - 30, 810)], fill=(110, 70, 40), outline=INK)


@HK([('¿TUS ZAPATOS', 100, INK), ('NO CABEN', 130, ACC), ('EN NINGÚN LADO?', 80, INK)])
def v27_0(img, d, t):
    rnd = random.Random(8)
    for i in range(10):
        k = back(seg(t, 0.3 + i * 0.08, 0.7 + i * 0.08))
        if k > 0:
            shoe(d, rnd.uniform(220, 860), rnd.uniform(1000, 1330), 1.4 * k, [(170, 70, 60), (60, 80, 120), (40, 40, 40), (200, 160, 90)][i % 4], ang=rnd.uniform(-0.8, 0.8))


@S('REPISAS PLANAS', 'OCUPAN MUCHO', cap=['Y no ves', 'cuáles tienes'])
def v27_1(img, d, t):
    shoe_rack(img, d, t, tilt=0)
    big_mark(ImageDraw.Draw(img), t, 'no', 860, 700, 56, 1.4)


@S('EL TRUCO', 'REPISAS INCLINADAS', cap=['Los ves todos de frente', 'y caben más'], col=GREEN)
def v27_2(img, d, t):
    shoe_rack(img, d, t, tilt=ease(seg(t, 0.5, 1.4)))
    check(ImageDraw.Draw(img), 860, 700, 56, a=back(seg(t, 1.8, 2.2)))


@S('TIP', 'UNA MÁS ALTA', cap=['Para las botas'])
def v27_3(img, d, t):
    shoe_rack(img, d, t, tilt=1, boots=seg(t, 0.4, 1.2))


@S('RESULTADO', 'TODO A LA VISTA', cap=['Y en orden'], col=GREEN)
def v27_4(img, d, t):
    shoe_rack(img, d, t, tilt=1, boots=1)
    big_mark(ImageDraw.Draw(img), t, 'ok', 860, 700, 64, 0.8)


video('27', '2026-12-26', 'zapatera_inclinada', [
    '¿Tus zapatos no caben en ningún lado? Este truco te ayuda a guardar más.',
    'En repisas planas, los zapatos ocupan mucho fondo, y no ves cuáles tienes.',
    'Con repisas inclinadas, los ves todos de frente, y caben más en el mismo mueble.',
    'Y si dejas una repisa más alta, ahí caben las botas.',
    'Todos tus zapatos a la vista, y en orden.',
    CTA_STD],
    [v27_0, v27_1, v27_2, v27_3, v27_4],
    'El truco de la zapatera que casi nadie conoce 👟 #shorts',
    desc(['¿Tus zapatos no caben en ningún lado? 👟',
          '❌ En repisas planas ocupan mucho y no ves cuáles tienes.',
          '✅ Con repisas inclinadas los ves de frente y caben más.',
          '¿Cuántos pares tienes? 👇'], BASE_TAGS + ['#Zapatera', '#Closets']),
    ['zapatera', 'organizar zapatos', 'zapatera de madera', 'closet a la medida', 'Tepatitlan', 'House Lite'],
    'Vertical Shorts cover, flat illustration: a wooden shoe cabinet with tilted shelves showing colorful shoes facing forward. Huge bold Spanish text: "EL TRUCO DE LA ZAPATERA" with "TRUCO" in orange. Cream background, no people.')


# =================================================================== 28
def brick_wall(d, x0, y0, x1, y1, k=1.0):
    bh, bw = 40, 110
    rows = int((y1 - y0) / bh * k)
    for r in range(rows):
        y = y1 - (r + 1) * bh
        off = (r % 2) * bw / 2
        x = x0 - off
        while x < x1:
            d.rectangle([max(x0, x + 3), y + 3, min(x1, x + bw - 3), y + bh - 3], fill=(196, 110, 80))
            x += bw


@HK([('¿ESTÁS', 120, INK), ('CONSTRUYENDO?', 110, ACC)])
def v28_0(img, d, t):
    d.rectangle([0, 1330, W, 1420], fill=(170, 150, 130))
    brick_wall(d, 160, 760, 920, 1330, ease(seg(t, 0.2, 1.6)))


@S('DESDE LA OBRA', 'PLANEA TUS MUEBLES', cap=['Y deja los contactos', 'donde van'])
def v28_1(img, d, t):
    d.rectangle([0, 1330, W, 1400], fill=(170, 150, 130))
    d.rectangle([120, 640, 960, 1330], fill=(214, 206, 196))
    k = seg(t, 0.3, 1.4)
    for (x0, y0, x1, y1) in [(160, 1010, 920, 1330), (160, 680, 920, 900)]:
        q = ease(k)
        for x in range(int(x0), int(x0 + (x1 - x0) * q), 30):
            d.line([x, y0, x + 15, y0], fill=BLUE, width=5)
            d.line([x, y1, x + 15, y1], fill=BLUE, width=5)
        d.line([x0, y0, x0, y1], fill=BLUE, width=5)
    for i, x in enumerate([300, 620, 820]):
        icon(d, 'plug', x, 960, 0.7, k=back(seg(t, 1.4 + i * 0.25, 1.8 + i * 0.25)))


@S('ASÍ EVITAS', 'ROMPER PAREDES', cap=['Y terminar con extensiones', 'por todos lados'])
def v28_2(img, d, t):
    d.rectangle([0, 1330, W, 1400], fill=(170, 150, 130))
    d.rectangle([120, 640, 960, 1330], fill=(214, 206, 196))
    k = ease(seg(t, 0.4, 1.2))
    pts = [(540, 700), (500, 820), (580, 900), (520, 1020), (600, 1120), (560, 1260)]
    d.line(pts[:1 + int(5 * k)], fill=INK, width=8)
    burst(d, 540, 900, '¡CRACK!', t, 1.0, size=64)
    big_mark(d, t, 'no', 820, 1150, 70, 2.0)


@S('TAMBIÉN', 'EL PRESUPUESTO', cap=['Ve apartando', 'desde antes'])
def v28_3(img, d, t):
    for i in range(8):
        k = back(seg(t, 0.3 + i * 0.15, 0.6 + i * 0.15))
        if k <= 0:
            continue
        y = 1300 - i * 46
        d.ellipse([W / 2 - 150 * k, y - 26, W / 2 + 150 * k, y + 26], fill=GOLD, outline=(150, 120, 60), width=4)
    icon(d, 'house', W / 2, 820, 1.6, k=back(seg(t, 1.6, 2.0)))


@S('RESULTADO', 'AHORRAS DINERO', 'Y PROBLEMAS', cap=['Planear a tiempo', 'conviene'], col=GREEN)
def v28_4(img, d, t):
    icon(d, 'house', W / 2, 1080, 3.4, k=back(seg(t, 0.2, 0.7)))
    big_mark(d, t, 'ok', W / 2 + 250, 860, 80, 1.0)


video('28', '2026-12-27', 'planear_desde_obra', [
    '¿Estás construyendo? No esperes al final para pensar en tus muebles.',
    'Si planeas la cocina y los closets desde la obra, dejas los contactos y las tomas donde van.',
    'Así no rompes paredes después, ni terminas con extensiones por todos lados.',
    'Y puedes ir apartando el presupuesto de los muebles desde antes.',
    'Planear a tiempo te ahorra dinero, y dolores de cabeza.',
    CTA_STD],
    [v28_0, v28_1, v28_2, v28_3, v28_4],
    'Si estás construyendo, NO cometas este error 🧱 #shorts',
    desc(['¿Estás construyendo? 🧱 No esperes al final para pensar en tus muebles.',
          '✅ Planea cocina y closets desde la obra y deja los contactos donde van.',
          '❌ Así no rompes paredes ni terminas con extensiones por todos lados.',
          '¿Estás construyendo o remodelando? 👇'], BASE_TAGS + ['#Construccion', '#Remodelacion']),
    ['construir casa', 'planear muebles', 'errores al construir', 'cocina integral', 'Tepatitlan', 'House Lite'],
    'Vertical Shorts cover, flat illustration: a brick wall under construction with blue dashed outlines of a kitchen and electrical outlets marked. Huge bold Spanish text: "SI ESTÁS CONSTRUYENDO, NO COMETAS ESTE ERROR". Cream background, no people.')


# =================================================================== 29
@HK([('¿CÓMO SE HACE', 92, INK), ('UNA COCINA', 124, ACC), ('INTEGRAL?', 110, ACC)])
def v29_0(img, d, t):
    room(d, 760, 1330, 1420)
    kitchen2(d, 140, 1330, 800, base_h=260, upper_h=150, gap=160, k=ease(seg(t, 0.4, 1.8)))


@S('PASO 1', 'MEDIR Y DISEÑAR', cap=['Medimos tu cocina', 'y hacemos el diseño'])
def v29_1(img, d, t):
    d.rectangle([90, 640, 990, 1300], fill=WALL)
    d.rectangle([90, 1300, 990, 1340], fill=FLOOR)
    tape(d, 160, 1240, 760, ease_io(seg(t, 0.3, 1.2)), '3.20 m', back(seg(t, 1.1, 1.5)))
    p = ease(seg(t, 1.3, 2.4))
    if p > 0:
        for i in range(4):
            q = seg(p, i / 6, i / 6 + 0.4)
            if q > 0:
                col = mix(WALL, BLUE, q)
                d.rectangle([160 + i * 190, 900, 340 + i * 190, 1120], outline=col, width=5)
                d.rectangle([160 + i * 190, 680, 340 + i * 190, 820], outline=col, width=5)


@S('PASO 2', 'CORTAR Y CANTEAR', cap=['Cada pieza en', 'nuestro taller'])
def v29_2(img, d, t):
    for i in range(5):
        k = ease(seg(t, 0.2 + i * 0.25, 0.6 + i * 0.25))
        if k <= 0:
            continue
        y = 1260 - i * 90
        board(d, 200 + 600 * (1 - k), y - 70, 880 + 600 * (1 - k), y, col=[WOOD, WOOD_L, MDF, WOOD, WOOD_L][i], seed=i)
        e = ease(seg(t, 1.4 + i * 0.15, 1.8 + i * 0.15))
        if e > 0:
            d.rectangle([200, y - 74, 200 + 680 * e, y - 66], fill=(110, 72, 40))
    pill(d, W / 2, 760, 'CANTO', ACC, back(seg(t, 1.6, 2.0)), 44)


@S('PASO 3', 'ARMAR LOS MÓDULOS', cap=['Uno por uno'])
def v29_3(img, d, t):
    room(d, 600, 1330, 1400)
    for i in range(4):
        q = seg(t, 0.3 + i * 0.4, 0.7 + i * 0.4)
        if q <= 0:
            continue
        e = back(q)
        x = 140 + i * 200 + (1 - e) * (500 if i % 2 else -500)
        base_cab(d, x + 3, 1330, 194, 300, 'doors' if i != 1 else 'drawers', FIN)


@S('PASO 4', 'INSTALAR', cap=['Nivelada y lista', 'para usarse'], col=GREEN)
def v29_4(img, d, t):
    room(d, 600, 1330, 1400)
    kitchen2(d, 140, 1330, 800, base_h=300, upper_h=200, gap=200, k=0.6 + 0.4 * ease(seg(t, 0, 1.0)))
    ok = back(seg(t, 1.2, 1.7))
    if ok > 0:
        d.rounded_rectangle([W / 2 - 200 * ok, 600, W / 2 + 200 * ok, 700], 50, fill=GREEN)
        text_c(d, W / 2, 647, '¡LISTO!', 64, 'Black', fill=WHITE, scale=ok)


video('29', '2026-12-28', 'proceso_cocina_integral', [
    '¿Cómo se hace una cocina integral? Desde el taller, hasta tu casa.',
    'Primero medimos tu cocina, y hacemos el diseño.',
    'Luego cortamos y canteamos cada pieza en nuestro taller.',
    'Armamos los módulos, uno por uno.',
    'Y la instalamos en tu casa, nivelada y lista para usarse.',
    CTA_STD],
    [v29_0, v29_1, v29_2, v29_3, v29_4],
    'Así se hace una cocina integral, del taller a tu casa 🪚 #shorts',
    desc(['¿Cómo se hace una cocina integral? 🪚',
          '1️⃣ Medimos y diseñamos.',
          '2️⃣ Cortamos y canteamos cada pieza en el taller.',
          '3️⃣ Armamos los módulos.',
          '4️⃣ La instalamos nivelada y lista.',
          '¿Ya sabías todo el proceso? 👇'], BASE_TAGS + ['#CocinasIntegrales', '#ProcesoDeTaller']),
    ['como se hace una cocina integral', 'cocinas integrales', 'proceso carpinteria', 'taller de carpinteria', 'Tepatitlan', 'House Lite'],
    'Vertical Shorts cover, flat illustration: a kitchen being assembled module by module, with a measuring tape and wood boards. Huge bold Spanish text: "ASÍ SE HACE UNA COCINA INTEGRAL". Cream background, no people.')


# =================================================================== 30
def phone_chat(d, t, k=1.0, n_msgs=3):
    icon(d, 'phone', W / 2, 1000, 3.0, col=(236, 229, 221))
    d.rectangle([W / 2 - 150, 724, W / 2 + 150, 790], fill=(18, 140, 126))
    text_c(d, W / 2, 755, 'House Lite', 34, 'ExtraBold', fill=WHITE)
    msgs = [('Medidas: 2.40 x 0.60', True), ('[foto del espacio]', True), ('Color: nogal', True), ('¡Te mandamos tu cotización!', False)]
    for i, (s, me) in enumerate(msgs[:n_msgs]):
        q = back(seg(t, 0.4 + i * 0.4, 0.8 + i * 0.4)) * k
        if q <= 0:
            continue
        y = 840 + i * 110
        f = font(28, 'Bold')
        w = d.textbbox((0, 0), s, font=f)[2] + 40
        x1 = W / 2 + 140 if me else W / 2 - 140 + w
        x0 = x1 - w
        d.rounded_rectangle([x0, y - 34 * q, x1, y + 34 * q], 18, fill=(220, 248, 198) if me else WHITE)
        text_c(d, (x0 + x1) / 2, y - 2, s, 28, 'Bold', fill=INK, scale=q)


@HK([('¿CÓMO COTIZO', 96, INK), ('MI MUEBLE?', 120, ACC), ('3 PASOS', 110, INK)])
def v30_0(img, d, t):
    icon(d, 'phone', W / 2, 1100, 2.2, col=(236, 229, 221), k=back(seg(t, 0.4, 0.9)))
    icon(d, 'chat', W / 2, 1080, 1.1, k=back(seg(t, 0.9, 1.3)))


@S('PASO 1', 'MIDE TU ESPACIO', cap=['Aunque sea', 'aproximado'])
def v30_1(img, d, t):
    d.rectangle([90, 640, 990, 1300], fill=WALL)
    d.rectangle([90, 1300, 990, 1340], fill=FLOOR)
    tape(d, 160, 1240, 760, ease_io(seg(t, 0.3, 1.2)), '2.40 m', back(seg(t, 1.1, 1.5)))
    icon(d, 'plug', 820, 900, 0.8, k=back(seg(t, 1.5, 1.9)))


@S('PASO 2', 'TOMA UNA FOTO', cap=['Del lugar donde', 'va el mueble'])
def v30_2(img, d, t):
    d.rectangle([90, 640, 990, 1300], fill=WALL)
    d.rectangle([90, 1300, 990, 1340], fill=FLOOR)
    icon(d, 'camera', W / 2, 980, 3.0, k=back(seg(t, 0.2, 0.6)))
    f = seg(t, 1.0, 1.15) - seg(t, 1.15, 1.5)
    if f > 0:
        ov = Image.new('RGBA', (W, H), (255, 255, 255, int(220 * f)))
        img.paste(ov, (0, 0), ov)


@S('PASO 3', 'MÁNDALO', 'POR WHATSAPP', cap=['Con el color o estilo', 'que te gusta'])
def v30_3(img, d, t):
    phone_chat(d, t, n_msgs=3)


@S('Y LISTO', 'COTIZACIÓN', 'SIN COMPROMISO', cap=['Así de fácil'], col=GREEN)
def v30_4(img, d, t):
    phone_chat(d, t + 2.0, n_msgs=3)
    q = back(seg(t, 0.4, 0.8))
    if q > 0:
        y = 1170
        d.rounded_rectangle([W / 2 - 140, y - 40 * q, W / 2 + 120, y + 40 * q], 18, fill=WHITE)
        text_c(d, W / 2 - 10, y - 2, '¡Aquí tienes tu cotización!', 22, 'Bold', fill=INK, scale=q)
    big_mark(d, t, 'ok', 880, 760, 64, 1.0)


video('30', '2026-12-29', 'cotizar_3_pasos', [
    '¿Quieres un mueble a la medida, y no sabes cómo cotizar? Son tres pasos.',
    'Uno: mide tu espacio, aunque sea aproximado.',
    'Dos: tómale una foto al lugar donde va el mueble.',
    'Tres: mándanos todo por WhatsApp, con el color o el estilo que te gusta.',
    'Y te mandamos tu cotización, sin compromiso. Así de fácil.',
    'Empieza el año nuevo con tu casa como la quieres. Cotiza por WhatsApp al tres, siete, ocho... uno, siete, cero... ochenta y dos, setenta y ocho.'],
    [v30_0, v30_1, v30_2, v30_3, v30_4],
    'Cómo cotizar tu mueble a la medida en 3 pasos 📲 #shorts',
    desc(['¿Quieres un mueble a la medida y no sabes cómo cotizar? 📲',
          '1️⃣ Mide tu espacio (aunque sea aproximado).',
          '2️⃣ Tómale una foto al lugar.',
          '3️⃣ Mándanos todo por WhatsApp con el color o estilo que te gusta.',
          'Y te mandamos tu cotización sin compromiso ✨'], BASE_TAGS + ['#AñoNuevo', '#Hogar']),
    ['cotizar muebles', 'muebles a la medida', 'cotizacion carpinteria', 'cocina integral precio', 'Tepatitlan', 'House Lite'],
    'Vertical Shorts cover, flat illustration: a smartphone showing a green chat with a measuring tape and a photo of a room, and a big green check. Huge bold Spanish text: "COTIZA TU MUEBLE EN 3 PASOS" with "3 PASOS" in orange. Cream background, no people.')
