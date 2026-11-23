import type React from "react";
import { Easing, interpolate, random, useCurrentFrame } from "remotion";
import { bodyFont, colors } from "./theme";

const clamp = {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
} as const;

const popIn = (frame: number, delay: number) =>
  interpolate(frame, [delay, delay + 16], [0, 1], {
    ...clamp,
    easing: Easing.bezier(0.34, 1.56, 0.64, 1),
  });

const Label: React.FC<{
  readonly x: number;
  readonly y: number;
  readonly children: string;
  readonly opacity: number;
  readonly anchor?: "start" | "middle" | "end";
}> = ({ x, y, children, opacity, anchor = "middle" }) => (
  <text
    x={x}
    y={y}
    textAnchor={anchor}
    fontFamily={bodyFont}
    fontWeight={800}
    fontSize={38}
    fill={colors.cream}
    opacity={opacity}
  >
    {children}
  </text>
);

// Tronco en corte: anillos de crecimiento.
export const LogSection: React.FC = () => {
  const frame = useCurrentFrame();
  const rings = 11;
  const ringPath = (r: number, i: number) => {
    let d = "";
    for (let a = 0; a <= 360; a += 10) {
      const rad = (a * Math.PI) / 180;
      const wobble = 1 + (random(`ring-${i}-${a % 360}`) - 0.5) * 0.06;
      const x = 350 + Math.cos(rad) * r * wobble;
      const y = 300 + Math.sin(rad) * r * wobble * 0.92;
      d += `${a === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)} `;
    }
    return d + "Z";
  };
  return (
    <svg width={700} height={600} viewBox="0 0 700 600">
      <g
        style={{
          transformOrigin: "350px 300px",
          scale: String(popIn(frame, 4)),
          rotate: `${interpolate(frame, [0, 200], [-8, 8])}deg`,
        }}
      >
        <ellipse cx={350} cy={300} rx={270} ry={250} fill="#5a3a1e" />
        <ellipse cx={350} cy={300} rx={245} ry={226} fill={colors.woodLight} />
        {new Array(rings).fill(0).map((_, i) => {
          const r = 230 - i * 20;
          return (
            <path
              key={i}
              d={ringPath(r, i)}
              fill="none"
              stroke={colors.woodDark}
              strokeWidth={i % 3 === 0 ? 6 : 3}
              opacity={interpolate(frame, [10 + i * 2, 16 + i * 2], [0, 0.8], clamp)}
            />
          );
        })}
        <circle cx={350} cy={300} r={10} fill={colors.woodDark} />
        <path d="M350 300 L560 230" stroke="#5a3a1e" strokeWidth={5} opacity={0.6} />
      </g>
      <Label x={350} y={590} opacity={interpolate(frame, [30, 40], [0, 1], clamp)}>
        Sale directo del árbol
      </Label>
    </svg>
  );
};

