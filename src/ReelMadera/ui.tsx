import type React from "react";
import {
  Easing,
  interpolate,
  random,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { bodyFont, colors, displayFont } from "./theme";

const clamp = {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
} as const;

// Fondo con vetas de madera que se desplazan lentamente.
export const WoodGrainBackground: React.FC<{
  readonly tint?: string;
  readonly seed?: string;
}> = ({ tint = colors.bg, seed = "grain" }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const lines = 46;
  const paths = new Array(lines).fill(0).map((_, i) => {
    const base = (i / lines) * height * 1.2 - height * 0.1;
    const amp = 10 + random(`${seed}-a-${i}`) * 28;
    const freq = 0.004 + random(`${seed}-f-${i}`) * 0.004;
    const phase = random(`${seed}-p-${i}`) * Math.PI * 2;
    const knotX = random(`${seed}-k-${i}`) * width;
    let d = "";
    for (let x = -40; x <= width + 40; x += 30) {
      const knot = 60 * Math.exp(-((x - knotX) ** 2) / 9000) * (i % 2 ? 1 : -1);
      const y = base + Math.sin(x * freq + phase) * amp + knot;
      d += `${x === -40 ? "M" : "L"}${x},${y.toFixed(1)} `;
    }
    return { d, op: 0.05 + random(`${seed}-o-${i}`) * 0.1 };
  });

  return (
    <div style={{ position: "absolute", inset: 0, backgroundColor: tint }}>
      <svg
        width={width}
        height={height}
        style={{
          position: "absolute",
          inset: 0,
          translate: `0px ${interpolate(frame, [0, 300], [0, -60])}px`,
        }}
      >
        {paths.map((p, i) => (
          <path
            key={i}
            d={p.d}
            fill="none"
            stroke={colors.woodLight}
            strokeWidth={3}
            opacity={p.op}
          />
        ))}
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse at center, rgba(0,0,0,0) 40%, rgba(0,0,0,0.65) 100%)",
        }}
      />
    </div>
  );
};

// Chip pequeño tipo "1/3".
export const Chip: React.FC<{
  readonly children: React.ReactNode;
  readonly delay?: number;
  readonly color?: string;
}> = ({ children, delay = 0, color = colors.accent }) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        alignSelf: "center",
        fontFamily: bodyFont,
        fontWeight: 800,
        fontSize: 40,
        color: colors.bg,
        backgroundColor: color,
        padding: "10px 28px",
        borderRadius: 999,
        letterSpacing: 2,
        opacity: interpolate(frame, [delay, delay + 8], [0, 1], clamp),
        scale: interpolate(frame, [delay, delay + 12], [0.6, 1], {
          ...clamp,
          easing: Easing.bezier(0.34, 1.56, 0.64, 1),
        }),
      }}
    >
      {children}
    </div>
  );
};

// Título grande con entrada "golpe".
export const BigTitle: React.FC<{
  readonly children: React.ReactNode;
  readonly delay?: number;
  readonly size?: number;
  readonly color?: string;
}> = ({ children, delay = 0, size = 150, color = colors.cream }) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        fontFamily: displayFont,
        fontSize: size,
        lineHeight: 1,
        color,
        textAlign: "center",
        textTransform: "uppercase",
        textShadow: "0 8px 0 rgba(0,0,0,0.35)",
        opacity: interpolate(frame, [delay, delay + 5], [0, 1], clamp),
        scale: interpolate(frame, [delay, delay + 10], [1.6, 1], {
          ...clamp,
          easing: Easing.bezier(0.16, 1, 0.3, 1),
        }),
      }}
    >
      {children}
    </div>
  );
};

const Check: React.FC = () => (
  <svg width={64} height={64} viewBox="0 0 64 64">
    <circle cx={32} cy={32} r={30} fill={colors.yes} />
    <path
      d="M18 33 L28 43 L47 22"
      stroke={colors.bg}
      strokeWidth={8}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const Cross: React.FC = () => (
  <svg width={64} height={64} viewBox="0 0 64 64">
    <circle cx={32} cy={32} r={30} fill={colors.no} />
    <path
      d="M21 21 L43 43 M43 21 L21 43"
      stroke={colors.bg}
      strokeWidth={8}
      strokeLinecap="round"
    />
  </svg>
);

// Fila de pro/contra que entra desde un lado.
export const ProCon: React.FC<{
  readonly good: boolean;
  readonly children: React.ReactNode;
  readonly delay: number;
}> = ({ good, children, delay }) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 26,
        backgroundColor: "rgba(0,0,0,0.45)",
        border: `4px solid ${good ? colors.yes : colors.no}`,
        borderRadius: 28,
        padding: "20px 30px",
        opacity: interpolate(frame, [delay, delay + 6], [0, 1], clamp),
        translate: `${interpolate(frame, [delay, delay + 12], [good ? -120 : 120, 0], {
          ...clamp,
          easing: Easing.bezier(0.16, 1, 0.3, 1),
        })}px 0px`,
      }}
    >
      <div style={{ flexShrink: 0, display: "flex" }}>
        {good ? <Check /> : <Cross />}
      </div>
      <div
        style={{
          fontFamily: bodyFont,
          fontWeight: 800,
          fontSize: 50,
          lineHeight: 1.15,
          color: colors.cream,
        }}
      >
        {children}
      </div>
    </div>
  );
};

// Veredicto: "Ideal para…"
export const Verdict: React.FC<{
  readonly children: React.ReactNode;
  readonly delay: number;
}> = ({ children, delay }) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        alignSelf: "center",
        textAlign: "center",
        fontFamily: bodyFont,
        fontWeight: 800,
        fontSize: 52,
        color: colors.bg,
        backgroundColor: colors.cream,
        padding: "18px 36px",
        borderRadius: 20,
        rotate: "-2deg",
        opacity: interpolate(frame, [delay, delay + 6], [0, 1], clamp),
        scale: interpolate(frame, [delay, delay + 12], [0.5, 1], {
          ...clamp,
          easing: Easing.bezier(0.34, 1.56, 0.64, 1),
        }),
      }}
    >
      {children}
    </div>
  );
};

// Barra de progreso superior (retención).
export const ProgressBar: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: 14,
        backgroundColor: "rgba(255,255,255,0.15)",
      }}
    >
      <div
        style={{
          height: "100%",
          backgroundColor: colors.accent,
          width: `${interpolate(frame, [0, durationInFrames - 1], [0, 100], clamp)}%`,
        }}
      />
    </div>
  );
};
