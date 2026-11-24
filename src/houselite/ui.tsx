import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { loadFont } from "@remotion/google-fonts/Montserrat";

export const { fontFamily } = loadFont("normal", {
  weights: ["500", "600", "700", "800", "900"],
  subsets: ["latin"],
});

export const C = {
  bg: "#F3ECE2",
  panel: "#E6DDCB",
  floor: "#BFAE94",
  dark: "#2A231C",
  orange: "#E07B2E",
  red: "#D93A2F",
  green: "#22A355",
  tape: "#F2C230",
  wood: "#C8955E",
  woodDark: "#9C6B3C",
  cabinet: "#37404A",
  white: "#FFFFFF",
};

/** Entrada con rebote: devuelve 0→1 a partir de `delay` frames. */
export const usePop = (delay = 0, dur = 14) => {
  const frame = useCurrentFrame();
  return interpolate(frame, [delay, delay + dur], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.34, 1.56, 0.64, 1),
  });
};

export const useFade = (delay = 0, dur = 10) => {
  const frame = useCurrentFrame();
  return interpolate(frame, [delay, delay + dur], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
};

/** Pop-in con escala; envuelve cualquier cosa. */
export const Pop: React.FC<{
  delay?: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
  from?: number;
}> = ({ delay = 0, children, style, from = 0.4 }) => {
  const p = usePop(delay);
  const o = useFade(delay, 6);
  return (
    <div style={{ ...style, opacity: o, scale: String(from + (1 - from) * p) }}>
      {children}
    </div>
  );
};

export const Scene: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => (
  <AbsoluteFill
    style={{
      backgroundColor: C.bg,
      fontFamily,
      alignItems: "center",
      color: C.dark,
    }}
  >
    {children}
  </AbsoluteFill>
);

export const Badge: React.FC<{
  children: React.ReactNode;
  color?: string;
  delay?: number;
  top?: number;
}> = ({ children, color = C.orange, delay = 0, top = 250 }) => (
  <Pop delay={delay} style={{ position: "absolute", top }}>
    <div
      style={{
        backgroundColor: color,
        color: C.white,
        fontWeight: 800,
        fontSize: 34,
        letterSpacing: 2,
        padding: "10px 30px",
        borderRadius: 40,
        textTransform: "uppercase",
      }}
    >
      {children}
    </div>
  </Pop>
);

export const Title: React.FC<{
  line1: string;
  line2?: string;
  delay?: number;
  top?: number;
  size?: number;
}> = ({ line1, line2, delay = 3, top = 330, size = 84 }) => {
  const frame = useCurrentFrame();
  const y = interpolate(frame, [delay, delay + 12], [40, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const o = useFade(delay, 10);
  return (
    <div
      style={{
        position: "absolute",
        top,
        width: 1000,
        textAlign: "center",
        fontWeight: 900,
        fontSize: size,
        lineHeight: 1.08,
        textTransform: "uppercase",
        opacity: o,
        translate: `0px ${y}px`,
      }}
    >
      <div>{line1}</div>
      {line2 ? <div style={{ color: C.orange }}>{line2}</div> : null}
    </div>
  );
};

/** Recuadro de ilustración con piso, como en el video de la cocina. */
export const Panel: React.FC<{
  children?: React.ReactNode;
  top?: number;
  height?: number;
  delay?: number;
}> = ({ children, top = 560, height = 640, delay = 0 }) => {
  const o = useFade(delay, 10);
  return (
    <div
      style={{
        position: "absolute",
        top,
        width: 900,
        height,
        backgroundColor: C.panel,
        opacity: o,
        overflow: "hidden",
      }}
    >
      {children}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          width: "100%",
          height: 30,
          backgroundColor: C.floor,
        }}
      />
    </div>
  );
};

export const Sub: React.FC<{
  children: React.ReactNode;
  delay?: number;
  top?: number;
}> = ({ children, delay = 8, top = 1250 }) => (
  <div
    style={{
      position: "absolute",
      top,
      left: 0,
      right: 0,
      display: "flex",
      justifyContent: "center",
    }}
  >
    <Pop delay={delay} from={0.7}>
      <div
        style={{
          backgroundColor: C.dark,
          color: C.white,
          fontWeight: 700,
          fontSize: 44,
          lineHeight: 1.3,
          padding: "18px 40px",
          borderRadius: 18,
          textAlign: "center",
          maxWidth: 860,
        }}
      >
        {children}
      </div>
    </Pop>
  </div>
);

export const Dots: React.FC<{ active: number; total?: number }> = ({
  active,
  total = 4,
}) => (
  <div
    style={{
      position: "absolute",
      top: 1560,
      display: "flex",
      gap: 18,
    }}
  >
    {new Array(total).fill(0).map((_, i) => (
      <div
        key={i}
        style={{
          width: i === active ? 22 : 14,
          height: i === active ? 22 : 14,
          borderRadius: 20,
          alignSelf: "center",
          backgroundColor: i === active ? C.orange : "#CFC3B2",
        }}
      />
    ))}
  </div>
);

export const StopSign: React.FC<{ delay?: number; text?: string }> = ({
  delay = 0,
  text = "¡ALTO!",
}) => {
  const frame = useCurrentFrame();
  const wobble = interpolate(
    frame,
    [delay + 10, delay + 14, delay + 18, delay + 22, delay + 26],
    [0, -6, 5, -3, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  return (
    <Pop delay={delay} from={0.2} style={{ position: "absolute", top: 170 }}>
      <div
        style={{
          backgroundColor: C.red,
          color: C.white,
          fontWeight: 900,
          fontSize: 96,
          padding: "6px 44px",
          borderRadius: 26,
          border: "8px solid #fff",
          boxShadow: "0 0 0 6px " + C.red,
          rotate: `${wobble}deg`,
        }}
      >
        {text}
      </div>
    </Pop>
  );
};

export const Check: React.FC<{ size?: number; ok?: boolean }> = ({
  size = 120,
  ok = true,
}) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: size,
      backgroundColor: ok ? C.green : C.red,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      boxShadow: "0 8px 0 rgba(0,0,0,0.12)",
    }}
  >
    <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24">
      {ok ? (
        <path
          d="M4 12.5l5 5L20 6.5"
          stroke="#fff"
          strokeWidth={3.6}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <path
          d="M5 5l14 14M19 5L5 19"
          stroke="#fff"
          strokeWidth={3.6}
          strokeLinecap="round"
        />
      )}
    </svg>
  </div>
);