// MDF: fibras sueltas que se prensan en un tablero.
export const MdfPress: React.FC = () => {
  const frame = useCurrentFrame();
  const press = interpolate(frame, [12, 45], [0, 1], {
    ...clamp,
    easing: Easing.bezier(0.65, 0, 0.35, 1),
  });
  const fibers = new Array(150).fill(0).map((_, i) => {
    const x = 90 + random(`fx-${i}`) * 520;
    const looseY = 110 + random(`fy-${i}`) * 300;
    const pressedY = 320 + random(`fy-${i}`) * 90;
    const y = looseY + (pressedY - looseY) * press;
    const ang = random(`fa-${i}`) * 180;
    const len = 18 + random(`fl-${i}`) * 22;
    return { x, y, ang, len };
  });
  const plateY = interpolate(press, [0, 1], [40, 270]);
  return (
    <svg width={700} height={600} viewBox="0 0 700 600">
      {/* Tablero resultante */}
      <rect
        x={80}
        y={310}
        width={540}
        height={110}
        rx={8}
        fill={colors.mdf}
        opacity={interpolate(frame, [38, 50], [0, 1], clamp)}
      />
      {fibers.map((f, i) => (
        <line
          key={i}
          x1={f.x}
          y1={f.y}
          x2={f.x + Math.cos((f.ang * Math.PI) / 180) * f.len}
          y2={f.y + Math.sin((f.ang * Math.PI) / 180) * f.len * (1 - press * 0.8)}
          stroke={i % 3 === 0 ? colors.woodDark : colors.woodLight}
          strokeWidth={5}
          strokeLinecap="round"
          opacity={interpolate(frame, [0, 6], [0, 0.9], clamp)}
        />
      ))}
      {/* Prensa */}
      <rect x={60} y={plateY} width={580} height={36} rx={6} fill="#9aa3ad" />
      <rect x={330} y={0} width={40} height={plateY} fill="#6b737c" />
      <Label x={350} y={490} opacity={interpolate(frame, [48, 58], [0, 1], clamp)}>
        Fibras de madera + resina
      </Label>
      <Label x={350} y={540} opacity={interpolate(frame, [52, 62], [0, 1], clamp)}>
        prensadas
      </Label>
    </svg>
  );
};

// Melamina: núcleo de aglomerado + capa melamínica.
export const MelamineLayers: React.FC = () => {
  const frame = useCurrentFrame();
  const chips = new Array(70).fill(0).map((_, i) => {
    const x = 100 + random(`cx-${i}`) * 490;
    const y = 270 + random(`cy-${i}`) * 90;
    const s = 10 + random(`cs-${i}`) * 14;
    const r = random(`cr-${i}`) * 90;
    return { x, y, s, r };
  });
  const topY = interpolate(frame, [20, 36], [-80, 236], {
    ...clamp,
    easing: Easing.bezier(0.34, 1.4, 0.64, 1),
  });
  const bottomY = interpolate(frame, [26, 42], [680, 380], {
    ...clamp,
    easing: Easing.bezier(0.34, 1.4, 0.64, 1),
  });
  return (
    <svg width={700} height={600} viewBox="0 0 700 600">
      <g style={{ opacity: interpolate(frame, [2, 10], [0, 1], clamp) }}>
        <rect x={90} y={250} width={520} height={130} fill="#c49a64" />
        {chips.map((c, i) => (
          <rect
            key={i}
            x={c.x}
            y={c.y}
            width={c.s * 1.6}
            height={c.s * 0.7}
            fill={i % 2 ? "#8c6238" : "#e0bd8a"}
            style={{ transformBox: "fill-box", transformOrigin: "center", rotate: `${c.r}deg` }}
          />
        ))}
      </g>
      <rect x={84} y={topY} width={532} height={18} rx={4} fill={colors.white} />
      <rect x={84} y={bottomY} width={532} height={18} rx={4} fill={colors.white} />
      <Label x={350} y={200} opacity={interpolate(frame, [36, 46], [0, 1], clamp)}>
        Capa de melamina
      </Label>
      <Label x={350} y={470} opacity={interpolate(frame, [44, 54], [0, 1], clamp)}>
        Aglomerado (astillas
      </Label>
      <Label x={350} y={518} opacity={interpolate(frame, [44, 54], [0, 1], clamp)}>
        de madera pegadas)
      </Label>
    </svg>
  );
};

