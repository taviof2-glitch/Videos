"""Videos 11–20."""
from common import *
from vids1 import desc, BASE_TAGS, cab_front, ceiling, cab_frame


def spots(d, x0, y0, x1, y1, k, seed=1, col=(120, 150, 110), n=14):
    rnd = random.Random(seed)
    for i in range(int(n * k)):
        x, y = rnd.uniform(x0, x1), rnd.uniform(y0, y1)
        r = rnd.uniform(14, 34) * min(1, k * 1.5)
        d.ellipse([x - r, y - r * 0.7, x + r, y + r * 0.7], fill=col)


# =================================================================== 11
@HK([('¿LIMPIAS TUS', 88, INK), ('MUEBLES CON', 88, INK), ('CLORO?', 150, RED)], stop=True)
def v11_0(img, d, t):
    icon(d, 'bottle', W / 2, 1110, 2.6, k=back(seg(t, 0.6, 1.1)))
    big_mark(d, t, 'no', W / 2 + 170, 940, 80, 1.5)


@S('EL ERROR', 'CLORO Y QUÍMICOS', cap=['Manchan y le quitan', 'el acabado'])
def v11_1(img, d, t):
    board(d, 140, 900, 940, 1300, col=WOOD, seed=3)
    icon(d, 'bottle', 860, 760, 1.4)
    a = seg(t, 0.4, 1.2)
    if 0 < a < 1:
        rnd = random.Random(int(t * 30))
        for i in range(30):
            u = rnd.random()
            x, y = 820 - 420 * u * a, 700 + 300 * u * a + rnd.uniform(-40, 40)
            d.ellipse([x - 5, y - 5, x + 5, y + 5], fill=(170, 210, 230))
    spots(d, 200, 950, 880, 1260, seg(t, 1.0, 2.0), col=(232, 214, 176))
    big_mark(d, t, 'no', 540, 1100, 80, 2.1)


@S('LO CORRECTO', 'TRAPO HÚMEDO', cap=['Con jabón neutro,', 'y seca enseguida'], col=GREEN)
def v11_2(img, d, t):
    board(d, 140, 900, 940, 1300, col=WOOD, seed=3)
    k = ease_io(seg(t, 0.3, 2.0))
    x = 220 + 640 * k
    y = 1100 + 80 * math.sin(k * math.pi * 4)
    d.rectangle([140, 900, max(140, x - 40), 1300], outline=None)
    for i in range(int(k * 6)):
        sparkle(d, 220 + i * 120, 960 + (i % 2) * 260, t + i, 20)
    icon(d, 'cloth', x, y, 1.6)
    icon(d, 'drop', 180, 760, 0.9, k=back(seg(t, 0.2, 0.6)))
    big_mark(d, t, 'ok', 900, 760, 56, 2.2)


@S('OJO', 'CON EL SOL DIRECTO', cap=['Decolora tus muebles', 'con el tiempo'])
def v11_3(img, d, t):
    d.rectangle([120, 620, 420, 920], fill=SKY, outline=WOOD_D, width=14)
    d.line([270, 620, 270, 920], fill=WOOD_D, width=10)
    icon(d, 'sun', 270, 740, 0.9)
    k = ease(seg(t, 0.5, 1.5))
    ov = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(ov).polygon([(140, 920), (400, 920), (960, 1330), (500, 1330)], fill=(255, 230, 150, int(110 * k)))
    cab_front(d, 640, 1340, 520, 330, WOOD, 2)
    img.paste(ov, (0, 0), ov)
    d2 = ImageDraw.Draw(img)
    fade = seg(t, 1.4, 2.6)
    if fade > 0:
        f2 = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        ImageDraw.Draw(f2).rectangle([640, 980, 900, 1310], fill=(245, 235, 215, int(120 * fade)))
        img.paste(f2, (0, 0), f2)


@S('RESULTADO', 'COMO NUEVOS', 'POR AÑOS', cap=['Con estos cuidados'], col=GREEN)
def v11_4(img, d, t):
    room(d, 640, 1330, 1400)
    cab_front(d, W / 2, 1330, 720, 420, WOOD, 3)
    big_mark(d, t, 'ok', W / 2, 760, 80, 0.8)
    for i, (x, y) in enumerate([(240, 950), (840, 1000), (520, 1180)]):
        sparkle(d, x, y, t + i, 32, k=ease(seg(t, 1.0 + i * 0.2, 1.4 + i * 0.2)))


video('11', '2026-12-10', 'cuidar_muebles', [
    '¿Limpias tus muebles con cloro? Detente.',
    'El cloro y los limpiadores fuertes manchan, y le quitan el acabado a la madera y a la melamina.',
    'Mejor usa un trapo apenas húmedo con jabón neutro, y seca enseguida.',
    'Y ojo con el sol directo todo el día: con el tiempo decolora tus muebles.',
    'Con estos cuidados, tus muebles se ven como nuevos por años.',
    CTA_STD],
    [v11_0, v11_1, v11_2, v11_3, v11_4],
    '¿Limpias tus muebles con cloro? 🛑 Mira esto #shorts',
    desc(['¿Limpias tus muebles con cloro? 🛑',
          '❌ El cloro y los limpiadores fuertes manchan y le quitan el acabado.',
          '✅ Trapo apenas húmedo con jabón neutro, y seca enseguida.',
          '☀️ Evita el sol directo todo el día.',
          '¿Tú cómo los limpias? 👇'], BASE_TAGS + ['#Hogar', '#TipsDeLimpieza']),
    ['como limpiar muebles', 'limpiar melamina', 'cuidar muebles de madera', 'tips de limpieza', 'Tepatitlan', 'House Lite'],
    'Vertical Shorts cover, flat illustration: a bleach bottle with a big red X next to a wooden cabinet with stains. Huge bold Spanish text: "¿LIMPIAS CON CLORO?" with "CLORO" in red, and "¡ALTO!" badge. Cream background, no people.')


