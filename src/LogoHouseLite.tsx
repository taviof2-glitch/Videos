import { Audio } from "@remotion/media";
import { loadFont } from "@remotion/google-fonts/Montserrat";
import {
  AbsoluteFill,
  Easing,
  Img,
  Sequence,
  interpolate,
  interpolateColors,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

const { fontFamily } = loadFont("normal", {
  weights: ["500", "700", "800"],
  subsets: ["latin"],
});

// Colores tomados de las imágenes de los logos
const GOLD = "#E4B672";
const BG_OLD = "#020102";
const BG_NEW = "#1D1D1F";
const WHITE = "#FFFFFF";
const WHATSAPP = "#22A85A";

const clamp = {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
} as const;
const easeOut = Easing.bezier(0.16, 1, 0.3, 1);
const easeInOut = Easing.bezier(0.65, 0, 0.35, 1);

// La narración dura 26.5 s; los tiempos (en segundos) salen de sus pausas.
export const LOGO_VIDEO_SECONDS = 27;
const MORPH_START = 7.5;
const STAGE_END = 15.9;
const COMPARE_START = 15.75;
const CTA_START = 21.2;

const useSeconds = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return frame / fps;
};

/** Logo nuevo trazado en SVG (misma geometría que public/logo-nuevo.png). */
const NewLogoMark: React.FC<{
  size: number;
  progress?: number;
  roofColor?: string;
}> = ({ size, progress = 1, roofColor = WHITE }) => {
  const part = (start: number, end: number) =>
    interpolate(progress, [start, end], [0, 1], clamp);
  const stroke = (p: number) => ({
    pathLength: 1,
    strokeDasharray: "1 1",
    strokeDashoffset: 1 - p,
    opacity: p > 0 ? 1 : 0,
    fill: "none",
    strokeWidth: 72,
  });
  return (
    <svg viewBox="0 0 1024 1024" width={size} height={size}>
      <path
        d="M344 560 L512 440 L680 560"
        stroke={roofColor}
        strokeLinejoin="round"
        {...stroke(part(0.25, 0.8))}
      />
      <path
        d="M344 314 V710"
        stroke={WHITE}
        strokeLinecap="round"
        {...stroke(part(0, 0.55))}
      />
      <path
        d="M680 710 V314"
        stroke={WHITE}
        strokeLinecap="round"
        {...stroke(part(0.45, 1))}
      />
    </svg>
  );
};

const Background: React.FC = () => {
  const t = useSeconds();
  return (
    <AbsoluteFill
      style={{
        backgroundColor: interpolateColors(
          t,
          [MORPH_START + 1.1, MORPH_START + 2.9],
          [BG_OLD, BG_NEW],
        ),
      }}
    />
  );
};

const LOGO_BOX = 960;
const LOGO_CENTER_Y = 800;

const stageBox: React.CSSProperties = {
  position: "absolute",
  left: (1080 - LOGO_BOX) / 2,
  top: LOGO_CENTER_Y - LOGO_BOX / 2,
  width: LOGO_BOX,
  height: LOGO_BOX,
};

const OldLogo: React.FC = () => {
  const t = useSeconds();
  return (
    <Img
      src={staticFile("logo-anterior.png")}
      style={{
        ...stageBox,
        opacity:
          interpolate(t, [0, 0.4], [0, 1], clamp) *
          interpolate(t, [MORPH_START, MORPH_START + 1.2], [1, 0], clamp),
        scale:
          interpolate(t, [0, MORPH_START], [0.92, 1], clamp) *
          interpolate(t, [MORPH_START, MORPH_START + 1.4], [1, 0.86], {
            ...clamp,
            easing: easeInOut,
          }),
        filter: `blur(${interpolate(t, [MORPH_START, MORPH_START + 1.2], [0, 18], clamp)}px)`,
      }}
    />
  );
};

/** El aro dorado del logo anterior se queda, se encoge y se vuelve la H. */
const Ring: React.FC = () => {
  const t = useSeconds();
  return (
    <svg
      viewBox="0 0 1254 1254"
      style={{
        ...stageBox,
        opacity:
          interpolate(t, [MORPH_START, MORPH_START + 0.5], [0, 1], clamp) *
          interpolate(t, [MORPH_START + 2.1, MORPH_START + 2.8], [1, 0], clamp),
        scale: interpolate(
          t,
          [MORPH_START + 1.2, MORPH_START + 2.8],
          [1, 0.42],
          { ...clamp, easing: easeInOut },
        ),
        rotate: `${interpolate(t, [MORPH_START + 1.2, MORPH_START + 2.8], [0, -90], { ...clamp, easing: easeInOut })}deg`,
      }}
    >
      <circle
        cx={627}
        cy={627}
        r={455}
        fill="none"
        strokeWidth={12}
        stroke={interpolateColors(
          t,
          [MORPH_START + 1.2, MORPH_START + 2.4],
          [GOLD, WHITE],
        )}
      />
    </svg>
  );
};

