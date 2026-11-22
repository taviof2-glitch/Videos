import {
  Easing,
  Interactive,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import "../fonts";
import { WoodGrain } from "../WoodGrain";

// Cierre obligatorio: "Cotiza por WhatsApp: 378 170 8278".
const CallToActionInner = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <>
      <WoodGrain />
      <Interactive.Div
        name="Cotiza por WhatsApp"
        style={{
          fontFamily: "Poppins, sans-serif",
          fontWeight: 800,
          fontSize: 104,
          lineHeight: 1.08,
          color: "#F5EBDD",
          textAlign: "center",
          padding: "0 90px",
          marginBottom: 60,
          opacity: interpolate(frame, [0, 0.3 * fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          translate: interpolate(
            frame,
            [0, 0.5 * fps],
            ["0px -40px", "0px 0px"],
            {
              easing: Easing.spring({ damping: 200 }),
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            },
          ),
        }}
      >
        Cotiza por WhatsApp
      </Interactive.Div>
      <Interactive.Div
        name="Número de WhatsApp"
        style={{
          fontFamily: "Poppins, sans-serif",
          fontWeight: 800,
          fontSize: 118,
          letterSpacing: 2,
          color: "#FFFFFF",
          backgroundColor: "#25D366",
          borderRadius: 999,
          padding: "30px 64px",
          boxShadow: "0 20px 50px rgba(37,211,102,0.45)",
          scale: interpolate(
            frame,
            [0.4 * fps, 0.9 * fps, 2.2 * fps, 2.5 * fps, 2.8 * fps],
            [0, 1, 1, 1.08, 1],
            {
              easing: Easing.spring({ damping: 14 }),
              output: "perceptual-scale",
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            },
          ),
        }}
      >
        378 170 8278
      </Interactive.Div>
      <Interactive.Div
        name="Horario"
        style={{
          fontFamily: "Poppins, sans-serif",
          fontWeight: 500,
          fontSize: 50,
          color: "#E7D3BB",
          textAlign: "center",
          marginTop: 60,
          opacity: interpolate(frame, [1.1 * fps, 1.5 * fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        Lunes a sábado · 9:00 a 20:00
      </Interactive.Div>
      <Interactive.Div
        name="Firma"
        style={{
          position: "absolute",
          top: 1440,
          fontFamily: "Poppins, sans-serif",
          fontWeight: 700,
          fontSize: 52,
          color: "#E0A15E",
          textAlign: "center",
          opacity: interpolate(frame, [1.5 * fps, 1.9 * fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        House Lite · Carpintería y muebles
      </Interactive.Div>
    </>
  );
};

export const CallToAction = Interactive.create({
  Component: CallToActionInner,
  layout: "absolute-fill",
  schema: {
    ...Interactive.backgroundSchema,
  },
});