# =================================================================== 12
def closet_top(d, cx, y0, w, depth_px, hangers=6, parallel=False, slide=0.0):
    """Planta del closet: rectángulo con ganchos vistos desde arriba."""
    d.rectangle([cx - w / 2 - 20, y0 - 20, cx + w / 2 + 20, y0 + depth_px], fill=(90, 100, 108))
    d.rectangle([cx - w / 2, y0, cx + w / 2, y0 + depth_px], fill=(244, 238, 228))
    cols = [(196, 82, 64), (70, 120, 170), (230, 190, 90), (110, 150, 100), (60, 60, 70), (150, 100, 160)]
    if not parallel:
        d.line([cx - w / 2 + 20, y0 + depth_px / 2, cx + w / 2 - 20, y0 + depth_px / 2], fill=STEEL, width=8)
        for i in range(hangers):
            x = cx - w / 2 + 60 + i * (w - 120) / (hangers - 1)
            d.rounded_rectangle([x - 12, y0 + depth_px / 2 - 120, x + 12, y0 + depth_px / 2 + 120], 10, fill=cols[i % 6])
    else:
        off = slide * 120
        d.line([cx, y0 + 10, cx, y0 + depth_px - 10 + off], fill=STEEL, width=8)
        for i in range(hangers):
            y = y0 + 30 + i * (depth_px - 60) / (hangers - 1) + off
            d.rounded_rectangle([cx - 120, y - 10, cx + 120, y + 10], 10, fill=cols[i % 6])


@HK([('¿LA PUERTA', 104, INK), ('DEL CLOSET', 104, INK), ('NO CIERRA?', 120, ACC)])
def v12_0(img, d, t):
    k = back(seg(t, 0.4, 0.9))
    if k > 0:
        closet(d, W / 2, 1060, 560 * k, 600 * k, doors=0.85 + 0.1 * math.sin(t * 8) * seg(t, 1.0, 1.2))
    big_mark(d, t, 'no', 840, 800, 64, 1.6)


@S('EL DATO', 'UN GANCHO MIDE', 'CASI 50 CM', cap=['De ancho,', 'con todo y ropa'])
def v12_1(img, d, t):
    k = back(seg(t, 0.3, 0.8))
    if k > 0:
        hanger(d, W / 2, 720, 420 * k, shirt=(70, 120, 170), long=True)
    dim_h(d, W / 2 - 210, W / 2 + 210, 1180, '45-50 cm', seg(t, 1.0, 1.7), above=False)


@S('LA MEDIDA', '60 CM DE FONDO', cap=['Para colgar', 'de frente'])
def v12_2(img, d, t):
    closet_top(d, 600, 720, 680, 360)
    dim_v(d, 175, 720, 1080, '60', seg(t, 0.5, 1.3), side=-1, size=60)
    pill(d, W / 2, 1220, 'VISTA DESDE ARRIBA', INK, back(seg(t, 0.2, 0.6)), 36)
    big_mark(d, t, 'ok', 900, 650, 50, 1.6)


@S('POCO ESPACIO', 'TUBO EXTENSIBLE', cap=['O cuelga la ropa', 'de lado'])
def v12_3(img, d, t):
    closet_top(d, W / 2, 720, 760, 240, hangers=5, parallel=True, slide=ease(seg(t, 0.6, 1.6)))
    pill(d, W / 2, 1240, 'SALE HACIA TI', ACC, back(seg(t, 1.3, 1.7)), 40)


@S('RESULTADO', 'CIERRA SIN FORZAR', cap=['Tu ropa cuelga derecha'], col=GREEN)
def v12_4(img, d, t):
    closet(d, W / 2, 1000, 640, 720, doors=ease(seg(t, 0.2, 1.0)))
    big_mark(d, t, 'ok', W / 2, 1000, 90, 1.3)


video('12', '2026-12-11', 'closet_profundidad', [
    '¿La puerta de tu closet no cierra, o tu ropa se arruga? Es la profundidad.',
    'Un gancho con ropa mide casi cincuenta centímetros de ancho.',
    'Por eso el closet necesita unos sesenta centímetros de fondo, para colgar de frente.',
    'Si tienes menos espacio, se puede usar un tubo extensible, o colgar la ropa de lado.',
    'Así tu ropa cuelga derecha, y la puerta cierra sin forzar.',
    CTA_STD],
    [v12_0, v12_1, v12_2, v12_3, v12_4],
    'La medida que tu closet necesita (y casi nadie sabe) 👕 #shorts',
    desc(['¿La puerta de tu closet no cierra? 👕 Es la profundidad.',
          '📏 Un gancho con ropa mide casi 50 cm.',
          '✅ Por eso el closet necesita unos 60 cm de fondo para colgar de frente.',
          '¿Tu closet la cumple? 👇'], BASE_TAGS + ['#Closets', '#Hogar']),
    ['medidas closet', 'profundidad closet', 'closet a la medida', 'organizar closet', 'Tepatitlan', 'House Lite'],
    'Vertical Shorts cover, flat illustration: an open wooden closet with clothes on hangers and an orange measuring arrow labeled "60 cm". Huge bold Spanish text: "LA MEDIDA QUE TU CLOSET NECESITA". Cream background, no people.')


# =================================================================== 13
@HK([('¿RECÁMARA', 120, INK), ('CHICA?', 150, ACC)])
def v13_0(img, d, t):
    room(d, 700, 1330, 1420)
    bed(d, W / 2, 1330, 760, drawers=0)


@S('EL SECRETO', 'DEBAJO DE LA CAMA', cap=['Un espacio enorme', 'que casi nadie usa'])
def v13_1(img, d, t):
    room(d, 600, 1330, 1400)
    bed(d, W / 2, 1330, 760)
    a = seg(t, 0.6, 1.0) * (0.6 + 0.4 * math.sin(t * 6))
    if a > 0:
        for x in range(170, 910, 40):
            d.line([x, 1190, x + 20, 1190], fill=mix(WOOD, ACC, a), width=6)
            d.line([x, 1310, x + 20, 1310], fill=mix(WOOD, ACC, a), width=6)
    pill(d, W / 2, 1250, 'ESPACIO LIBRE', ACC, back(seg(t, 1.0, 1.4)), 40)


