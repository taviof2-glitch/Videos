import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import { useVideoConfig } from "remotion";
import { Benefits } from "./scenes/Benefits";
import { Brand } from "./scenes/Brand";
import { CallToAction } from "./scenes/CallToAction";
import { Hook } from "./scenes/Hook";
import { Laser } from "./scenes/Laser";
import { Services } from "./scenes/Services";

// Duración total: suma de escenas (690) - 5 transiciones de 15 = 615 fotogramas (20.5 s a 30 fps).
export const HouseLitePromo = () => {
  const { fps } = useVideoConfig();

  return (
    <TransitionSeries>
      <TransitionSeries.Sequence name="Gancho" durationInFrames={2.5 * fps}>
        <Hook
          name="Gancho"
          style={{
            backgroundColor: "#2B1D14",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
          }}
        />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={slide({ direction: "from-bottom" })}
        timing={linearTiming({ durationInFrames: 15 })}
      />
      <TransitionSeries.Sequence name="Marca" durationInFrames={3 * fps}>
        <Brand
          name="Marca"
          style={{
            backgroundColor: "#3A2618",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
          }}
        />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={wipe({ direction: "from-left" })}
        timing={linearTiming({ durationInFrames: 15 })}
      />
      <TransitionSeries.Sequence name="Servicios" durationInFrames={5 * fps}>
        <Services
          name="Servicios"
          style={{
            backgroundColor: "#D9B98F",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
          }}
        />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={slide({ direction: "from-right" })}
        timing={linearTiming({ durationInFrames: 15 })}
      />
      <TransitionSeries.Sequence
        name="Grabado láser"
        durationInFrames={3.5 * fps}
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
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: 15 })}
      />
      <TransitionSeries.Sequence name="Ventajas" durationInFrames={4 * fps}>
        <Benefits
          name="Ventajas"
          style={{
            backgroundColor: "#3A2618",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
          }}
        />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={slide({ direction: "from-bottom" })}
        timing={linearTiming({ durationInFrames: 15 })}
      />
      <TransitionSeries.Sequence
        name="Cierre WhatsApp"
        durationInFrames={5 * fps}
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
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
};
