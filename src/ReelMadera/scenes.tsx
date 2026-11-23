import { Audio } from "@remotion/media";
import type React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
import {
  EdgeTest,
  LogSection,
  MdfPress,
  MelamineLayers,
} from "./illustrations";
import { bodyFont, colors, displayFont } from "./theme";
import { BigTitle, Chip, ProCon, Verdict, WoodGrainBackground } from "./ui";

const clamp = {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
} as const;

const Column: React.FC<{
  readonly children: React.ReactNode;
  readonly gap?: number;
  readonly justify?: React.CSSProperties["justifyContent"];
}> = ({ children, gap = 30, justify = "flex-start" }) => (
  <AbsoluteFill
    style={{
      padding: "150px 80px 170px",
      display: "flex",
      flexDirection: "column",
      justifyContent: justify,
      gap,
    }}
  >
    {children}
  </AbsoluteFill>
);

const Sub: React.FC<{
  readonly children: React.ReactNode;
  readonly delay: number;
  readonly size?: number;
  readonly color?: string;
}> = ({ children, delay, size = 56, color = colors.cream }) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        fontFamily: bodyFont,
        fontWeight: 800,
        fontSize: size,
        lineHeight: 1.2,
        textAlign: "center",
        color,
        opacity: interpolate(frame, [delay, delay + 8], [0, 1], clamp),
        translate: `0px ${interpolate(frame, [delay, delay + 12], [30, 0], {
          ...clamp,
          easing: Easing.bezier(0.16, 1, 0.3, 1),
        })}px`,
      }}
    >
      {children}
    </div>
  );
};

// Pequeña sacudida de cámara después de cada "golpe".
const useShake = (hits: number[]) => {
  const frame = useCurrentFrame();
  return hits.reduce((acc, h) => {
    const t = frame - h;
    if (t < 0 || t > 8) return acc;
    return acc + Math.sin(t * 2.4) * (8 - t) * 2.2;
  }, 0);
};

export const HookScene: React.FC = () => {
  const shake = useShake([4, 14, 24]);
  return (
    <AbsoluteFill>
      <WoodGrainBackground seed="hook" />
      <AbsoluteFill style={{ translate: `${shake}px ${shake * 0.4}px` }}>
        <Column justify="center" gap={10}>
          <BigTitle delay={4} size={200} color={colors.woodLight}>
            ¿Madera,
          </BigTitle>
          <BigTitle delay={14} size={240} color={colors.cream}>
            MDF
          </BigTitle>
          <BigTitle delay={24} size={170} color={colors.accent}>
            o melamina?
          </BigTitle>
          <div style={{ height: 60 }} />
          <Sub delay={40} size={60}>
            Casi nadie sabe la diferencia
          </Sub>
          <Sub delay={50} size={48} color={colors.woodLight}>
            (y por eso pagan de más o se les hincha el mueble)
          </Sub>
        </Column>
      </AbsoluteFill>
      <Audio src={staticFile("sfx/whip.wav")} from={3} volume={0.6} />
      <Audio src={staticFile("sfx/whip.wav")} from={13} volume={0.6} />
      <Audio src={staticFile("sfx/whip.wav")} from={23} volume={0.6} />
    </AbsoluteFill>
  );
};

type MaterialProps = {
  readonly index: string;
  readonly title: string;
  readonly illustration: React.ReactNode;
  readonly items: { good: boolean; text: string }[];
  readonly verdict: string;
  readonly seed: string;
};

export const MaterialScene: React.FC<MaterialProps> = ({
  index,
  title,
  illustration,
  items,
  verdict,
  seed,
}) => {
  const firstItem = 62;
  const step = 22;
  const verdictAt = firstItem + items.length * step + 6;
  return (
    <AbsoluteFill>
      <WoodGrainBackground seed={seed} />
      <Column gap={24} justify="center">
        <Chip>{index}</Chip>
        <BigTitle delay={2} size={140}>
          {title}
        </BigTitle>
        <div style={{ display: "flex", justifyContent: "center", height: 600 }}>
          {illustration}
        </div>
        {items.map((it, i) => (
          <ProCon key={it.text} good={it.good} delay={firstItem + i * step}>
            {it.text}
          </ProCon>
        ))}
        <div style={{ height: 6 }} />
        <Verdict delay={verdictAt}>{verdict}</Verdict>
      </Column>
      {items.map((it, i) => (
        <Audio
          key={it.text}
          src={staticFile("sfx/mouse-click.wav")}
          from={firstItem + i * step}
          volume={0.5}
        />
      ))}
      <Audio src={staticFile("sfx/switch.wav")} from={verdictAt} volume={0.5} />
    </AbsoluteFill>
  );
};

export const MaderaScene: React.FC = () => (
  <MaterialScene
    seed="madera"
    index="1 / 3"
    title="Madera maciza"
    illustration={<LogSection />}
    items={[
      { good: true, text: "Dura décadas" },
      { good: true, text: "Se lija y se renueva como nueva" },
      { good: false, text: "Es la opción más cara" },
    ]}
    verdict="Ideal: muebles para toda la vida"
  />
);