@S('LA SOLUCIÓN', 'BASE CON CAJONES', cap=['Cobijas, ropa', 'de temporada y zapatos'])
def v13_2(img, d, t):
    room(d, 600, 1330, 1400)
    bed(d, W / 2, 1330, 760, drawers=ease(seg(t, 0.5, 1.4)))
    for i, c in enumerate([(196, 82, 64), (70, 120, 170)]):
        k = back(seg(t, 1.4 + i * 0.3, 1.8 + i * 0.3))
        if k > 0:
            x = 330 + i * 400
            d.rounded_rectangle([x - 110 * k, 1170 - 60 * k, x + 110 * k, 1170], 16, fill=c)


@S('BONUS', 'UN MUEBLE MENOS', cap=['En un cuarto chico', 'se agradece'])
def v13_3(img, d, t):
    room(d, 600, 1330, 1400)
    bed(d, 440, 1330, 640, drawers=0.3)
    a = 1 - seg(t, 1.0, 1.6)
    if a > 0:
        cab_front(d, 900, 1330, 220, 380, mix(BG, WOOD, a), 1, top=None)
    cross(d, 900, 1100, 56, a=back(seg(t, 0.4, 0.8)) * a)
    arrow(d, 760, 1240, 960, 1240, ease(seg(t, 1.6, 2.1)))


@S('RESULTADO', 'MÁS ESPACIO', 'MENOS TIRADERO', cap=['Todo guardado', 'en su lugar'], col=GREEN)
def v13_4(img, d, t):
    room(d, 600, 1330, 1400)
    bed(d, W / 2, 1330, 760, drawers=0.0)
    big_mark(d, t, 'ok', W / 2, 860, 90, 0.8)


video('13', '2026-12-12', 'cama_cajones', [
    '¿Recámara chica y no sabes dónde guardar? Mira debajo de tu cama.',
    'Debajo de la cama hay un espacio enorme que casi nadie usa.',
    'Con una base con cajones, ahí guardas cobijas, ropa de temporada y zapatos.',
    'Y te ahorras un mueble extra, que en un cuarto chico se agradece.',
    'Más espacio, y menos tiradero.',
    CTA_STD],
    [v13_0, v13_1, v13_2, v13_3, v13_4],
    'El espacio que no estás usando en tu recámara 🛏️ #shorts',
    desc(['¿Recámara chica y no sabes dónde guardar? 🛏️',
          'Debajo de la cama hay un espacio enorme que casi nadie usa.',
          '✅ Con una base con cajones guardas cobijas, ropa de temporada y zapatos.',
          '¿Tú qué guardarías ahí? 👇'], BASE_TAGS + ['#Recamara', '#Hogar']),
    ['cama con cajones', 'recamara pequeña', 'ideas para recamara', 'base de cama', 'muebles a la medida', 'Tepatitlan', 'House Lite'],
    'Vertical Shorts cover, flat illustration: a bed with large drawers pulled out underneath, full of blankets. Huge bold Spanish text: "EL ESPACIO QUE NO ESTÁS USANDO" with "NO" in orange. Cream background, no people.')


# =================================================================== 14
@HK([('3 SEÑALES', 120, INK), ('DE UN MUEBLE', 96, INK), ('MAL HECHO', 120, RED)])
def v14_0(img, d, t):
    k = back(seg(t, 0.5, 1.0))
    if k > 0:
        cab_front(d, W / 2, 1330, 560 * k, 420 * k, FIN, 2)
    big_mark(d, t, 'no', 800, 880, 64, 1.5)


@S('1', 'CANTOS DESPEGADOS', cap=['Entra el agua', 'y la madera se hincha'])
def v14_1(img, d, t):
    board(d, 140, 860, 940, 1260, col=MEL, seed=1, grain=False)
    k = ease(seg(t, 0.4, 1.4))
    d.rectangle([140, 840, 940, 862], fill=(200, 196, 188))
    pts = [(700 + 240 * u, 851 - 140 * k * u * u) for u in [i / 20 for i in range(21)]]
    d.line([(700, 851)] + pts, fill=(200, 196, 188), width=22)
    sw = ease(seg(t, 1.2, 2.0))
    if sw > 0:
        d.ellipse([720 - 80 * sw, 870, 920 + 20 * sw, 960 + 40 * sw], fill=(214, 196, 160))
    icon(d, 'drop', 820, 760 + 40 * math.sin(t * 4), 0.7, k=back(seg(t, 1.0, 1.4)))
    big_mark(d, t, 'no', 400, 1060, 80, 2.0)


@S('2', 'PUERTAS CHUECAS', cap=['No cierran', 'parejo'])
def v14_2(img, d, t):
    x0, y0, w, h = 240, 720, 600, 560
    d.rectangle([x0 - 16, y0 - 16, x0 + w + 16, y0 + h + 16], fill=(90, 100, 108))
    d.rectangle([x0, y0, x0 + w / 2 - 4, y0 + h], fill=FIN, outline=mix(FIN, (0, 0, 0), 0.35), width=3)
    ang = 4 * ease(seg(t, 0.4, 1.2))
    door = Image.new('RGBA', (int(w / 2), h), FIN + (255,))
    ImageDraw.Draw(door).rectangle([0, 0, w / 2 - 1, h - 1], outline=mix(FIN, (0, 0, 0), 0.35), width=3)
    door = door.rotate(ang, expand=True, resample=Image.BICUBIC)
    img.paste(door, (int(x0 + w / 2 + 4), int(y0 + 20 * seg(t, 0.4, 1.2))), door)
    d = ImageDraw.Draw(img)
    handle_bar(d, x0 + w / 2 - 30, y0 + h / 2, True, 70, GOLD)
    big_mark(d, t, 'no', W / 2, 1000, 80, 1.6)


