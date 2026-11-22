import {
  Easing,
  Interactive,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import "../fonts";
import { WoodGrain } from "../WoodGrain";

// Gancho: visible desde el primer fotograma (sirve también de miniatura).
const HookInner = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <>
      <WoodGrain />
      <Interactive.Div
        name="Pregunta gancho"
        style={{
          fontFamily: "Poppins, sans-serif",
          fontWeight: 800,
          fontSize: 118,
          lineHeight: 1.08,
          color: "#F5EBDD",
          textAlign: "center",
          padding: "0 90px",
          scale: interpolate(frame, [0, 0.4 * fps], [1.18, 1], {
            easing: Easing.spring({ damping: 200 }),
            output: "perceptual-scale",
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        ¿Buscas muebles <span style={{ color: "#E0A15E" }}>a medida</span> en
        Tepatitlán?
      </Interactive.Div>
      <Interactive.Div
        name="Subtítulo gancho"
        style={{
          position: "absolute",
          top: 1330,
          fontFamily: "Poppins, sans-serif",
          fontWeight: 700,
          fontSize: 56,
          color: "#2B1D14",
          backgroundColor: "#E0A15E",
          padding: "18px 44px",
          borderRadius: 20,
          opacity: interpolate(frame, [2.3 * fps, 2.7 * fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          translate: interpolate(
            frame,
            [2.3 * fps, 2.7 * fps],
            ["0px 40px", "0px 0px"],
            {
              easing: Easing.spring({ damping: 200 }),
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            },
          ),
        }}
      >
        ¡Nosotros te los hacemos!
      </Interactive.Div>
    </>
  );
};

export const Hook = Interactive.create({
  Component: HookInner,
  layout: "absolute-fill",
  schema: {
    ...Interactive.backgroundSchema,
  },
});
