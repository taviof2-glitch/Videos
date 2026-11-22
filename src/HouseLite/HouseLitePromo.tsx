import { Audio } from "@remotion/media";
import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import { staticFile, useVideoConfig } from "remotion";
import { Benefits } from "./scenes/Benefits";
import { Brand } from "./scenes/Brand";
import { CallToAction } from "./scenes/CallToAction";
import { Hook } from "./scenes/Hook";
import { Laser } from "./scenes/Laser";
import { Services } from "./scenes/Services";

// Voz en off: un clip por escena (voz es-MX-JorgeNeural, generados con `npm run voz`).
// Cada clip va dentro de su escena para que se mueva con ella.
// Duración total: suma de escenas (819) - 5 transiciones de 15 = 744 fotogramas (24.8 s a 30 fps).
export const HouseLitePromo = () => {
  const { fps } = useVideoConfig();

  return (
    <TransitionSeries>
      <TransitionSeries.Sequence name="Gancho" durationInFrames={4.2 * fps}>
        <Hook
          name="Gancho"
          style={{
            backgroundColor: "#2B1D14",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
          }}
        />
        <Audio name="Voz gancho" src={staticFile("voz/01-gancho.mp3")} />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={slide({ direction: "from-bottom" })}
        timing={linearTiming({ durationInFrames: 15 })}
      />
      <TransitionSeries.Sequence name="Marca" durationInFrames={3.2 * fps}>
        <Brand
          name="Marca"
          style={{
            backgroundColor: "#3A2618",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
          }}
        />
        <Audio name="Voz marca" src={staticFile("voz/02-marca.mp3")} />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={wipe({ direction: "from-left" })}
        timing={linearTiming({ durationInFrames: 15 })}
      />
      <TransitionSeries.Sequence name="Servicios" durationInFrames={4.6 * fps}>
        <Services
          name="Servicios"
          style={{
            backgroundColor: "#D9B98F",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
          }}
        />
        <Audio name="Voz servicios" src={staticFile("voz/03-servicios.mp3")} />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={slide({ direction: "from-right" })}
        timing={linearTiming({ durationInFrames: 15 })}
      />
      <TransitionSeries.Sequence
        name="Grabado láser"
        durationInFrames={4.4 * fps}
      >
        <Laser
          name="Grabado láser"
          style={{
            backgroundColor: "#1F1510",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
          }}
        />
        <Audio name="Voz láser" src={staticFile("voz/04-laser.mp3")} />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: 15 })}
      />
      <TransitionSeries.Sequence name="Ventajas" durationInFrames={4.4 * fps}>
        <Benefits
          name="Ventajas"
          style={{
            backgroundColor: "#3A2618",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
          }}
        />
        <Audio name="Voz ventajas" src={staticFile("voz/05-ventajas.mp3")} />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={slide({ direction: "from-bottom" })}
        timing={linearTiming({ durationInFrames: 15 })}
      />
      <TransitionSeries.Sequence
        name="Cierre WhatsApp"
        durationInFrames={6.5 * fps}
      >
        <CallToAction
          name="Cierre WhatsApp"
          style={{
            backgroundColor: "#2B1D14",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
          }}
        />
        <Audio name="Voz cierre" src={staticFile("voz/06-cierre.mp3")} />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
};