@S('3', 'CAJONES QUE ROZAN', cap=['O se atoran', 'desde el primer día'])
def v14_3(img, d, t):
    d.rectangle([230, 760, 850, 1020], fill=(90, 100, 108))
    u = seg(t, 0.3, 2.0)
    jerk = min(u, 0.25) + max(0, u - 0.5) * 0.3 if u < 0.9 else 0.37
    drawer_box(d, W / 2 + 6 * math.sin(t * 40) * (0.25 < u < 0.5), 890, 560, 200, open_k=jerk)
    burst(d, 830, 760, '¡RRR!', t, 0.9, size=70)
    big_mark(d, t, 'no', 240, 1250, 64, 2.0)


@S('BIEN HECHO', 'REVISADO PIEZA', 'POR PIEZA', cap=['Antes de entregarse'], col=GREEN)
def v14_4(img, d, t):
    cab_front(d, W / 2, 1330, 640, 500, FIN, 2)
    for i, (x, y) in enumerate([(320, 830), (760, 830), (W / 2, 1100)]):
        check(d, x, y, 50, a=back(seg(t, 0.4 + i * 0.4, 0.8 + i * 0.4)))


video('14', '2026-12-13', 'mueble_mal_hecho', [
    'Tres señales de que tu mueble está mal hecho.',
    'Uno: cantos que se despegan. El agua entra, y la madera se hincha.',
    'Dos: puertas chuecas, o desniveladas, que no cierran parejo.',
    'Tres: cajones que rozan, o se atoran desde el primer día.',
    'Un mueble bien hecho se revisa pieza por pieza, antes de entregarse.',
    CTA_STD],
    [v14_0, v14_1, v14_2, v14_3, v14_4],
    '3 señales de que tu mueble está MAL hecho 🚩 #shorts',
    desc(['3 señales de que tu mueble está mal hecho 🚩',
          '1️⃣ Cantos que se despegan.',
          '2️⃣ Puertas chuecas que no cierran parejo.',
          '3️⃣ Cajones que rozan o se atoran.',
          '¿Tu mueble tiene alguna? 👇'], BASE_TAGS + ['#HechoEnMexico', '#Hogar']),
    ['mueble mal hecho', 'calidad muebles', 'cantos despegados', 'carpinteria', 'muebles a la medida', 'Tepatitlan', 'House Lite'],
    'Vertical Shorts cover, flat illustration: a dark gray cabinet with a crooked door, a peeling edge and red warning flags. Huge bold Spanish text: "3 SEÑALES DE UN MUEBLE MAL HECHO" with "MAL HECHO" in red. Cream background, no people.')


# =================================================================== 15
@HK([('¿INTERCAMBIO', 104, INK), ('NAVIDEÑO?', 140, ACC)])
def v15_0(img, d, t):
    room(d, 720, 1330, 1420)
    xmas_tree(d, 800, 1330, 470, t)
    k = back(seg(t, 0.5, 1.0))
    if k > 0:
        gift_box(d, 330, 1200, 0.8 * k, col=(196, 82, 64), ribbon=YELLOW)


@S('LA IDEA', 'UNA TABLA', 'CON SU NOMBRE', cap=['Útil y personal'])
def v15_1(img, d, t):
    k = back(seg(t, 0.3, 0.8))
    if k > 0:
        cutting_board(d, W / 2, 1020, 760 * k, 440 * k, text='Carmen' if k >= 1 else None, engrave=1)
    sparkle(d, 860, 760, t, 30, k=ease(seg(t, 1.0, 1.4)))


@S('GRABADO LÁSER', 'NOMBRE, FRASE', 'O LOGO', cap=['Lo que tú quieras'])
def v15_2(img, d, t):
    k = seg(t, 0.4, 2.6)
    end = cutting_board(d, W / 2, 1100, 780, 420, text='Feliz Navidad', engrave=k)
    laser_head(d, end if end else W / 2 - 330, 1100, t, on=0 < k < 1)


@S('¿POR QUÉ?', 'DURA AÑOS', cap=['Y cada vez que la usen', 'se acuerdan de ti'])
def v15_3(img, d, t):
    cutting_board(d, W / 2, 1000, 700, 400, text='Carmen', engrave=1)
    icon(d, 'heart', 860, 760, 1.3, k=back(seg(t, 0.6, 1.0)))
    for i in range(3):
        sparkle(d, 220 + i * 300, 1280, t + i, 26, k=ease(seg(t, 1.0 + i * 0.2, 1.4 + i * 0.2)))


@S('TAMBIÉN', 'PARA EMPRESAS', 'Y POSADAS', cap=['Pedidos con', 'tu logo'])
def v15_4(img, d, t):
    for i in range(3):
        k = back(seg(t, 0.3 + i * 0.3, 0.8 + i * 0.3))
        if k > 0:
            cutting_board(d, W / 2 + (i - 1) * 40, 1180 - i * 170, 560 * k, 300 * k, col=[WOOD, WOOD_L, WOOD][i], text='TU LOGO' if k >= 1 else None, engrave=1)


video('15', '2026-12-14', 'intercambio_tabla', [
    '¿Intercambio navideño, y no quieres regalar lo mismo de siempre?',
    'Regala una tabla de madera con el nombre de la persona.',
    'La grabamos con láser: nombres, frases, o hasta el logo de tu empresa.',
    'Es útil, dura años, y cada vez que la usen se van a acordar de ti.',
    'También hacemos pedidos para empresas y posadas.',
    CTA_STD],
    [v15_0, v15_1, v15_2, v15_3, v15_4],
    'El regalo perfecto para el intercambio 🎁 (con su nombre) #shorts',
    desc(['¿Intercambio navideño y no quieres regalar lo de siempre? 🎁',
          'Una tabla de madera con su nombre, grabada con láser en nuestro taller.',
          'Nombres, frases o el logo de tu empresa. También pedidos para posadas.',
          '¿Con qué nombre la pedirías? 👇'], ['#Tepatitlan', '#LosAltosDeJalisco', '#GrabadoLaser', '#Intercambio', '#Navidad', '#RegalosPersonalizados']),
    ['regalo intercambio navideño', 'tabla personalizada', 'grabado laser madera', 'regalos empresariales', 'Tepatitlan', 'House Lite'],
    'Vertical Shorts cover, flat illustration: a wooden cutting board with the name "Carmen" laser-engraved, a red laser beam and a small Christmas tree. Huge bold Spanish text: "EL REGALO PERFECTO PARA EL INTERCAMBIO". Cream background, no people.')


