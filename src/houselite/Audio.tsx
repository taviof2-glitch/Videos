import React from "react";
import { Sequence, staticFile, useVideoConfig } from "remotion";
import { Audio } from "@remotion/media";

/** Voz + música de fondo + efectos en los cambios de escena. */
export const Soundtrack: React.FC<{
  voice: string;
  whooshes: number[]; // segundos
  dings: number[]; // segundos
  clicks?: number[]; // segundos
}> = ({ voice, whooshes, dings, clicks = [] }) => {
  const { fps } = useVideoConfig();
  return (
    <>
      <Audio name="Voz" src={staticFile(`audio/${voice}`)} />
      <Audio name="Música" src={staticFile("audio/musica.wav")} volume={0.13} />
      {whooshes.map((t) => (
        <Sequence
          key={`w${t}`}
          name="Whoosh"
          from={Math.round(t * fps)}
          durationInFrames={fps}
        >
          <Audio src={staticFile("audio/whoosh.wav")} volume={0.35} />
        </Sequence>
      ))}
      {dings.map((t) => (
        <Sequence
          key={`d${t}`}
          name="Ding"
          from={Math.round(t * fps)}
          durationInFrames={2 * fps}
        >
          <Audio src={staticFile("audio/ding.wav")} volume={0.25} />
        </Sequence>
      ))}
      {clicks.map((t) => (
        <Sequence
          key={`c${t}`}
          name="Click"
          from={Math.round(t * fps)}
          durationInFrames={fps}
        >
          <Audio src={staticFile("audio/mouse-click.wav")} volume={0.4} />
        </Sequence>
      ))}
    </>
  );
};
