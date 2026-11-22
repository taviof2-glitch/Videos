import { Audio } from "@remotion/media";
import {
  interpolate,
  staticFile,
  Track,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { ReelCaptions } from "./ReelCaptions";
import {
  ReelBenefits,
  ReelCallToAction,
  ReelHook,
  ReelLaser,
  ReelServices,
  ReelWorkshop,
} from "./ReelScenes";

// Reel publicitario de House Lite (9:16, 29.5 s).
// Voz: ElevenLabs "Xaisus - Joven y Brillante" (eleven_v4). Música: ElevenLabs Music.
// Tomas: Kling 2.5 Turbo vía ElevenLabs. Subtítulos: tiempos por palabra de ElevenLabs Scribe.
// Los cortes de escena siguen los tiempos de la voz (public/reel/voz.mp3).

const ProgressBar = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        height: 10,
        width: `${(frame / (durationInFrames - 1)) * 100}%`,
        backgroundColor: "#FFB347",
      }}
    />
  );
};

export const HouseLiteReel = () => {
  const { fps, durationInFrames } = useVideoConfig();

  return (
    <>
      <Track name="Escenas">
        <ReelHook
          name="Gancho"
          durationInFrames={96}
          style={{ backgroundColor: "#1A120C" }}
        />
        <ReelWorkshop
          name="Taller"
          from={96}
          durationInFrames={174}
          style={{ backgroundColor: "#1A120C" }}
        />
        <ReelServices
          name="Servicios"
          from={270}
          durationInFrames={147}
          style={{ backgroundColor: "#1A120C" }}
        />
        <ReelLaser
          name="Grabado láser"
          from={417}
          durationInFrames={123}
          style={{ backgroundColor: "#1A120C" }}
        />
        <ReelBenefits
          name="Ventajas"
          from={540}
          durationInFrames={126}
          style={{
            backgroundColor: "#1A120C",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
          }}
        />
        <ReelCallToAction
          name="Cierre WhatsApp"
          from={666}
          durationInFrames={219}
          style={{
            backgroundColor: "#2B1D14",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
          }}
        />
      </Track>
      <Track name="Subtítulos">
        <ReelCaptions
          name="Subtítulos"
          durationInFrames={540}
          style={{ position: "absolute", top: 1080, left: 80, width: 920 }}
          captions={[
            {
              text: "¡No",
              startMs: 144,
              endMs: 240,
              timestampMs: 192,
              confidence: null,
            },
            {
              text: " compres",
              startMs: 320,
              endMs: 640,
              timestampMs: 480,
              confidence: null,
            },
            {
              text: " muebles",
              startMs: 720,
              endMs: 1040,
              timestampMs: 880,
              confidence: null,
              pageBreakAfter: true,
            },
            {
              text: "hechos…",
              startMs: 1120,
              endMs: 1600,
              timestampMs: 1360,
              confidence: null,
              pageBreakAfter: true,
            },
            {
              text: "hasta",
              startMs: 1760,
              endMs: 2000,
              timestampMs: 1880,
              confidence: null,
            },
            {
              text: " ver",
              startMs: 2160,
              endMs: 2320,
              timestampMs: 2240,
              confidence: null,
            },
            {
              text: " esto!",
              startMs: 2400,
              endMs: 3000,
              timestampMs: 2700,
              confidence: null,
              pageBreakAfter: true,
            },
            {
              text: "En",
              startMs: 3280,
              endMs: 3360,
              timestampMs: 3320,
              confidence: null,
            },
            {
              text: " House",
              startMs: 3440,
              endMs: 3680,
              timestampMs: 3560,
              confidence: null,
            },
            {
              text: " Lite",
              startMs: 3760,
              endMs: 4000,
              timestampMs: 3880,
              confidence: null,
              pageBreakAfter: true,
            },
            {
              text: "diseñamos",
              startMs: 4080,
              endMs: 4640,
              timestampMs: 4360,
              confidence: null,
            },
            {
              text: " y",
              startMs: 4720,
              endMs: 4760,
              timestampMs: 4740,
              confidence: null,
              pageBreakAfter: true,
            },
            {
              text: "fabricamos",
              startMs: 4800,
              endMs: 5280,
              timestampMs: 5040,
              confidence: null,
            },
            {
              text: " tus",
              startMs: 5360,
              endMs: 5440,
              timestampMs: 5400,
              confidence: null,
              pageBreakAfter: true,
            },
            {
              text: "muebles",
              startMs: 5520,
              endMs: 5920,
              timestampMs: 5720,
              confidence: null,
            },
            {
              text: " a",
              startMs: 6000,
              endMs: 6040,
              timestampMs: 6020,
              confidence: null,
            },
            {
              text: " la",
              startMs: 6080,
              endMs: 6160,
              timestampMs: 6120,
              confidence: null,
              pageBreakAfter: true,
            },
            {
              text: "medida,",
              startMs: 6280,
              endMs: 6747,
              timestampMs: 6514,
              confidence: null,
              pageBreakAfter: true,
            },
            {
              text: "en",
              startMs: 6773,
              endMs: 6800,
              timestampMs: 6786,
              confidence: null,
            },
            {
              text: " nuestro",
              startMs: 6880,
              endMs: 7200,
              timestampMs: 7040,
              confidence: null,
            },
            {
              text: " propio",
              startMs: 7320,
              endMs: 7520,
              timestampMs: 7420,
              confidence: null,
              pageBreakAfter: true,
            },
            {
              text: "taller",
              startMs: 7600,
              endMs: 7840,
              timestampMs: 7720,
              confidence: null,
            },
            {
              text: " de",
              startMs: 7920,
              endMs: 8000,
              timestampMs: 7960,
              confidence: null,
              pageBreakAfter: true,
            },
            {
              text: "Tepatitlán.",
              startMs: 8040,
              endMs: 9000,
              timestampMs: 8520,
              confidence: null,
              pageBreakAfter: true,
            },
            {
              text: "Cocinas",
              startMs: 9040,
              endMs: 9360,
              timestampMs: 9200,
              confidence: null,
            },
            {
              text: " integrales,",
              startMs: 9440,
              endMs: 10240,
              timestampMs: 9840,
              confidence: null,
              pageBreakAfter: true,
            },
            {
              text: "closets,",
              startMs: 10320,
              endMs: 11040,
              timestampMs: 10680,
              confidence: null,
              pageBreakAfter: true,
            },
            {
              text: "muebles",
              startMs: 11120,
              endMs: 11360,
              timestampMs: 11240,
              confidence: null,
            },
            {
              text: " de",
              startMs: 11440,
              endMs: 11520,
              timestampMs: 11480,
              confidence: null,
            },
            {
              text: " TV",
              startMs: 11600,
              endMs: 11920,
              timestampMs: 11760,
              confidence: null,
              pageBreakAfter: true,
            },
            {
              text: "y",
              startMs: 12000,
              endMs: 12040,
              timestampMs: 12020,
              confidence: null,
            },
            {
              text: " mostradores",
              startMs: 12080,
              endMs: 12800,
              timestampMs: 12440,
              confidence: null,
            },
            {
              text: " para",
              startMs: 12880,
              endMs: 12960,
              timestampMs: 12920,
              confidence: null,
              pageBreakAfter: true,
            },
            {
              text: "tu",
              startMs: 13000,
              endMs: 13040,
              timestampMs: 13020,
              confidence: null,
            },
            {
              text: " negocio.",
              startMs: 13120,
              endMs: 13867,
              timestampMs: 13494,
              confidence: null,
              pageBreakAfter: true,
            },
            {
              text: "¿Buscas",
              startMs: 13893,
              endMs: 14160,
              timestampMs: 14026,
              confidence: null,
            },
            {
              text: " un",
              startMs: 14240,
              endMs: 14320,
              timestampMs: 14280,
              confidence: null,
            },
            {
              text: " regalo",
              startMs: 14400,
              endMs: 14640,
              timestampMs: 14520,
              confidence: null,
              pageBreakAfter: true,
            },
            {
              text: "único?",
              startMs: 14720,
              endMs: 15420,
              timestampMs: 15070,
              confidence: null,
              pageBreakAfter: true,
            },
            {
              text: "También",
              startMs: 15480,
              endMs: 15680,
              timestampMs: 15580,
              confidence: null,
            },
            {
              text: " hacemos",
              startMs: 15760,
              endMs: 16080,
              timestampMs: 15920,
              confidence: null,
              pageBreakAfter: true,
            },
            {
              text: "grabado",
              startMs: 16160,
              endMs: 16480,
              timestampMs: 16320,
              confidence: null,
            },
            {
              text: " láser",
              startMs: 16560,
              endMs: 16880,
              timestampMs: 16720,
              confidence: null,
              pageBreakAfter: true,
            },
            {
              text: "personalizado.",
              startMs: 17080,
              endMs: 18000,
              timestampMs: 17540,
              confidence: null,
              pageBreakAfter: true,
            },
          ]}
        />
      </Track>
      <ProgressBar />
      <Track name="Voz">
        <Audio name="Voz ElevenLabs" src={staticFile("reel/voz.mp3")} />
      </Track>
      <Track name="Música">
        <Audio
          name="Música ElevenLabs"
          src={staticFile("reel/musica.mp3")}
          durationInFrames={durationInFrames}
          volume={(f) =>
            interpolate(
              f,
              [
                0,
                8,
                27.4 * fps,
                28 * fps,
                durationInFrames - 15,
                durationInFrames - 1,
              ],
              [0, 0.2, 0.2, 0.45, 0.45, 0],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
            )
          }
        />
      </Track>
      <Track name="Efectos">
        <Audio
          name="Whoosh 1"
          src={staticFile("reel/whoosh.mp3")}
          from={92}
          volume={0.55}
        />
        <Audio
          name="Whoosh 2"
          src={staticFile("reel/whoosh.mp3")}
          from={266}
          volume={0.55}
        />
        <Audio
          name="Whoosh 3"
          src={staticFile("reel/whoosh.mp3")}
          from={413}
          volume={0.55}
        />
        <Audio
          name="Whoosh 4"
          src={staticFile("reel/whoosh.mp3")}
          from={536}
          volume={0.55}
        />
        <Audio
          name="Whoosh 5"
          src={staticFile("reel/whoosh.mp3")}
          from={662}
          volume={0.55}
        />
      </Track>
    </>
  );
};
