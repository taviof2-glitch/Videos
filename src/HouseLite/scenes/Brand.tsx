import {
  Easing,
  Interactive,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import "../fonts";
import { WoodGrain } from "../WoodGrain";

const BrandInner = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <>
      <WoodGrain />
      <Interactive.Div
        name="Nombre del negocio"
        style={{
          fontFamily: "Poppins, sans-serif",
          fontWeight: 800,
          fontSize: 170,
          letterSpacing: 4,
          color: "#F5EBDD",
          textAlign: "center",
          lineHeight: 1,
          opacity: interpolate(frame, [0, 0.4 * fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          scale: interpolate(frame, [0, 0.7 * fps], [0.7, 1], {
            easing: Easing.spring({ damping: 14 }),
            output: "perceptual-scale",
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        HOUSE
        <br />
        <span style={{ color: "#E0A15E" }}>LITE</span>
      </Interactive.Div>
      <Interactive.Div
        name="Tabla decorativa"
        style={{
          height: 14,
          marginTop: 48,
          marginBottom: 48,
          borderRadius: 7,
          backgroundColor: "#E0A15E",
          width: interpolate(frame, [0.4 * fps, 1.1 * fps], [0, 560], {
            easing: Easing.bezier(0.16, 1, 0.3, 1),
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      />
      <Interactive.Div
        name="Giro del negocio"
        style={{
          fontFamily: "Poppins, sans-serif",
          fontWeight: 700,
          fontSize: 72,
          color: "#F5EBDD",
          textAlign: "center",
          opacity: interpolate(frame, [0.8 * fps, 1.2 * fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        Carpintería y muebles
      </Interactive.Div>
      <Interactive.Div
        name="Ubicación"
        style={{
          fontFamily: "Poppins, sans-serif",
          fontWeight: 500,
          fontSize: 50,
          color: "#E7D3BB",
          textAlign: "center",
          marginTop: 24,
          padding: "0 90px",
          opacity: interpolate(frame, [1.2 * fps, 1.6 * fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          translate: interpolate(
            frame,
            [1.2 * fps, 1.6 * fps],
            ["0px 30px", "0px 0px"],
            {
              easing: Easing.spring({ damping: 200 }),
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            },
          ),
        }}
      >
        Taller propio en Tepatitlán, Jalisco
      </Interactive.Div>
    </>
  );
};

export const Brand = Interactive.create({
  Component: BrandInner,
  layout: "absolute-fill",
  schema: {
    ...Interactive.backgroundSchema,
  },
});