// El truco: canto sin protección vs. canto con cubrecanto.
export const EdgeTest: React.FC = () => {
  const frame = useCurrentFrame();
  const dropFall = (start: number) =>
    interpolate(frame, [start, start + 14], [-40, 150], {
      ...clamp,
      easing: Easing.in(Easing.quad),
    });
  const swell = interpolate(frame, [26, 60], [0, 1], {
    ...clamp,
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const bounce = interpolate(frame, [26, 50], [0, 1], clamp);

  // Tablero en perspectiva: cara superior (melamina blanca) + canto frontal.
  const board = (x: number, protectedEdge: boolean) => {
    const bulge = protectedEdge ? 0 : swell * 30;
    const top = 200;
    const depth = 70;
    const thick = 90;
    const w = 280;
    return (
      <g>
        <path
          d={`M${x + depth} ${top - depth} L${x + w + depth} ${top - depth} L${x + w} ${top} L${x} ${top} Z`}
          fill="#f1ede6"
        />
        <path
          d={`M${x + w} ${top} L${x + w + depth} ${top - depth} L${x + w + depth} ${top - depth + thick} L${x + w} ${top + thick} Z`}
          fill="#d9d2c6"
        />
        <path
          d={`M${x} ${top} Q${x + w / 2} ${top - bulge} ${x + w} ${top} L${x + w} ${top + thick} Q${x + w / 2} ${top + thick + bulge} ${x} ${top + thick} Z`}
          fill={protectedEdge ? colors.accent : "#c49a64"}
        />
        {!protectedEdge
          ? new Array(26).fill(0).map((_, i) => (
              <rect
                key={i}
                x={x + 10 + random(`ex-${i}`) * (w - 40)}
                y={top + 12 + random(`ey-${i}`) * (thick - 30) - bulge * 0.2}
                width={14 + random(`ew-${i}`) * 16}
                height={6 + random(`eh-${i}`) * 6}
                fill={i % 2 ? "#8c6238" : "#e0bd8a"}
              />
            ))
          : null}
        {!protectedEdge ? (
          <ellipse
            cx={x + w / 2}
            cy={top + thick / 2}
            rx={120 * swell}
            ry={46 * swell}
            fill="#5a3818"
            opacity={0.55 * swell}
          />
        ) : null}
      </g>
    );
  };

  const dropPath = (cx: number, cy: number) =>
    `M${cx} ${cy - 34} C${cx + 22} ${cy - 6} ${cx + 22} ${cy + 18} ${cx} ${cy + 18} C${cx - 22} ${cy + 18} ${cx - 22} ${cy - 6} ${cx} ${cy - 34} Z`;

  return (
    <svg width={920} height={600} viewBox="0 0 800 520">
      {board(20, false)}
      {board(430, true)}
      {/* gota izquierda: se absorbe */}
      <path
        d={dropPath(195, dropFall(10))}
        fill="#4fb3ff"
        opacity={interpolate(frame, [24, 30], [1, 0], clamp)}
      />
      {/* gota derecha: rebota y resbala */}
      <path
        d={dropPath(
          605 + bounce * 190,
          dropFall(10) - Math.sin(bounce * Math.PI) * 90 + bounce * 160,
        )}
        fill="#4fb3ff"
        opacity={interpolate(frame, [44, 52], [1, 0], clamp)}
      />
      <text
        x={160}
        y={430}
        textAnchor="middle"
        fontFamily={bodyFont}
        fontWeight={800}
        fontSize={40}
        fill={colors.no}
        opacity={interpolate(frame, [40, 50], [0, 1], clamp)}
      >
        SIN cubrecanto
      </text>
      <text
        x={570}
        y={430}
        textAnchor="middle"
        fontFamily={bodyFont}
        fontWeight={800}
        fontSize={40}
        fill={colors.yes}
        opacity={interpolate(frame, [46, 56], [0, 1], clamp)}
      >
        CON cubrecanto
      </text>
      <text
        x={160}
        y={480}
        textAnchor="middle"
        fontFamily={bodyFont}
        fontWeight={600}
        fontSize={34}
        fill={colors.cream}
        opacity={interpolate(frame, [40, 50], [0, 1], clamp)}
      >
        se hincha
      </text>
      <text
        x={570}
        y={480}
        textAnchor="middle"
        fontFamily={bodyFont}
        fontWeight={600}
        fontSize={34}
        fill={colors.cream}
        opacity={interpolate(frame, [46, 56], [0, 1], clamp)}
      >
        protegido
      </text>
    </svg>
  );
};
