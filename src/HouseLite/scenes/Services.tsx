import {
  Easing,
  Interactive,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import "../fonts";
import { WoodGrain } from "../WoodGrain";

const ServicesInner = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <>
      <WoodGrain opacity={0.6} />
      <Interactive.Div
        name="Título servicios"
        style={{
          fontFamily: "Poppins, sans-serif",
          fontWeight: 800,
          fontSize: 96,
          lineHeight: 1.1,
          color: "#2B1D14",
          textAlign: "center",
          marginBottom: 70,
          padding: "0 90px",
          opacity: interpolate(frame, [0, 0.3 * fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        Diseñamos y fabricamos
      </Interactive.Div>
      <Interactive.Div
        name="Cocinas integrales"
        style={{
          fontFamily: "Poppins, sans-serif",
          fontWeight: 700,
          fontSize: 68,
          color: "#F5EBDD",
          backgroundColor: "#5A3A22",
          borderLeft: "18px solid #E0A15E",
          borderRadius: 24,
          padding: "34px 48px",
          width: 880,
          marginBottom: 30,
          boxShadow: "0 18px 40px rgba(43,29,20,0.35)",
          translate: interpolate(
            frame,
            [0.4 * fps, 0.9 * fps],
            ["-1100px 0px", "0px 0px"],
            {
              easing: Easing.spring({ damping: 200 }),
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            },
          ),
        }}
      >
        Cocinas integrales
      </Interactive.Div>
      <Interactive.Div
        name="Muebles de TV"
        style={{
          fontFamily: "Poppins, sans-serif",
          fontWeight: 700,
          fontSize: 68,
          color: "#F5EBDD",
          backgroundColor: "#5A3A22",
          borderLeft: "18px solid #E0A15E",
          borderRadius: 24,
          padding: "34px 48px",
          width: 880,
          marginBottom: 30,
          boxShadow: "0 18px 40px rgba(43,29,20,0.35)",
          translate: interpolate(
            frame,
            [0.9 * fps, 1.4 * fps],
            ["1100px 0px", "0px 0px"],
            {
              easing: Easing.spring({ damping: 200 }),
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            },
          ),
        }}
      >
        Muebles de TV
      </Interactive.Div>
      <Interactive.Div
        name="Mostradores"
        style={{
          fontFamily: "Poppins, sans-serif",
          fontWeight: 700,
          fontSize: 68,
          color: "#F5EBDD",
          backgroundColor: "#5A3A22",
          borderLeft: "18px solid #E0A15E",
          borderRadius: 24,
          padding: "34px 48px",
          width: 880,
          marginBottom: 30,
          boxShadow: "0 18px 40px rgba(43,29,20,0.35)",
          translate: interpolate(
            frame,
            [1.4 * fps, 1.9 * fps],
            ["-1100px 0px", "0px 0px"],
            {
              easing: Easing.spring({ damping: 200 }),
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            },
          ),
        }}
      >
        Mostradores
      </Interactive.Div>
      <Interactive.Div
        name="Muebles a medida"
        style={{
          fontFamily: "Poppins, sans-serif",
          fontWeight: 700,
          fontSize: 68,
          color: "#2B1D14",
          backgroundColor: "#E0A15E",
          borderLeft: "18px solid #5A3A22",
          borderRadius: 24,
          padding: "34px 48px",
          width: 880,
          boxShadow: "0 18px 40px rgba(43,29,20,0.35)",
          translate: interpolate(
            frame,
            [1.9 * fps, 2.4 * fps],
            ["1100px 0px", "0px 0px"],
            {
              easing: Easing.spring({ damping: 200 }),
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            },
          ),
        }}
      >
        Muebles a medida
      </Interactive.Div>
    </>
  );
};

export const Services = Interactive.create({
  Component: ServicesInner,
  layout: "absolute-fill",
  schema: {
    ...Interactive.backgroundSchema,
  },
});