const NewLogoOnStage: React.FC = () => {
  const t = useSeconds();
  return (
    <div
      style={{
        ...stageBox,
        scale: interpolate(t, [MORPH_START + 2, STAGE_END], [1.2, 1.3], clamp),
      }}
    >
      <NewLogoMark
        size={LOGO_BOX}
        progress={interpolate(
          t,
          [MORPH_START + 2, MORPH_START + 3.4],
          [0, 1],
          { ...clamp, easing: easeInOut },
        )}
        roofColor={interpolateColors(
          t,
          [12.3, 12.8, 14.6, 15.2],
          [WHITE, GOLD, GOLD, WHITE],
        )}
      />
    </div>
  );
};

const Chip: React.FC<{ from: number; to: number; children: string }> = ({
  from,
  to,
  children,
}) => {
  const t = useSeconds();
  return (
    <div
      style={{
        position: "absolute",
        top: 190,
        width: "100%",
        display: "flex",
        justifyContent: "center",
        opacity:
          interpolate(t, [from, from + 0.35], [0, 1], clamp) *
          interpolate(t, [to - 0.3, to], [1, 0], clamp),
        translate: interpolate(t, [from, from + 0.5], ["0px 16px", "0px 0px"], {
          ...clamp,
          easing: easeOut,
        }),
      }}
    >
      <div
        style={{
          fontFamily,
          fontWeight: 700,
          fontSize: 36,
          letterSpacing: 6,
          color: GOLD,
          border: `2px solid ${GOLD}`,
          borderRadius: 999,
          padding: "14px 40px",
        }}
      >
        {children}
      </div>
    </div>
  );
};

const LogoStage: React.FC = () => {
  const t = useSeconds();
  return (
    <AbsoluteFill
      style={{
        opacity: interpolate(t, [STAGE_END - 0.35, STAGE_END], [1, 0], clamp),
      }}
    >
      <OldLogo />
      <Ring />
      <NewLogoOnStage />
      <Chip from={2.3} to={MORPH_START + 0.2}>
        LOGO ANTERIOR
      </Chip>
      <Chip from={MORPH_START + 3.4} to={STAGE_END - 0.3}>
        NUEVO LOGO
      </Chip>
    </AbsoluteFill>
  );
};

const CARD = 450;

const CompareCard: React.FC<{
  src: string;
  label: string;
  delay: number;
  fromX: number;
  highlight?: boolean;
}> = ({ src, label, delay, fromX, highlight }) => {
  const t = useSeconds();
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 28,
        opacity: interpolate(t, [delay, delay + 0.4], [0, 1], clamp),
        translate: interpolate(
          t,
          [delay, delay + 0.7],
          [`${fromX}px 0px`, "0px 0px"],
          { ...clamp, easing: easeOut },
        ),
      }}
    >
      <Img
        src={staticFile(src)}
        style={{
          width: CARD,
          height: CARD,
          borderRadius: 40,
          border: `3px solid ${highlight ? GOLD : "rgba(255,255,255,0.18)"}`,
        }}
      />
      <div
        style={{
          fontFamily,
          fontWeight: 800,
          fontSize: 44,
          letterSpacing: 6,
          color: highlight ? GOLD : "rgba(255,255,255,0.6)",
        }}
      >
        {label}
      </div>
    </div>
  );
};

const Compare: React.FC = () => {
  const t = useSeconds();
  const duration = CTA_START - COMPARE_START;
  return (
    <AbsoluteFill
      style={{
        opacity:
          interpolate(t, [0, 0.3], [0, 1], clamp) *
          interpolate(t, [duration - 0.3, duration], [1, 0], clamp),
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 470,
          width: "100%",
          display: "flex",
          justifyContent: "center",
          gap: 60,
        }}
      >
        <CompareCard
          src="logo-anterior.png"
          label="ANTES"
          delay={0.15}
          fromX={-60}
        />
        <CompareCard
          src="logo-nuevo.png"
          label="AHORA"
          delay={0.55}
          fromX={60}
          highlight
        />
      </div>
      <div
        style={{
          position: "absolute",
          top: 470 + CARD / 2 - 48,
          left: 540 - 48,
          width: 96,
          height: 96,
          borderRadius: 48,
          backgroundColor: GOLD,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          scale: interpolate(t, [0.8, 1.2], [0, 1], {
            ...clamp,
            easing: easeOut,
          }),
        }}
      >
        <svg width={52} height={52} viewBox="0 0 24 24">
          <path
            d="M4 12h15M13 5l7 7-7 7"
            fill="none"
            stroke={BG_NEW}
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </AbsoluteFill>
  );
};