# =================================================================== 16
def bar_side(d, x0, y_floor, h, w=420):
    d.rectangle([x0, y_floor - h + 24, x0 + 60, y_floor], fill=FIN)
    d.rectangle([x0 - 20, y_floor - h, x0 + w, y_floor - h + 24], fill=(120, 80, 46))


@HK([('¿BARRA EN', 110, INK), ('TU COCINA?', 120, ACC)])
def v16_0(img, d, t):
    room(d, 640, 1330, 1420)
    kitchen2(d, 140, 1330, 800, base_h=260, upper_h=170, gap=170, k=1)
    for i in range(3):
        k = back(seg(t, 0.6 + i * 0.2, 1.0 + i * 0.2))
        if k > 0:
            stool(d, 300 + i * 240, 1330, 240 * k)


@S('BARRA NORMAL', '90 CM = BANCO 65', cap=['A la altura', 'de la cocina'])
def v16_1(img, d, t):
    room(d, 600, 1330, 1400)
    bar_side(d, 540, 1330, 360)
    stool(d, 360, 1330, 260)
    dim_v(d, 1000, 970, 1330, '90', seg(t, 0.4, 1.1), side=-1)
    dim_v(d, 150, 1046, 1330, '65', seg(t, 1.0, 1.7), side=1)


@S('BARRA ALTA', '1.10 M = BANCO 75', cap=['Bancos altos,', 'con reposapiés'])
def v16_2(img, d, t):
    room(d, 600, 1330, 1400)
    bar_side(d, 540, 1330, 440)
    stool(d, 360, 1330, 300)
    dim_v(d, 1000, 890, 1330, '110', seg(t, 0.4, 1.1), side=-1)
    dim_v(d, 150, 1006, 1330, '75', seg(t, 1.0, 1.7), side=1)


@S('EL ESPACIO', '60 CM POR PERSONA', cap=['Para comer', 'a gusto'])
def v16_3(img, d, t):
    room(d, 600, 1330, 1400)
    d.rectangle([120, 960, 960, 990], fill=(120, 80, 46))
    d.rectangle([140, 990, 940, 1330], fill=FIN)
    for i in range(3):
        stool(d, 260 + i * 280, 1360, 280)
    dim_h(d, 260, 540, 900, '60 cm', seg(t, 0.6, 1.3))


@S('RESULTADO', 'TODOS CÓMODOS', cap=['Con las medidas', 'correctas'], col=GREEN)
def v16_4(img, d, t):
    room(d, 600, 1330, 1400)
    d.rectangle([120, 960, 960, 990], fill=(120, 80, 46))
    d.rectangle([140, 990, 940, 1330], fill=FIN)
    for i in range(3):
        stool(d, 260 + i * 280, 1360, 280)
    big_mark(d, t, 'ok', W / 2, 800, 90, 0.8)


video('16', '2026-12-15', 'barra_bancos', [
    '¿Vas a poner barra en tu cocina? Ojo con la altura de los bancos.',
    'Si la barra va a la altura de la cocina, unos noventa centímetros, usa bancos de unos sesenta y cinco.',
    'Si es barra alta, de más o menos un metro diez, necesitas bancos de unos setenta y cinco.',
    'Y deja unos sesenta centímetros por persona, para comer a gusto.',
    'Medidas correctas, y todos comen cómodos.',
    CTA_STD],
    [v16_0, v16_1, v16_2, v16_3, v16_4],
    'Barra de cocina: la medida de los bancos que nadie te dice 🪑 #shorts',
    desc(['¿Vas a poner barra en tu cocina? 🪑 Ojo con los bancos.',
          '📏 Barra de 90 cm → bancos de unos 65 cm.',
          '📏 Barra alta de 1.10 m → bancos de unos 75 cm.',
          '✅ Deja unos 60 cm por persona.',
          '¿Barra normal o alta? 👇'], BASE_TAGS + ['#CocinasIntegrales', '#Remodelacion']),
    ['barra desayunador', 'altura barra cocina', 'altura bancos', 'cocina con barra', 'Tepatitlan', 'House Lite'],
    'Vertical Shorts cover, flat illustration: a kitchen breakfast bar with stools and orange measuring arrows. Huge bold Spanish text: "BARRA DE COCINA: LA MEDIDA DE LOS BANCOS". Cream background, no people.')


# =================================================================== 17
@HK([('¿ASÍ SE VEN', 104, INK), ('LOS CABLES', 120, ACC), ('DE TU TELE?', 96, INK)])
def v17_0(img, d, t):
    room(d, 700, 1330, 1420)
    tv(d, W / 2, 900, 560, t)
    cables(d, W / 2, 1060, 1330, t, k=ease(seg(t, 0.5, 1.3)))


@S('EL PROBLEMA', 'CABLES COLGANDO', cap=['Se ve desordenado,', 'aunque esté limpio'])
def v17_1(img, d, t):
    room(d, 600, 1330, 1400)
    tv(d, W / 2, 820, 600, t)
    cables(d, W / 2, 990, 1330, t)
    tv_unit(d, W / 2, 1330, 700, 160)
    cables(d, W / 2 + 200, 1100, 1330, t + 1, n=2)
    big_mark(d, t, 'no', W / 2, 820, 80, 1.4)


@S('LA SOLUCIÓN', 'PASACABLES', cap=['Y espacio atrás', 'para esconderlos'], col=GREEN)
def v17_2(img, d, t):
    room(d, 600, 1330, 1400)
    tv(d, W / 2, 820, 600, t)
    top = tv_unit(d, W / 2, 1330, 860, 180)
    k = 1 - ease(seg(t, 0.5, 1.6))
    cables(d, W / 2, 990, 990 + (top - 990) * 1.0 + 140 * k, t, k=1)
    d.ellipse([W / 2 - 34, top + 10, W / 2 + 34, top + 40], fill=INK)
    pill(d, W / 2, 1250, 'PASACABLES', ACC, back(seg(t, 1.4, 1.8)), 40)