/** Indicador de serie arriba de la escena gancho. */
export const SeriesTag: React.FC<{ n: number; delay?: number }> = ({
  n,
  delay = 0,
}) => {
  const o = useFade(delay, 10);
  return (
    <div
      style={{
        position: "absolute",
        top: 90,
        opacity: o,
        fontWeight: 700,
        fontSize: 30,
        letterSpacing: 3,
        color: "#8B7D6B",
        textTransform: "uppercase",
      }}
    >
      Antes de pedir tu mueble · {n}/3
    </div>
  );
};

/** Cierre oscuro con datos de contacto (igual que el video anterior). */
export const EndCard: React.FC<{ nextText?: string }> = ({ nextText }) => {
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill
      style={{
        backgroundColor: C.dark,
        fontFamily,
        alignItems: "center",
        color: C.white,
        textAlign: "center",
      }}
    >
      <Pop delay={0} style={{ position: "absolute", top: 360 }}>
        <div style={{ fontWeight: 900, fontSize: 118, letterSpacing: 1 }}>
          HOUSE LITE
        </div>
        <div style={{ fontWeight: 600, fontSize: 50, color: C.orange }}>
          Carpintería y muebles
        </div>
        <div
          style={{
            width: 120,
            height: 5,
            backgroundColor: C.orange,
            margin: "30px auto 0",
          }}
        />
      </Pop>
      <Pop delay={6} from={0.8} style={{ position: "absolute", top: 680 }}>
        <div style={{ fontWeight: 700, fontSize: 52, lineHeight: 1.25 }}>
          Diseñamos y fabricamos
          <br />a la medida
        </div>
        <div
          style={{
            fontWeight: 500,
            fontSize: 36,
            marginTop: 18,
            opacity: 0.85,
          }}
        >
          Hecho en nuestro taller de Tepatitlán
        </div>
      </Pop>
      <Pop delay={12} from={0.5} style={{ position: "absolute", top: 960 }}>
        <div
          style={{
            backgroundColor: C.green,
            borderRadius: 34,
            padding: "26px 60px",
            boxShadow: "0 10px 0 #15763C",
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 44 }}>
            Cotiza por WhatsApp
          </div>
          <div style={{ fontWeight: 900, fontSize: 92, lineHeight: 1.05 }}>
            378 170 8278
          </div>
        </div>
      </Pop>
      <Pop
        delay={Math.round(0.8 * fps)}
        from={0.8}
        style={{ position: "absolute", top: 1250 }}
      >
        <div style={{ fontWeight: 600, fontSize: 36 }}>
          Lunes a sábado · 9:00 a 20:00
        </div>
        <div
          style={{
            fontWeight: 600,
            fontSize: 36,
            color: C.orange,
            marginTop: 10,
          }}
        >
          Envío gratis en Tepatitlán
        </div>
      </Pop>
      {nextText ? (
        <Pop
          delay={Math.round(1.6 * fps)}
          from={0.6}
          style={{ position: "absolute", top: 1440 }}
        >
          <div
            style={{
              border: "3px solid rgba(255,255,255,0.5)",
              borderRadius: 40,
              padding: "12px 34px",
              fontWeight: 700,
              fontSize: 34,
            }}
          >
            {nextText}
          </div>
        </Pop>
      ) : null}
    </AbsoluteFill>
  );
};