const PHONE_GROUPS: { text: string; at: number }[] = [
  { text: "378", at: 22.6 },
  { text: "170", at: 23.7 },
  { text: "8278", at: 24.8 },
];

const Cta: React.FC = () => {
  const t = useSeconds();
  const rise = (delay: number): React.CSSProperties => ({
    opacity: interpolate(t, [delay, delay + 0.4], [0, 1], clamp),
    translate: interpolate(
      t,
      [delay, delay + 0.6],
      ["0px 30px", "0px 0px"],
      { ...clamp, easing: easeOut },
    ),
  });
  return (
    <AbsoluteFill
      style={{
        fontFamily,
        color: WHITE,
        alignItems: "center",
        textAlign: "center",
        paddingTop: 230,
      }}
    >
      <div style={rise(0.1)}>
        <NewLogoMark size={420} />
      </div>
      <div style={{ ...rise(0.25), fontWeight: 800, fontSize: 112 }}>
        HOUSE LITE
      </div>
      <div
        style={{ ...rise(0.35), fontWeight: 500, fontSize: 52, color: GOLD }}
      >
        Carpintería y muebles a la medida
      </div>
      <div
        style={{
          ...rise(0.6),
          marginTop: 90,
          width: 880,
          borderRadius: 70,
          backgroundColor: WHATSAPP,
          padding: "44px 0 50px",
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 54 }}>Cotiza por WhatsApp</div>
        <div
          style={{
            fontWeight: 800,
            fontSize: 112,
            display: "flex",
            justifyContent: "center",
            gap: 30,
          }}
        >
          {PHONE_GROUPS.map((g) => (
            <span
              key={g.text}
              style={{
                opacity: interpolate(
                  t,
                  [g.at - CTA_START, g.at - CTA_START + 0.2],
                  [0.35, 1],
                  clamp,
                ),
              }}
            >
              {g.text}
            </span>
          ))}
        </div>
      </div>
      <div
        style={{
          ...rise(0.9),
          marginTop: 70,
          fontWeight: 500,
          fontSize: 46,
          color: "rgba(255,255,255,0.85)",
        }}
      >
        Lunes a sábado · 9:00 a 20:00
      </div>
      <div
        style={{
          ...rise(1),
          marginTop: 14,
          fontWeight: 700,
          fontSize: 46,
          color: GOLD,
        }}
      >
        Envío gratis en Tepatitlán
      </div>
    </AbsoluteFill>
  );
};

// Subtítulos sincronizados con la narración (segundos)
const CAPTIONS: { from: number; to: number; text: string }[] = [
  { from: 0, to: 2.1, text: "House Lite se está reinventando" },
  { from: 2.26, to: 4.65, text: "Este logo nos acompañó en cada cocina," },
  { from: 4.65, to: 7.25, text: "cada clóset y cada mueble que hicimos" },
  { from: 7.44, to: 9.45, text: "Hoy damos un paso adelante" },
  { from: 9.6, to: 10.5, text: "Más simple." },
  { from: 10.6, to: 11.65, text: "Más moderno." },
  { from: 11.8, to: 13.65, text: "Una H que también es un techo:" },
  { from: 13.65, to: 15.7, text: "tu casa, hecha a la medida" },
  { from: 15.9, to: 18.85, text: "Cambia el logo, pero no las manos que hacen tus muebles" },
  { from: 18.9, to: 21.15, text: "El mismo taller, aquí en Tepatitlán" },
];

const Captions: React.FC = () => {
  const t = useSeconds();
  const caption = CAPTIONS.find((c) => t >= c.from && t < c.to);
  if (!caption) {
    return null;
  }
  return (
    <div
      style={{
        position: "absolute",
        top: 1330,
        left: 80,
        width: 920,
        height: 260,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        fontFamily,
        fontWeight: 800,
        fontSize: 72,
        lineHeight: 1.15,
        color: WHITE,
        textWrap: "balance",
        opacity: interpolate(t, [caption.from, caption.from + 0.15], [0, 1], clamp),
        translate: interpolate(
          t,
          [caption.from, caption.from + 0.25],
          ["0px 14px", "0px 0px"],
          { ...clamp, easing: easeOut },
        ),
      }}
    >
      {caption.text}
    </div>
  );
};

export const LogoHouseLite: React.FC = () => {
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill>
      <Background />
      <Sequence name="Logo anterior → nuevo" durationInFrames={STAGE_END * fps}>
        <LogoStage />
      </Sequence>
      <Sequence
        name="Antes y ahora"
        from={COMPARE_START * fps}
        durationInFrames={(CTA_START - COMPARE_START) * fps}
      >
        <Compare />
      </Sequence>
      <Sequence name="Cierre WhatsApp" from={CTA_START * fps}>
        <Cta />
      </Sequence>
      <Captions />
      <Audio src={staticFile("voz.mp3")} />
    </AbsoluteFill>
  );
};
