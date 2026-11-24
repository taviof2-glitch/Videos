import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  Badge,
  C,
  Check,
  Dots,
  EndCard,
  Panel,
  Pop,
  Scene,
  SeriesTag,
  StopSign,
  Sub,
  Title,
} from "./ui";
import { Soundtrack } from "./Audio";

// Tiempos (segundos) alineados con la locución voz_closet.mp3
const T = {
  error: 5.0,
  zonas: 11.1,
  medio: 14.8,
  abajo: 21.0,
  resultado: 23.6,
  fin: 25.85,
  total: 32.5,
};
export const CLOSET_DURATION = T.total;

const COLORS = [
  "#E07B2E",
  "#3E6E8E",
  "#D9B44A",
  "#8E5A9E",
  "#4E8A4A",
  "#C94F4F",
  "#2F3B48",
];
const L = 120; // izquierda del closet
const W = 560;
const TOP = 30;
const BOTTOM = 610;
const FRAME = 18;
const IN_L = L + FRAME;
const IN_W = W - FRAME * 2;
const MID = IN_L + IN_W / 2;

const Frame: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
  <>
    <div
      style={{
        position: "absolute",
        left: L,
        top: TOP,
        width: W,
        height: BOTTOM - TOP,
        backgroundColor: "#F7F1E6",
        border: `${FRAME}px solid ${C.wood}`,
        boxSizing: "border-box",
      }}
    />
    {children}
  </>
);

const Shelf: React.FC<{ y: number; x?: number; w?: number }> = ({
  y,
  x = IN_L,
  w = IN_W,
}) => (
  <div
    style={{
      position: "absolute",
      left: x,
      top: y,
      width: w,
      height: 12,
      backgroundColor: C.wood,
    }}
  />
);

/** Montón de ropa doblada; `mess` lo hace desordenado y tambaleante. */
const Pile: React.FC<{
  x: number;
  y: number;
  n: number;
  seed: number;
  mess?: boolean;
  w?: number;
}> = ({ x, y, n, seed, mess = false, w = 120 }) => {
  const frame = useCurrentFrame();
  return (
    <>
      {new Array(n).fill(0).map((_, i) => {
        const off = mess ? ((seed * 7 + i * 13) % 5) * 9 - 18 : 0;
        const rot = mess
          ? (((seed + i * 3) % 5) - 2) * 4 +
            Math.sin((frame + i * 8 + seed * 5) / 7) * (i === n - 1 ? 6 : 1.5)
          : 0;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x + off,
              top: y - (i + 1) * 24,
              width: w,
              height: 22,
              borderRadius: 7,
              backgroundColor: COLORS[(seed + i) % COLORS.length],
              rotate: `${rot}deg`,
            }}
          />
        );
      })}
    </>
  );
};

const Hanger: React.FC<{
  x: number;
  y: number;
  h: number;
  color: string;
  w?: number;
  delay?: number;
}> = ({ x, y, h, color, w = 46, delay = 0 }) => {
  const frame = useCurrentFrame();
  const sway = Math.sin((frame - delay) / 9 + x) * 2;
  const drop = interpolate(frame, [delay, delay + 12], [-40, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.34, 1.56, 0.64, 1),
  });
  const o = interpolate(frame, [delay, delay + 5], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y + drop,
        width: w,
        opacity: o,
        rotate: `${sway}deg`,
        transformOrigin: "50% 0%",
      }}
    >
      <div
        style={{
          margin: "0 auto",
          width: 4,
          height: 16,
          backgroundColor: "#666",
        }}
      />
      <div
        style={{
          width: w,
          height: h,
          backgroundColor: color,
          borderRadius: "14px 14px 6px 6px",
        }}
      />
    </div>
  );
};

const Rod: React.FC<{ x: number; w: number; y: number }> = ({ x, w, y }) => (
  <div
    style={{
      position: "absolute",
      left: x + 6,
      top: y,
      width: w - 12,
      height: 8,
      borderRadius: 4,
      backgroundColor: "#8C8C8C",
    }}
  />
);

export const Messy: React.FC = () => (
  <Frame>
    {[150, 270, 390, 510].map((y) => (
      <Shelf key={y} y={y} />
    ))}
    <Pile x={IN_L + 40} y={150} n={4} seed={1} mess />
    <Pile x={IN_L + 250} y={150} n={5} seed={4} mess w={150} />
    <Pile x={IN_L + 30} y={270} n={4} seed={2} mess w={160} />
    <Pile x={IN_L + 300} y={270} n={3} seed={6} mess />
    <Pile x={IN_L + 60} y={390} n={4} seed={3} mess w={140} />
    <Pile x={IN_L + 270} y={390} n={4} seed={5} mess w={170} />
    <Pile x={IN_L + 30} y={510} n={4} seed={0} mess w={200} />
    <Pile x={IN_L + 310} y={510} n={3} seed={2} mess />
    <Pile x={IN_L + 120} y={BOTTOM - FRAME} n={2} seed={4} mess w={180} />
  </Frame>
);

