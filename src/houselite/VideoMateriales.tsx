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

// Tiempos (segundos) alineados con la locución voz_materiales.mp3
const T = {
  melamina: 4.5,
  mdf: 11.25,
  madera: 16.8,
  resultado: 22.6,
  fin: 27.35,
  total: 34,
};
export const MATERIALES_DURATION = T.total;

const WOOD_BG =
  "repeating-linear-gradient(90deg, #B07A45 0 14px, #A26C3A 14px 22px, #BC8650 22px 40px, #9A6434 40px 46px)";
const MDF_BG =
  "radial-gradient(circle at 20% 30%, rgba(90,60,30,0.35) 0 2px, transparent 3px), radial-gradient(circle at 70% 60%, rgba(90,60,30,0.3) 0 2px, transparent 3px), #C9A57C";

export type Kind = "melamina" | "mdf" | "madera";

export const Swatch: React.FC<{
  kind: Kind;
  w: number;
  h: number;
  paint?: number; // 0..1 (solo MDF)
}> = ({ kind, w, h, paint = 0 }) => {
  const base: React.CSSProperties = {
    position: "relative",
    width: w,
    height: h,
    borderRadius: 16,
    overflow: "hidden",
    boxShadow: "0 10px 0 rgba(0,0,0,0.12)",
  };
  if (kind === "melamina") {
    return (
      <div
        style={{
          ...base,
          backgroundColor: "#F7F7F4",
          border: "8px solid #E2DED6",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 0,
            height: "40%",
            background:
              "linear-gradient(160deg, rgba(255,255,255,0.9), rgba(255,255,255,0))",
          }}
        />
      </div>
    );
  }
  if (kind === "mdf") {
    return (
      <div
        style={{
          ...base,
          background: MDF_BG,
          backgroundSize: "26px 26px, 34px 34px, auto",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: `${paint * 100}%`,
            backgroundColor: "#5B8DB8",
          }}
        />
      </div>
    );
  }
  return (
    <div style={{ ...base, background: WOOD_BG }}>
      <svg width={w} height={h} style={{ position: "absolute", inset: 0 }}>
        {[0.25, 0.55, 0.8].map((x) => (
          <path
            key={x}
            d={`M${w * x} 0 C ${w * x + 30} ${h * 0.3}, ${w * x - 30} ${h * 0.6}, ${w * x + 10} ${h}`}
            stroke="#7E4F26"
            strokeWidth={4}
            fill="none"
            opacity={0.6}
          />
        ))}
        <ellipse
          cx={w * 0.42}
          cy={h * 0.45}
          rx={18}
          ry={30}
          fill="none"
          stroke="#7E4F26"
          strokeWidth={4}
          opacity={0.7}
        />
      </svg>
    </div>
  );
};

const Item: React.FC<{
  delay: number;
  ok?: boolean;
  children: React.ReactNode;
}> = ({ delay, ok = true, children }) => (
  <Pop delay={delay} from={0.5}>
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 22,
        marginBottom: 30,
      }}
    >
      <Check size={64} ok={ok} />
      <div
        style={{
          fontWeight: 800,
          fontSize: 42,
          lineHeight: 1.1,
          color: ok ? C.dark : C.red,
          width: 340,
        }}
      >
        {children}
      </div>
    </div>
  </Pop>
);

const Price: React.FC<{ level: 1 | 2 | 3; delay: number }> = ({
  level,
  delay,
}) => (
  <Pop
    delay={delay}
    from={0.5}
    style={{ position: "absolute", left: 470, top: 500 }}
  >
    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
      <div style={{ fontWeight: 700, fontSize: 32, color: "#6E604F" }}>
        Precio
      </div>
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          style={{
            width: 62,
            height: 62,
            borderRadius: 62,
            backgroundColor: i <= level ? C.orange : "#D6CAB8",
            color: C.white,
            fontWeight: 900,
            fontSize: 38,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          $
        </div>
      ))}
    </div>
  </Pop>
);