@S('ADEMÁS', 'APARATOS ADENTRO', cap=['Con ventilación'])
def v17_3(img, d, t):
    room(d, 600, 1330, 1400)
    tv(d, W / 2, 820, 600, t)
    top = tv_unit(d, W / 2, 1330, 860, 180)
    k = ease(seg(t, 0.4, 1.0))
    if k > 0:
        d.rectangle([W / 2 - 140, top + 40, W / 2 + 140, top + 170], fill=(40, 34, 30))
        d.rounded_rectangle([W / 2 - 110, top + 90, W / 2 + 110, top + 150], 8, fill=(70, 70, 76))
        d.ellipse([W / 2 + 60, top + 110, W / 2 + 76, top + 126], fill=GREEN)
        for i in range(5):
            d.line([W / 2 - 100 + i * 16, top + 56, W / 2 - 100 + i * 16, top + 76], fill=STEEL, width=4)


@S('RESULTADO', 'CERO CABLES', 'A LA VISTA', cap=['Misma sala,', 'más ordenada'], col=GREEN)
def v17_4(img, d, t):
    room(d, 600, 1330, 1400)
    tv(d, W / 2, 840, 600, t)
    tv_unit(d, W / 2, 1330, 860, 180)
    big_mark(d, t, 'ok', W / 2, 840, 90, 0.8)


video('17', '2026-12-16', 'esconder_cables', [
    '¿Así se ven los cables de tu tele? Tiene solución.',
    'Los cables colgando hacen que la sala se vea desordenada, aunque todo esté limpio.',
    'En un mueble a la medida dejamos pasacables, y un espacio atrás para esconderlos.',
    'Los aparatos quedan adentro, con ventilación, y solo se ve lo que tú quieres.',
    'Misma sala, y cero cables a la vista.',
    CTA_STD],
    [v17_0, v17_1, v17_2, v17_3, v17_4],
    'Adiós a los cables de la tele 🔌 (así se esconden) #shorts',
    desc(['¿Así se ven los cables de tu tele? 🔌 Tiene solución.',
          'En un mueble a la medida dejamos pasacables y un espacio atrás para esconderlos.',
          'Los aparatos quedan adentro, con ventilación ✅',
          '¿Los tuyos están a la vista? 👇'], BASE_TAGS + ['#MuebleDeTV', '#DecoracionDeInteriores']),
    ['esconder cables tv', 'mueble de tv', 'pasacables', 'organizar sala', 'muebles a la medida', 'Tepatitlan', 'House Lite'],
    'Vertical Shorts cover, flat illustration: a TV with messy black cables hanging (red X) versus a clean TV stand with hidden cables (green check). Huge bold Spanish text: "ADIÓS A LOS CABLES". Cream background, no people.')


# =================================================================== 18
def awning(d, k=1.0):
    if k <= 0:
        return
    for i in range(8):
        x = 100 + i * 110
        d.polygon([(x, 600), (x + 110, 600), (x + 110, 600 + 110 * k), (x + 55, 640 + 110 * k), (x, 600 + 110 * k)], fill=ACC if i % 2 == 0 else WHITE)


@HK([('¿TIENES', 120, INK), ('NEGOCIO?', 150, ACC)])
def v18_0(img, d, t):
    d.rectangle([0, 720, W, 1330], fill=WALL)
    d.rectangle([0, 1330, W, 1420], fill=(200, 200, 205))
    counter_shop(d, W / 2, 1330, 720, 360, logo=seg(t, 1.0, 1.4), logo_text='TU NEGOCIO')


@S('1', 'ALTURA CÓMODA', cap=['Para atender y cobrar', 'sin dolor de espalda'])
def v18_1(img, d, t):
    d.rectangle([0, 600, W, 1330], fill=WALL)
    d.rectangle([0, 1330, W, 1400], fill=(200, 200, 205))
    counter_shop(d, 600, 1330, 660, 380)
    dim_v(d, 170, 920, 1330, '', seg(t, 0.5, 1.2))
    pill(d, 600, 800, 'A TU ALTURA', ACC, back(seg(t, 1.0, 1.4)), 48)


@S('2', 'ESPACIO', 'PARA GUARDAR', cap=['Cajones y repisas', 'del lado de adentro'])
def v18_2(img, d, t):
    d.rectangle([0, 600, W, 1330], fill=WALL)
    d.rectangle([0, 1330, W, 1400], fill=(200, 200, 205))
    cx, w, h = W / 2, 760, 380
    y0 = 1330 - h
    d.rectangle([cx - w / 2 - 30, y0 - 30, cx + w / 2 + 30, y0], fill=WOOD)
    d.rectangle([cx - w / 2, y0, cx + w / 2, 1330], fill=(60, 48, 38))
    for i in range(3):
        k = ease(seg(t, 0.3 + i * 0.3, 0.7 + i * 0.3))
        x = cx - w / 2 + 20 + i * (w - 40) / 3
        if i < 2:
            for j in range(3):
                d.rectangle([x + 10, y0 + 20 + j * 115, x + (w - 40) / 3 - 10, y0 + 20 + j * 115 + 100 * k], fill=FIN, outline=INK, width=2)
                if k >= 1:
                    handle_bar(d, x + (w - 40) / 6, y0 + 60 + j * 115, False, 60, GOLD)
        else:
            for j in range(2):
                d.rectangle([x + 10, y0 + 170 * (j + 1), x + (w - 40) / 3 - 10, y0 + 170 * (j + 1) + 14], fill=WOOD_L)
    pill(d, W / 2, 860, 'VISTA DE ADENTRO', INK, back(seg(t, 0.2, 0.6)), 36)