const ZoneLabel: React.FC<{ y: number; text: string; delay: number }> = ({
  y,
  text,
  delay,
}) => (
  <Pop
    delay={delay}
    from={0.3}
    style={{ position: "absolute", left: 698, top: y }}
  >
    <div
      style={{
        backgroundColor: C.orange,
        color: C.white,
        fontWeight: 800,
        fontSize: 30,
        padding: "10px 12px",
        borderRadius: 12,
        width: 150,
        textAlign: "center",
        lineHeight: 1.15,
      }}
    >
      {text}
    </div>
  </Pop>
);

/** Closet organizado. Cada zona aparece en su frame (o -1 para mostrar todo). */
export const Organized: React.FC<{
  top: number;
  mid: number;
  bottom: number;
  labels?: boolean;
}> = ({ top, mid, bottom, labels = false }) => {
  const frame = useCurrentFrame();
  const on = (d: number) => frame >= d;
  const fade = (d: number) =>
    interpolate(frame, [d, d + 8], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  const zoneGlow = (d: number, until: number) =>
    frame >= d && frame < until ? 1 : 0;
  return (
    <Frame>
      <Shelf y={150} />
      <Shelf y={440} />
      <div
        style={{
          position: "absolute",
          left: MID - 6,
          top: 150,
          width: 12,
          height: BOTTOM - FRAME - 150,
          backgroundColor: C.wood,
        }}
      />
      {/* Arriba: maleta + cobijas */}
      <div style={{ opacity: fade(top) }}>
        <div
          style={{
            position: "absolute",
            left: IN_L + 40,
            top: 62,
            width: 170,
            height: 88,
            backgroundColor: "#3E6E8E",
            borderRadius: 14,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: IN_L + 100,
            top: 50,
            width: 50,
            height: 14,
            border: "6px solid #2F3B48",
            borderBottom: "none",
            borderRadius: "8px 8px 0 0",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: IN_L + 70,
            top: 92,
            width: 110,
            height: 6,
            backgroundColor: "#2F5570",
          }}
        />
        <Pile x={IN_L + 300} y={150} n={3} seed={2} w={180} />
      </div>
      {/* En medio: colgado largo y corto */}
      {on(mid) ? (
        <>
          <Rod x={IN_L} w={MID - IN_L - 6} y={166} />
          <Rod x={MID + 6} w={IN_L + IN_W - MID - 6} y={166} />
          {[0, 1, 2, 3].map((i) => (
            <Hanger
              key={`l${i}`}
              x={IN_L + 14 + i * 60}
              y={170}
              h={230}
              color={COLORS[(i + 3) % 7]}
              w={50}
              delay={mid + i * 3}
            />
          ))}
          {[0, 1, 2, 3].map((i) => (
            <Hanger
              key={`s${i}`}
              x={MID + 18 + i * 60}
              y={170}
              h={110}
              color={COLORS[(i + 1) % 7]}
              w={50}
              delay={mid + 8 + i * 3}
            />
          ))}
          <div style={{ opacity: fade(mid + 20) }}>
            <Shelf y={360} x={MID + 6} w={IN_L + IN_W - MID - 6} />
            <Pile x={MID + 40} y={360} n={2} seed={5} w={170} />
            <Pile x={MID + 40} y={440} n={2} seed={1} w={170} />
          </div>
        </>
      ) : null}
      {/* Abajo: cajones + zapatos */}
      <div style={{ opacity: fade(bottom) }}>
        {[0, 1].map((i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: IN_L + 10,
              top: 460 + i * 66,
              width: MID - IN_L - 26,
              height: 56,
              backgroundColor: "#B5814C",
              borderRadius: 6,
            }}
          >
            <div
              style={{
                margin: "22px auto 0",
                width: 60,
                height: 8,
                borderRadius: 4,
                backgroundColor: C.dark,
              }}
            />
          </div>
        ))}
        <Shelf y={520} x={MID + 6} w={IN_L + IN_W - MID - 6} />
        {[0, 1, 2].map((i) => (
          <React.Fragment key={i}>
            <div
              style={{
                position: "absolute",
                left: MID + 30 + i * 78,
                top: 492,
                width: 60,
                height: 28,
                backgroundColor: COLORS[(i * 2) % 7],
                borderRadius: "20px 30px 4px 4px",
              }}
            />
            <div
              style={{
                position: "absolute",
                left: MID + 30 + i * 78,
                top: 564,
                width: 60,
                height: 28,
                backgroundColor: COLORS[(i * 2 + 3) % 7],
                borderRadius: "20px 30px 4px 4px",
              }}
            />
          </React.Fragment>
        ))}
      </div>
      {/* Resaltado de la zona activa */}
      {labels ? (
        <>
          <div
            style={{
              position: "absolute",
              left: L - 6,
              top: TOP - 6,
              width: W + 12,
              height: 150 - TOP + 18,
              border: `6px solid ${C.orange}`,
              borderRadius: 10,
              boxSizing: "border-box",
              opacity: zoneGlow(top, mid),
            }}
          />
          <div
            style={{
              position: "absolute",
              left: L - 6,
              top: 150,
              width: W + 12,
              height: 302,
              border: `6px solid ${C.orange}`,
              borderRadius: 10,
              boxSizing: "border-box",
              opacity: zoneGlow(mid, bottom),
            }}
          />
          <div
            style={{
              position: "absolute",
              left: L - 6,
              top: 440,
              width: W + 12,
              height: BOTTOM - 440 + 6,
              border: `6px solid ${C.orange}`,
              borderRadius: 10,
              boxSizing: "border-box",
              opacity: zoneGlow(bottom, 99999),
            }}
          />
          <ZoneLabel y={60} text="Poco uso" delay={top} />
          <ZoneLabel y={260} text="Colgado" delay={mid} />
          <ZoneLabel y={490} text="Cajones" delay={bottom} />
        </>
      ) : null}
    </Frame>
  );
};