const MaterialScene: React.FC<{
  n: number;
  kind: Kind;
  name: string;
  tag: string;
  price: 1 | 2 | 3;
  priceAt: number;
  items: { text: string; at: number; ok?: boolean }[];
  sub: string;
  subAt: number;
  extra?: React.ReactNode;
}> = ({ n, kind, name, tag, price, priceAt, items, sub, subAt, extra }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const paint = interpolate(
    frame,
    [Math.round(1.9 * fps), Math.round(3.2 * fps)],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.bezier(0.65, 0, 0.35, 1),
    },
  );
  return (
    <Scene>
      <Badge>Opción {n}</Badge>
      <Title line1={name} line2={tag} />
      <Panel>
        <Pop
          delay={2}
          from={0.6}
          style={{ position: "absolute", left: 50, top: 60 }}
        >
          <Swatch
            kind={kind}
            w={360}
            h={480}
            paint={kind === "mdf" ? paint : 0}
          />
        </Pop>
        <div style={{ position: "absolute", left: 450, top: 70 }}>
          {items.map((it) => (
            <Item
              key={it.text}
              delay={Math.round(it.at * fps)}
              ok={it.ok ?? true}
            >
              {it.text}
            </Item>
          ))}
        </div>
        <Price level={price} delay={Math.round(priceAt * fps)} />
        {extra}
      </Panel>
      <Sub delay={Math.round(subAt * fps)}>{sub}</Sub>
      <Dots active={n - 1} />
    </Scene>
  );
};

const ColorChips: React.FC<{ delay: number }> = ({ delay }) => (
  <div
    style={{
      position: "absolute",
      left: 70,
      top: 440,
      display: "flex",
      gap: 14,
    }}
  >
    {["#FFFFFF", "#9A9A96", "#2B2B2B", "#A87547", "#3E6E8E"].map((c, i) => (
      <Pop key={c} delay={delay + i * 3} from={0.1}>
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: 12,
            backgroundColor: c,
            border: "4px solid rgba(0,0,0,0.15)",
          }}
        />
      </Pop>
    ))}
  </div>
);

const Drop: React.FC<{ delay: number }> = ({ delay }) => {
  const frame = useCurrentFrame();
  const y = interpolate(frame, [delay, delay + 14], [-120, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.5, 0, 0.75, 0),
  });
  const o = interpolate(frame, [delay, delay + 4], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div style={{ position: "absolute", left: 200, top: 250 + y, opacity: o }}>
      <svg width={90} height={120} viewBox="0 0 30 40">
        <path
          d="M15 2 C 15 2, 3 18, 3 26 a12 12 0 0 0 24 0 C 27 18, 15 2, 15 2z"
          fill="#4FA3E0"
          stroke="#fff"
          strokeWidth={2}
        />
      </svg>
    </div>
  );
};

const Hook: React.FC = () => (
  <Scene>
    <SeriesTag n={3} />
    <StopSign text="¿CUÁL?" />
    <Title line1="¿Melamina, MDF" line2="o madera?" delay={4} top={360} />
    <Panel delay={2}>
      {(["melamina", "mdf", "madera"] as Kind[]).map((k, i) => (
        <Pop
          key={k}
          delay={6 + i * 8}
          from={0.2}
          style={{ position: "absolute", left: 50 + i * 280, top: 90 }}
        >
          <Swatch kind={k} w={240} h={360} />
          <div
            style={{
              marginTop: 34,
              textAlign: "center",
              fontWeight: 900,
              fontSize: 40,
              textTransform: "uppercase",
            }}
          >
            {k === "mdf" ? "MDF" : k}
          </div>
        </Pop>
      ))}
    </Panel>
    <Sub delay={Math.round(3.2 * 30)}>No gastes de más</Sub>
  </Scene>
);