export const MdfScene: React.FC = () => (
  <MaterialScene
    seed="mdf"
    index="2 / 3"
    title="MDF"
    illustration={<MdfPress />}
    items={[
      { good: true, text: "Superficie lisa: perfecta para pintar" },
      { good: true, text: "Permite diseños y relieves" },
      { good: false, text: "Pesa mucho y el agua lo daña" },
    ]}
    verdict="Ideal: puertas y muebles pintados"
  />
);

export const MelaminaScene: React.FC = () => (
  <MaterialScene
    seed="melamina"
    index="3 / 3"
    title="Melamina"
    illustration={<MelamineLayers />}
    items={[
      { good: true, text: "Económica y fácil de limpiar" },
      { good: true, text: "Muchos colores y texturas" },
      { good: false, text: "Si el agua entra por los bordes… se hincha" },
    ]}
    verdict="Ideal: closets y cocinas"
  />
);

export const TrucoScene: React.FC = () => {
  return (
    <AbsoluteFill>
      <WoodGrainBackground seed="truco" tint={colors.bgSoft} />
      <Column gap={26} justify="center">
        <Chip color={colors.yes}>EL TRUCO</Chip>
        <BigTitle delay={2} size={130}>
          Revisa los bordes
        </BigTitle>
        <Sub delay={8} size={48} color={colors.woodLight}>
          Ahí es donde entra el agua
        </Sub>
        <div style={{ display: "flex", justifyContent: "center", height: 600 }}>
          <EdgeTest />
        </div>
        <Sub delay={70} size={54}>
          Todo canto debe llevar cubrecanto
        </Sub>
        <Sub delay={86} size={54} color={colors.accent}>
          Y en cocina o baño, pide melamina RH (resistente a la humedad)
        </Sub>
      </Column>
      <Audio src={staticFile("sfx/page-turn.wav")} from={22} volume={0.6} />
      <Audio src={staticFile("sfx/switch.wav")} from={70} volume={0.5} />
      <Audio src={staticFile("sfx/switch.wav")} from={86} volume={0.5} />
    </AbsoluteFill>
  );
};

export const CtaScene: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill>
      <WoodGrainBackground seed="cta" />
      <Column justify="center" gap={30}>
        <BigTitle delay={2} size={190} color={colors.accent}>
          Guárdalo
        </BigTitle>
        <Sub delay={10} size={58}>
          para cuando hagas tu cocina o tu closet
        </Sub>
        <div style={{ height: 50 }} />
        <div
          style={{
            alignSelf: "center",
            textAlign: "center",
            border: `5px solid ${colors.woodLight}`,
            borderRadius: 36,
            padding: "40px 60px",
            backgroundColor: "rgba(0,0,0,0.45)",
            opacity: interpolate(frame, [22, 32], [0, 1], clamp),
            scale: interpolate(frame, [22, 36], [0.8, 1], {
              ...clamp,
              easing: Easing.bezier(0.34, 1.56, 0.64, 1),
            }),
          }}
        >
          <div
            style={{
              fontFamily: displayFont,
              fontSize: 130,
              color: colors.cream,
              letterSpacing: 6,
              lineHeight: 1.05,
            }}
          >
            HOUSE LITE
          </div>
          <div
            style={{
              fontFamily: bodyFont,
              fontWeight: 600,
              fontSize: 44,
              color: colors.woodLight,
            }}
          >
            Carpintería y muebles a la medida
          </div>
          <div
            style={{
              fontFamily: bodyFont,
              fontWeight: 600,
              fontSize: 44,
              color: colors.woodLight,
            }}
          >
            Hecho en nuestro taller de Tepatitlán
          </div>
        </div>
        <div
          style={{
            alignSelf: "center",
            textAlign: "center",
            fontFamily: bodyFont,
            fontWeight: 800,
            fontSize: 54,
            color: colors.bg,
            backgroundColor: colors.yes,
            borderRadius: 999,
            padding: "24px 50px",
            opacity: interpolate(frame, [36, 44], [0, 1], clamp),
            scale: `${interpolate(frame, [36, 48], [0.6, 1], {
              ...clamp,
              easing: Easing.bezier(0.34, 1.56, 0.64, 1),
            }) * (1 + Math.max(0, Math.sin((frame - 50) / 6)) * 0.04 * (frame > 50 ? 1 : 0))}`,
          }}
        >
          <div style={{ fontSize: 44 }}>Cotiza por WhatsApp</div>
          <div style={{ fontFamily: displayFont, fontWeight: 400, fontSize: 96, lineHeight: 1.1 }}>
            378 170 8278
          </div>
        </div>
      </Column>
      <Audio src={staticFile("sfx/whip.wav")} from={2} volume={0.5} />
      <Audio src={staticFile("sfx/switch.wav")} from={36} volume={0.5} />
    </AbsoluteFill>
  );
};