const Hook: React.FC = () => {
  const { fps } = useVideoConfig();
  return (
    <Scene>
      <SeriesTag n={2} />
      <StopSign text="¡OJO!" />
      <Title line1="Tu closet está" line2="mal dividido" delay={4} top={360} />
      <Panel delay={2}>
        <Messy />
      </Panel>
      <Sub delay={Math.round(2.4 * fps)}>No eres tú, es el closet</Sub>
    </Scene>
  );
};

const ErrorScene: React.FC = () => {
  const { fps } = useVideoConfig();
  return (
    <Scene>
      <Badge>El error</Badge>
      <Title line1="Puros" line2="entrepaños" />
      <Panel>
        <Messy />
        <Pop
          delay={Math.round(1.2 * fps)}
          from={0.1}
          style={{ position: "absolute", left: 760, top: 40 }}
        >
          <Check ok={false} size={110} />
        </Pop>
      </Panel>
      <Sub delay={Math.round(3.2 * fps)}>La ropa se amontona</Sub>
      <Dots active={0} total={3} />
    </Scene>
  );
};

const ZonasScene: React.FC = () => {
  const { fps } = useVideoConfig();
  const mid = Math.round((T.medio - T.zonas) * fps);
  const bottom = Math.round((T.abajo - T.zonas) * fps);
  return (
    <Scene>
      <Badge>El truco</Badge>
      <Title line1="Divídelo" line2="en 3 zonas" />
      <Panel>
        <Organized top={4} mid={mid} bottom={bottom} labels />
      </Panel>
      <Sequence
        style={{ alignItems: "center" }}
        name="Sub arriba"
        durationInFrames={mid}
      >
        <Sub delay={6}>Arriba: maletas y cobijas</Sub>
      </Sequence>
      <Sequence
        style={{ alignItems: "center" }}
        name="Sub en medio"
        from={mid}
        durationInFrames={bottom - mid}
      >
        <Sub delay={4}>
          En medio: colgado largo
          <br />y colgado corto
        </Sub>
      </Sequence>
      <Sequence style={{ alignItems: "center" }} name="Sub abajo" from={bottom}>
        <Sub delay={4}>Abajo: cajones y zapatos</Sub>
      </Sequence>
      <Dots active={1} total={3} />
    </Scene>
  );
};

const ResultadoScene: React.FC = () => (
  <Scene>
    <Badge color={C.green}>Resultado</Badge>
    <Title line1="Cada cosa" line2="en su lugar" />
    <Panel>
      <Organized top={-100} mid={-100} bottom={-100} />
      <Pop
        delay={8}
        from={0.1}
        style={{ position: "absolute", left: 760, top: 40 }}
      >
        <Check size={110} />
      </Pop>
    </Panel>
    <Sub delay={12}>Closets a tu medida</Sub>
    <Dots active={2} total={3} />
  </Scene>
);

export const VideoCloset: React.FC = () => {
  const { fps } = useVideoConfig();
  const f = (s: number) => Math.round(s * fps);
  return (
    <AbsoluteFill style={{ backgroundColor: C.bg }}>
      <Sequence name="Gancho" durationInFrames={f(T.error)}>
        <Hook />
      </Sequence>
      <Sequence
        name="El error"
        from={f(T.error)}
        durationInFrames={f(T.zonas - T.error)}
      >
        <ErrorScene />
      </Sequence>
      <Sequence
        name="Las 3 zonas"
        from={f(T.zonas)}
        durationInFrames={f(T.resultado - T.zonas)}
      >
        <ZonasScene />
      </Sequence>
      <Sequence
        name="Resultado"
        from={f(T.resultado)}
        durationInFrames={f(T.fin - T.resultado)}
      >
        <ResultadoScene />
      </Sequence>
      <Sequence name="Cierre" from={f(T.fin)}>
        <EndCard nextText="Parte 3: ¿qué material conviene? →" />
      </Sequence>
      <Soundtrack
        voice="voz_closet.mp3"
        whooshes={[T.error, T.zonas, T.resultado, T.fin]}
        dings={[T.resultado + 0.3]}
        clicks={[0.45, T.zonas + 0.15, T.medio, T.abajo]}
      />
    </AbsoluteFill>
  );
};