const ResultadoScene: React.FC = () => {
  const { fps } = useVideoConfig();
  const uses = ["Closet y cocina", "Para pintar", "Para toda la vida"];
  return (
    <Scene>
      <Badge color={C.green}>La respuesta</Badge>
      <Title line1="No hay uno mejor" line2="depende del uso" />
      <Panel>
        {(["melamina", "mdf", "madera"] as Kind[]).map((k, i) => (
          <Pop
            key={k}
            delay={6 + i * 6}
            from={0.2}
            style={{ position: "absolute", left: 50 + i * 280, top: 90 }}
          >
            <Swatch kind={k} w={240} h={300} paint={k === "mdf" ? 1 : 0} />
            <div
              style={{
                marginTop: 30,
                textAlign: "center",
                fontWeight: 800,
                fontSize: 32,
                width: 240,
                lineHeight: 1.15,
              }}
            >
              {uses[i]}
            </div>
          </Pop>
        ))}
      </Panel>
      <Sub delay={Math.round(3 * fps)}>Nosotros te asesoramos</Sub>
      <Dots active={3} />
    </Scene>
  );
};

export const VideoMateriales: React.FC = () => {
  const { fps } = useVideoConfig();
  const f = (s: number) => Math.round(s * fps);
  return (
    <AbsoluteFill style={{ backgroundColor: C.bg }}>
      <Sequence name="Gancho" durationInFrames={f(T.melamina)}>
        <Hook />
      </Sequence>
      <Sequence
        name="Melamina"
        from={f(T.melamina)}
        durationInFrames={f(T.mdf - T.melamina)}
      >
        <MaterialScene
          n={1}
          kind="melamina"
          name="Melamina"
          tag="la práctica"
          price={1}
          priceAt={1.1}
          items={[
            { text: "Económica", at: 1.1 },
            { text: "Fácil de limpiar", at: 2.0 },
            { text: "Muchos colores", at: 3.1 },
          ]}
          sub="Ideal para closets y cocinas"
          subAt={4.8}
          extra={<ColorChips delay={Math.round(3.1 * fps)} />}
        />
      </Sequence>
      <Sequence
        name="MDF"
        from={f(T.mdf)}
        durationInFrames={f(T.madera - T.mdf)}
      >
        <MaterialScene
          n={2}
          kind="mdf"
          name="MDF"
          tag="el que se pinta"
          price={2}
          priceAt={1.2}
          items={[
            { text: "Liso", at: 1.2 },
            { text: "Perfecto para pintar", at: 1.9 },
            { text: "Lejos del agua", at: 3.5, ok: false },
          ]}
          sub="Ojo con la humedad"
          subAt={3.5}
          extra={<Drop delay={Math.round(3.4 * fps)} />}
        />
      </Sequence>
      <Sequence
        name="Madera sólida"
        from={f(T.madera)}
        durationInFrames={f(T.resultado - T.madera)}
      >
        <MaterialScene
          n={3}
          kind="madera"
          name="Madera sólida"
          tag="la que dura más"
          price={3}
          priceAt={4.1}
          items={[
            { text: "La más resistente", at: 1.4 },
            { text: "La más bonita", at: 2.8 },
          ]}
          sub="Pero también la más cara"
          subAt={4.1}
        />
      </Sequence>
      <Sequence
        name="Resultado"
        from={f(T.resultado)}
        durationInFrames={f(T.fin - T.resultado)}
      >
        <ResultadoScene />
      </Sequence>
      <Sequence name="Cierre" from={f(T.fin)}>
        <EndCard nextText="Guarda este video para tu próximo mueble" />
      </Sequence>
      <Soundtrack
        voice="voz_materiales.mp3"
        whooshes={[T.melamina, T.mdf, T.madera, T.resultado, T.fin]}
        dings={[T.resultado + 3]}
        clicks={[
          0.45,
          T.melamina + 1.1,
          T.melamina + 2.0,
          T.melamina + 3.1,
          T.mdf + 1.2,
          T.mdf + 1.9,
          T.madera + 1.4,
          T.madera + 2.8,
        ]}
      />
    </AbsoluteFill>
  );
};
