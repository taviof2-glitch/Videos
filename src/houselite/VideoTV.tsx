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
  useFade,
} from "./ui";
import { Soundtrack } from "./Audio";

// Tiempos (segundos) alineados con la locución voz_tv.mp3
const T = {
  error: 2.8,
  truco: 8.8,
  medida: 14.35,
  resultado: 17.2,
  fin: 21.2,
  total: 27.5,
};
export const TV_DURATION = T.total;

const FLOOR = 610; // y del piso dentro del panel (640 - 30)
const EYE_Y = 372;
const EYE_X = 238;
const TV_W = 300;
const TV_H = 175;
const TV_X = 520;
export const TV_HIGH = 50;
export const TV_LOW = EYE_Y - TV_H / 2;

export const Room: React.FC<{
  tvTop: number;
  cabinet?: number; // 0..1 aparición del mueble
  sight?: "bad" | "good";
  sightProgress?: number;
}> = ({ tvTop, cabinet = 0, sight, sightProgress = 1 }) => {
  const tvCx = TV_X + TV_W / 2;
  const tvCy = tvTop + TV_H / 2;
  const x2 = EYE_X + (tvCx - EYE_X) * sightProgress;
  const y2 = EYE_Y + (tvCy - EYE_Y) * sightProgress;
  return (
    <>
      {/* TV */}
      <div
        style={{
          position: "absolute",
          left: TV_X,
          top: tvTop,
          width: TV_W,
          height: TV_H,
          backgroundColor: "#1E2329",
          border: "10px solid #111",
          borderRadius: 10,
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 10,
            background: "linear-gradient(135deg, #3B5B7A 0%, #1F3347 100%)",
            borderRadius: 4,
          }}
        />
      </div>
      {/* Mueble de TV */}
      <div
        style={{
          position: "absolute",
          left: 470,
          top: FLOOR - 140,
          width: 400,
          height: 140,
          opacity: cabinet,
          translate: `0px ${(1 - cabinet) * 60}px`,
          backgroundColor: C.wood,
          borderTop: `14px solid ${C.woodDark}`,
          boxSizing: "border-box",
          display: "flex",
          gap: 10,
          padding: 14,
        }}
      >
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              flex: 1,
              backgroundColor: "#B5814C",
              borderRadius: 4,
              position: "relative",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 18,
                left: "35%",
                width: "30%",
                height: 6,
                borderRadius: 3,
                backgroundColor: C.dark,
              }}
            />
          </div>
        ))}
      </div>
      {/* Persona */}
      <div
        style={{
          position: "absolute",
          left: 165,
          top: 400,
          width: 110,
          height: 140,
          borderRadius: "50px 50px 0 0",
          backgroundColor: C.orange,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 175,
          top: EYE_Y - 52,
          width: 90,
          height: 90,
          borderRadius: 90,
          backgroundColor: "#E9B98F",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: EYE_X - 7,
          top: EYE_Y - 7,
          width: 14,
          height: 14,
          borderRadius: 14,
          backgroundColor: C.dark,
        }}
      />
      {/* Sillón */}
      <div
        style={{
          position: "absolute",
          left: 50,
          top: 470,
          width: 330,
          height: 110,
          backgroundColor: "#6B7F8E",
          borderRadius: "26px 26px 8px 8px",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 30,
          top: 440,
          width: 60,
          height: 150,
          backgroundColor: "#5A6C79",
          borderRadius: 20,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 340,
          top: 440,
          width: 60,
          height: 150,
          backgroundColor: "#5A6C79",
          borderRadius: 20,
        }}
      />
      {/* Línea de vista */}
      {sight ? (
        <svg
          width={900}
          height={640}
          style={{ position: "absolute", left: 0, top: 0 }}
        >
          <line
            x1={EYE_X}
            y1={EYE_Y}
            x2={x2}
            y2={y2}
            stroke={sight === "bad" ? C.red : C.green}
            strokeWidth={8}
            strokeDasharray="18 14"
            strokeLinecap="round"
          />
        </svg>
      ) : null}
    </>
  );
};

const NeckPain: React.FC<{ delay: number }> = ({ delay }) => {
  const frame = useCurrentFrame();
  const pulse = 1 + 0.12 * Math.sin((frame - delay) / 3);
  const o = useFade(delay, 6);
  return (
    <div
      style={{
        position: "absolute",
        left: 240,
        top: 395,
        opacity: o,
        scale: String(pulse),
      }}
    >
      <svg width={70} height={70} viewBox="0 0 70 70">
        {[0, 1, 2].map((i) => (
          <path
            key={i}
            d={`M${10 + i * 20} 10 l8 16 l-8 16 l8 16`}
            stroke={C.red}
            strokeWidth={6}
            fill="none"
            strokeLinecap="round"
          />
        ))}
      </svg>
    </div>
  );
};

const Hook: React.FC = () => (
  <Scene>
    <SeriesTag n={1} />
    <StopSign />
    <Title line1="No pongas tu tele" line2="tan alta" delay={4} top={360} />
    <Panel delay={2}>
      <Room tvTop={TV_HIGH} />
      <Pop
        delay={14}
        from={0.1}
        style={{ position: "absolute", left: 610, top: 77 }}
      >
        <Check ok={false} size={120} />
      </Pop>
    </Panel>
    <Sub delay={16}>Casi todo mundo lo hace</Sub>
  </Scene>
);

const ErrorScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = interpolate(frame, [10, 28], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  return (
    <Scene>
      <Badge>El error</Badge>
      <Title line1="Colgarla arriba" line2="como en el cine" />
      <Panel>
        <Room tvTop={TV_HIGH} sight="bad" sightProgress={p} />
        <NeckPain delay={Math.round(4 * fps)} />
      </Panel>
      <Sub delay={Math.round(4 * fps)}>Terminas con dolor de cuello</Sub>
      <Dots active={0} />
    </Scene>
  );
};

const TrucoScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const move = interpolate(
    frame,
    [Math.round(1.2 * fps), Math.round(2.2 * fps)],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.bezier(0.65, 0, 0.35, 1),
    },
  );
  const sight = interpolate(
    frame,
    [Math.round(2.4 * fps), Math.round(3 * fps)],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );
  return (
    <Scene>
      <Badge>El truco</Badge>
      <Title line1="Tele a la altura" line2="de tus ojos" />
      <Panel>
        <Room
          tvTop={TV_HIGH + (TV_LOW - TV_HIGH) * move}
          cabinet={move}
          sight={sight > 0 ? "good" : undefined}
          sightProgress={sight}
        />
        <Pop
          delay={Math.round(3 * fps)}
          from={0.1}
          style={{ position: "absolute", left: 760, top: TV_LOW - 50 }}
        >
          <Check size={100} />
        </Pop>
      </Panel>
      <Sub delay={Math.round(3.2 * fps)}>Ya sentado en tu sillón</Sub>
      <Dots active={1} />
    </Scene>
  );
};

const MedidaScene: React.FC = () => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [6, 40], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const tapeH = (FLOOR - EYE_Y) * p;
  return (
    <Scene>
      <Badge>La medida</Badge>
      <Title line1="Más o menos" line2="1 metro del piso" />
      <Panel>
        <Room tvTop={TV_LOW} cabinet={1} />
        {/* Cinta métrica vertical */}
        <div
          style={{
            position: "absolute",
            left: 425,
            top: FLOOR - tapeH,
            width: 34,
            height: tapeH,
            backgroundColor: C.tape,
            backgroundImage:
              "repeating-linear-gradient(0deg, #6b5a12 0 3px, transparent 3px 28px)",
            backgroundSize: "12px 100%",
            backgroundRepeat: "no-repeat",
            border: "2px solid #C9A01F",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 405,
            top: FLOOR - 40,
            width: 74,
            height: 54,
            backgroundColor: C.tape,
            border: "6px solid #333",
            borderRadius: 10,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 440,
            right: 0,
            top: EYE_Y - 2,
            height: 4,
            backgroundColor: C.orange,
            opacity: p,
            translate: "-200px 0px",
            width: 470,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 290,
            top: EYE_Y - 130,
            fontWeight: 900,
            fontSize: 64,
            color: C.orange,
            backgroundColor: C.white,
            padding: "4px 20px",
            borderRadius: 14,
            opacity: p,
          }}
        >
          ≈ {(p * 1).toFixed(2)} m
        </div>
      </Panel>
      <Sub delay={12}>Así no fuerzas el cuello</Sub>
      <Dots active={2} />
    </Scene>
  );
};

const ResultadoScene: React.FC = () => {
  const { fps } = useVideoConfig();
  return (
    <Scene>
      <Badge color={C.green}>Resultado</Badge>
      <Title line1="Mueble de TV bajito" line2="a tu medida" />
      <Panel>
        <Room tvTop={TV_LOW} cabinet={1} sight="good" />
        {/* Planta */}
        <div
          style={{
            position: "absolute",
            left: 815,
            top: 395,
            width: 46,
            height: 75,
            backgroundColor: C.dark,
            borderRadius: "4px 4px 12px 12px",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 800,
            top: 300,
            width: 76,
            height: 110,
            backgroundColor: "#4E8A4A",
            borderRadius: "50% 50% 40% 40%",
          }}
        />
        <Pop
          delay={Math.round(0.6 * fps)}
          from={0.1}
          style={{ position: "absolute", left: 700, top: 40 }}
        >
          <Check size={120} />
        </Pop>
      </Panel>
      <Sub delay={Math.round(1.2 * fps)}>Diseñado para tu sala</Sub>
      <Dots active={3} />
    </Scene>
  );
};

export const VideoTV: React.FC = () => {
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
        durationInFrames={f(T.truco - T.error)}
      >
        <ErrorScene />
      </Sequence>
      <Sequence
        name="El truco"
        from={f(T.truco)}
        durationInFrames={f(T.medida - T.truco)}
      >
        <TrucoScene />
      </Sequence>
      <Sequence
        name="La medida"
        from={f(T.medida)}
        durationInFrames={f(T.resultado - T.medida)}
      >
        <MedidaScene />
      </Sequence>
      <Sequence
        name="Resultado"
        from={f(T.resultado)}
        durationInFrames={f(T.fin - T.resultado)}
      >
        <ResultadoScene />
      </Sequence>
      <Sequence name="Cierre" from={f(T.fin)}>
        <EndCard nextText="Parte 2: tu closet →" />
      </Sequence>
      <Soundtrack
        voice="voz_tv.mp3"
        whooshes={[T.error, T.truco, T.medida, T.resultado, T.fin]}
        dings={[T.truco + 3, T.resultado + 0.6]}
        clicks={[0.45]}
      />
    </AbsoluteFill>
  );
};