@S('3', 'TU LOGO AL FRENTE', cap=['Para que tu marca', 'se vea desde la entrada'])
def v18_3(img, d, t):
    d.rectangle([0, 600, W, 1330], fill=WALL)
    d.rectangle([0, 1330, W, 1400], fill=(200, 200, 205))
    counter_shop(d, W / 2, 1330, 760, 400, logo=seg(t, 0.6, 1.1))
    for i in range(3):
        sparkle(d, 220 + i * 320, 860, t + i, 26, k=ease(seg(t, 1.2 + i * 0.2, 1.6 + i * 0.2)))


@S('RESULTADO', 'A LA MEDIDA', 'DE TU LOCAL', cap=['Lo diseñamos', 'para tu negocio'], col=GREEN)
def v18_4(img, d, t):
    d.rectangle([0, 600, W, 1330], fill=WALL)
    d.rectangle([0, 1330, W, 1400], fill=(200, 200, 205))
    awning(d, ease(seg(t, 0.2, 0.8)))
    counter_shop(d, W / 2, 1330, 760, 380, logo=1)
    big_mark(d, t, 'ok', 900, 860, 64, 1.0)


video('18', '2026-12-17', 'mostrador_negocio', [
    '¿Tienes negocio? Tu mostrador es lo primero que ve tu cliente.',
    'Uno: que tenga una altura cómoda para atender y cobrar, sin que te duela la espalda.',
    'Dos: espacio para guardar, con cajones y repisas del lado de adentro.',
    'Tres: un frente con tu logo, para que tu marca se vea desde la entrada.',
    'Lo diseñamos a la medida de tu local.',
    CTA_STD],
    [v18_0, v18_1, v18_2, v18_3, v18_4],
    '3 cosas que tu mostrador DEBE tener 🏪 #shorts',
    desc(['¿Tienes negocio? 🏪 Tu mostrador es lo primero que ve tu cliente.',
          '1️⃣ Altura cómoda para atender y cobrar.',
          '2️⃣ Cajones y repisas del lado de adentro.',
          '3️⃣ Tu logo al frente.',
          '¿Qué negocio tienes? 👇'], BASE_TAGS + ['#Mostradores', '#NegociosLocales']),
    ['mostrador para negocio', 'mostrador de madera', 'muebles para negocio', 'mostrador con logo', 'Tepatitlan', 'House Lite'],
    'Vertical Shorts cover, flat illustration: a modern shop counter with an orange logo panel on the front and a striped awning above. Huge bold Spanish text: "3 COSAS QUE TU MOSTRADOR DEBE TENER". Cream background, no people.')


# =================================================================== 19
def laundry(d, t, cabs=0.0, shelf=0.0, top=0.0, items=0.0):
    room(d, 600, 1330, 1400, wall=(226, 232, 230))
    washer(d, 200, 1330, 1.1)
    washer(d, 560, 1330, 1.1)
    if top > 0:
        d.rectangle([180, 1330 - 396 - 30 * top, 920, 1330 - 396], fill=WOOD)
        for i, c in enumerate([(196, 82, 64), (70, 120, 170), (230, 190, 90)]):
            q = back(seg(top, 0.4 + i * 0.15, 0.7 + i * 0.15))
            if q > 0:
                d.rectangle([700, 1330 - 426 - (i + 1) * 30 * q, 860, 1330 - 426 - i * 30 * q], fill=c)
    if cabs > 0:
        for i in range(3):
            q = ease(seg(cabs, i * 0.2, i * 0.2 + 0.6))
            wall_cab(d, 180 + i * 250, 640, 240, 220, LIGHT, q)
    if shelf > 0:
        d.rectangle([180, 900, 180 + 740 * ease(shelf), 916], fill=WOOD)
        for i in range(4):
            q = back(seg(items, i * 0.15, i * 0.15 + 0.4))
            if q > 0:
                icon(d, 'bottle', 250 + i * 180, 860, 0.6 * q, col=[(120, 170, 220), (230, 120, 90), (120, 190, 140), (240, 200, 90)][i])


@HK([('¿TU CUARTO', 104, INK), ('DE LAVADO', 120, ACC), ('ES UN CAOS?', 96, INK)])
def v19_0(img, d, t):
    room(d, 700, 1330, 1420, wall=(226, 232, 230))
    washer(d, 380, 1330, 1.1)
    rnd = random.Random(2)
    for i in range(6):
        k = back(seg(t, 0.5 + i * 0.12, 0.9 + i * 0.12))
        if k > 0:
            icon(d, 'bottle', rnd.choice([180, 260, 820, 900]), 1270 - rnd.uniform(0, 30), 0.6 * k, col=[(120, 170, 220), (230, 120, 90), (120, 190, 140)][i % 3])


@S('MIRA ARRIBA', 'ESPACIO PERDIDO', cap=['Arriba de la lavadora', 'casi siempre sobra'])
def v19_1(img, d, t):
    laundry(d, t)
    a = seg(t, 0.5, 0.9) * (0.6 + 0.4 * math.sin(t * 6))
    if a > 0:
        d.rectangle([180, 640, 920, 880], outline=mix(WALL, ACC, a), width=8)
    pill(d, 550, 760, '¿Y ESTO?', ACC, back(seg(t, 1.0, 1.4)), 48)


@S('LA SOLUCIÓN', 'GABINETES Y REPISAS', cap=['Detergente, cubetas', 'y trapos en orden'], col=GREEN)
def v19_2(img, d, t):
    laundry(d, t, cabs=seg(t, 0.3, 1.4), shelf=seg(t, 1.2, 1.6), items=seg(t, 1.5, 2.4))


@S('EXTRA', 'CUBIERTA', 'PARA DOBLAR', cap=['Si tu lavadora', 'es de carga frontal'])
def v19_3(img, d, t):
    laundry(d, t, cabs=1, shelf=1, items=1, top=seg(t, 0.4, 1.6))


@S('RESULTADO', 'TODO EN ORDEN', cap=['En el mismo espacio'], col=GREEN)
def v19_4(img, d, t):
    laundry(d, t, 1, 1, 1, 1)
    big_mark(d, t, 'ok', W / 2, 1150, 80, 0.8)


