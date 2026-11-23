import { Audio } from "@remotion/media";
import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import { AbsoluteFill, staticFile, useVideoConfig } from "remotion";
import {
  CtaScene,
  HookScene,
  MaderaScene,
  MdfScene,
  MelaminaScene,
  TrucoScene,
} from "./scenes";
import { ProgressBar } from "./ui";

// Duraciones (en frames a 30 fps) — compartidas con Root.tsx.
export const SCENES = {
  hook: 90,
  madera: 190,
  mdf: 190,
  melamina: 195,
  truco: 180,
  cta: 120,
};
export const TRANSITION = 8;
export const REEL_DURATION =
  Object.values(SCENES).reduce((a, b) => a + b, 0) - TRANSITION * 5;

const timing = linearTiming({ durationInFrames: TRANSITION });

export const ReelMadera: React.FC = () => {
  const { fps } = useVideoConfig();
  // Inicio de cada transición, para colocar el "whoosh".
  const starts: number[] = [];
  let t = 0;
  for (const d of Object.values(SCENES).slice(0, -1)) {
    t += d - TRANSITION;
    starts.push(t);
  }
  return (
    <AbsoluteFill style={{ backgroundColor: "#1a120b" }}>
      <TransitionSeries name="Escenas">
        <TransitionSeries.Sequence name="Gancho" durationInFrames={SCENES.hook}>
          <HookScene />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={slide({ direction: "from-right" })}
          timing={timing}
        />
        <TransitionSeries.Sequence name="Madera maciza" durationInFrames={SCENES.madera}>
          <MaderaScene />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={slide({ direction: "from-right" })}
          timing={timing}
        />
        <TransitionSeries.Sequence name="MDF" durationInFrames={SCENES.mdf}>
          <MdfScene />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={slide({ direction: "from-right" })}
          timing={timing}
        />
        <TransitionSeries.Sequence name="Melamina" durationInFrames={SCENES.melamina}>
          <MelaminaScene />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={wipe({ direction: "from-bottom" })}
          timing={timing}
        />
        <TransitionSeries.Sequence name="El truco" durationInFrames={SCENES.truco}>
          <TrucoScene />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={slide({ direction: "from-bottom" })}
          timing={timing}
        />
        <TransitionSeries.Sequence name="Cierre (CTA)" durationInFrames={SCENES.cta}>
          <CtaScene />
        </TransitionSeries.Sequence>
      </TransitionSeries>
      <ProgressBar />
      {starts.map((s) => (
        <Audio
          key={s}
          name="Whoosh"
          src={staticFile("sfx/whoosh.wav")}
          from={s - Math.round(fps * 0.1)}
          volume={0.7}
        />
      ))}
    </AbsoluteFill>
  );
};
