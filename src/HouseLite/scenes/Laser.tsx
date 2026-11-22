import {
  Easing,
  Interactive,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import "../fonts";
import { WoodGrain } from "../WoodGrain";

const LaserInner = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <>
      <WoodGrain />
      <Interactive.Div
        name="Pregunta regalo"
        style={{
          fontFamily: "Poppins, sans-serif",
          fontWeight: 700,
          fontSize: 76,
          color: "#E7D3BB",
          textAlign: "center",
          marginBottom: 30,
          opacity: interpolate(frame, [0, 0.3 * fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        ¿Un regalo único?
      </Interactive.Div>
      <div style={{ position: "relative", width: 900 }}>
        <Interactive.Div
          name="Grabado láser"
          style={{
            fontFamily: "Poppins, sans-serif",
            fontWeight: 800,
            fontSize: 124,
            lineHeight: 1.05,
            color: "#E0A15E",
            overflow: "hidden",
            marginLeft: 80,
            width: interpolate(frame, [0.3 * fps, 1.4 * fps], [0, 740], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        >
          <div style={{ width: 740, textAlign: "center" }}>
            Grabado
            <br />
            láser
          </div>
        </Interactive.Div>
        <Interactive.Div
          name="Rayo láser"
          style={{
            position: "absolute",
            top: -20,
            bottom: -20,
            left: 0,
            width: 8,
            borderRadius: 4,
            backgroundColor: "#FF5A36",
            boxShadow: "0 0 24px 8px rgba(255,90,54,0.8)",
            translate: interpolate(
              frame,
              [0.3 * fps, 1.4 * fps],
              ["80px 0px", "820px 0px"],
              {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              },
            ),
            opacity: interpolate(frame, [1.4 * fps, 1.6 * fps], [1, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        />
      </div>
      <Interactive.Div
        name="Personalizado"
        style={{
          fontFamily: "Poppins, sans-serif",
          fontWeight: 700,
          fontSize: 64,
          color: "#F5EBDD",
          textAlign: "center",
          marginTop: 40,
          opacity: interpolate(frame, [1.5 * fps, 1.9 * fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        100% personalizado
      </Interactive.Div>
      <Interactive.Div
        name="Productos láser"
        style={{
          fontFamily: "Poppins, sans-serif",
          fontWeight: 700,
          fontSize: 54,
          color: "#2B1D14",
          backgroundColor: "#F5EBDD",
          borderRadius: 999,
          padding: "20px 50px",
          marginTop: 50,
          scale: interpolate(frame, [1.9 * fps, 2.4 * fps], [0, 1], {
            easing: Easing.spring({ damping: 12 }),
            output: "perceptual-scale",
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        Cajas · Regalos · Souvenirs
      </Interactive.Div>
    </>
  );
};

export const Laser = Interactive.create({
  Component: LaserInner,
  layout: "absolute-fill",
  schema: {
    ...Interactive.backgroundSchema,
  },
});