video('19', '2026-12-18', 'cuarto_lavado', [
    '¿Tu cuarto de lavado es un caos? Mira hacia arriba.',
    'Arriba de la lavadora casi siempre hay espacio desperdiciado.',
    'Con gabinetes y repisas a la medida, ahí guardas detergente, cubetas y trapos.',
    'Y si tu lavadora es de carga frontal, una cubierta encima te sirve para doblar la ropa.',
    'Un cuarto de lavado ordenado, en el mismo espacio.',
    CTA_STD],
    [v19_0, v19_1, v19_2, v19_3, v19_4],
    'Tu cuarto de lavado puede verse así 🧺 #shorts',
    desc(['¿Tu cuarto de lavado es un caos? 🧺 Mira hacia arriba.',
          'Arriba de la lavadora casi siempre hay espacio desperdiciado.',
          '✅ Gabinetes y repisas a la medida para detergente, cubetas y trapos.',
          '¿Cómo está el tuyo? 👇'], BASE_TAGS + ['#CuartoDeLavado', '#Hogar']),
    ['cuarto de lavado', 'organizar lavanderia', 'muebles para lavanderia', 'gabinetes lavadora', 'Tepatitlan', 'House Lite'],
    'Vertical Shorts cover, flat illustration: a laundry room with two washing machines, light cabinets and shelves above with colorful detergent bottles. Huge bold Spanish text: "TU CUARTO DE LAVADO PUEDE VERSE ASÍ". Cream background, no people.')


# =================================================================== 20
def closet_slide(d, cx, cy, w, h, slide=0.0, color=(120, 90, 60), inner=True):
    closet(d, cx, cy, w, h, doors=0, inner=inner)
    x0, x1, y0, y1 = cx - w / 2 + 22, cx + w / 2 - 22, cy - h / 2 + 22, cy + h / 2 - 22
    dw = (x1 - x0) / 2
    d.rectangle([x0 - 10, y0 - 30, x1 + 10, y0 - 10], fill=STEEL)
    off = slide * (dw - 10)
    d.rectangle([x0 + off, y0, x0 + dw + off, y1], fill=color, outline=mix(color, (0, 0, 0), 0.3), width=4)
    d.rectangle([x0 + dw - 6, y0 + 8, x1 - 6, y1 + 8], fill=mix(color, (0, 0, 0), 0.08), outline=mix(color, (0, 0, 0), 0.3), width=4)
    handle_bar(d, x0 + dw - 40 + off, cy, True, 120, GOLD)


@HK([('¿CORREDIZAS', 110, INK), ('O ABATIBLES?', 110, ACC)])
def v20_0(img, d, t):
    k = back(seg(t, 0.3, 0.8))
    if k > 0:
        closet_slide(d, 290, 1060, 420 * k, 600 * k, slide=0.5 + 0.5 * math.sin(t * 2), inner=False)
        closet(d, 790, 1060, 420 * k, 600 * k, doors=0.5 + 0.5 * math.sin(t * 2 + 1), inner=False, color=(120, 90, 60))
        label(d, 290, 1420, 'CORREDIZA', 40, INK, k)
        label(d, 790, 1420, 'ABATIBLE', 40, INK, k)


@S('CORREDIZAS', 'NO OCUPAN ESPACIO', cap=['Ideales si la recámara', 'es chica'])
def v20_1(img, d, t):
    closet_slide(d, W / 2, 1000, 700, 760, slide=ease_io(seg(t, 0.5, 1.6)))
    check(d, 900, 640, 56, a=back(seg(t, 1.8, 2.2)))


@S('ABATIBLES', 'ABRES TODO', cap=['Y puedes colgar cosas', 'en la puerta'])
def v20_2(img, d, t):
    closet(d, W / 2, 1000, 700, 760, doors=1 - ease(seg(t, 0.5, 1.5)))
    check(d, 900, 640, 56, a=back(seg(t, 1.8, 2.2)))


@S('LA REGLA', '¿TE SOBRA', 'O TE FALTA?')
def v20_3(img, d, t):
    list_rows(d, t, [(None, 'Te sobra: abatibles', None), (None, 'Te falta: corredizas', None)], y0=800, gap=260, start=0.4, step=0.8, size=56)


@S('NOSOTROS', 'TE AYUDAMOS', 'A ELEGIR', cap=['Según tu espacio'], col=GREEN)
def v20_4(img, d, t):
    closet_slide(d, W / 2, 1050, 640, 640, slide=0)
    icon(d, 'chat', 880, 720, 1.2, k=back(seg(t, 0.5, 0.9)))
    big_mark(d, t, 'ok', W / 2, 1050, 80, 1.2)


video('20', '2026-12-19', 'closet_puertas', [
    '¿Closet con puertas corredizas, o abatibles? Depende de tu cuarto.',
    'Las corredizas no ocupan espacio al abrir. Son ideales si tu recámara es chica, o la cama queda cerca.',
    'Las abatibles abren todo el closet de un jalón, y por dentro puedes colgar cosas en la puerta.',
    'La regla: si te sobra espacio, abatibles. Si te falta, corredizas.',
    'Y si no sabes cuál, te ayudamos a elegir según tu espacio.',
    CTA_STD],
    [v20_0, v20_1, v20_2, v20_3, v20_4],
    '¿Closet corredizo o abatible? Así eliges 🚪 #shorts',
    desc(['¿Closet con puertas corredizas o abatibles? 🚪',
          '↔️ Corredizas: no ocupan espacio al abrir. Ideales en recámaras chicas.',
          '🚪 Abatibles: abres todo de un jalón.',
          'La regla: si te sobra espacio, abatibles. Si te falta, corredizas.',
          '¿Tú cuál tienes? 👇'], BASE_TAGS + ['#Closets', '#Recamara']),
    ['closet puertas corredizas', 'closet puertas abatibles', 'closet a la medida', 'recamara pequeña', 'Tepatitlan', 'House Lite'],
    'Vertical Shorts cover, flat illustration: two wooden closets side by side, one with sliding doors and one with swinging doors, with a "VS" in the middle. Huge bold Spanish text: "¿CORREDIZAS O ABATIBLES?". Cream background, no people.')
