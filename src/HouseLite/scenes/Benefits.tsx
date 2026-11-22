import {
  Easing,
  Interactive,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import "../fonts";
import { WoodGrain } from "../WoodGrain";

// Palomita decorativa dentro de cada ventaja.
const Check = () => (
  <svg width={88} height={88} viewBox="0 0 88 88" style={{ flexShrink: 0 }}>
    <circle cx={44} cy={44} r={44} fill="#E0A15E" />
    <path
      d="M 24 45 L 38 59 L 64 31"
      fill="none"
      stroke="#2B1D14"
      strokeWidth={9}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const BenefitsInner = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <>
      <WoodGrain />
      <Interactive.Div
        name="Título ventajas"
        style={{
          fontFamily: "Poppins, sans-serif",
          fontWeight: 800,
          fontSize: 100,
          color: "#F5EBDD",
          textAlign: "center",
          marginBottom: 80,
          opacity: interpolate(frame, [0, 0.3 * fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        Con House Lite
      </Interactive.Div>
      <Interactive.Div
        name="Envío gratis"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 36,
          width: 900,
          marginBottom: 56,
          fontFamily: "Poppins, sans-serif",
          fontWeight: 700,
          fontSize: 64,
          lineHeight: 1.15,
          color: "#F5EBDD",
          opacity: interpolate(frame, [0.4 * fps, 0.7 * fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          scale: interpolate(frame, [0.4 * fps, 0.8 * fps], [0.6, 1], {
            easing: Easing.spring({ damping: 12 }),
            output: "perceptual-scale",
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        <Check />
        Envío gratis en Tepatitlán
      </Interactive.Div>
      <Interactive.Div
        name="Producto garantizado"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 36,
          width: 900,
          marginBottom: 56,
          fontFamily: "Poppins, sans-serif",
          fontWeight: 700,
          fontSize: 64,
          lineHeight: 1.15,
          color: "#F5EBDD",
          opacity: interpolate(frame, [1 * fps, 1.3 * fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          scale: interpolate(frame, [1 * fps, 1.4 * fps], [0.6, 1], {
            easing: Easing.spring({ damping: 12 }),
            output: "perceptual-scale",
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        <Check />
        Producto garantizado
      </Interactive.Div>
      <Interactive.Div
        name="Precios accesibles"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 36,
          width: 900,
          fontFamily: "Poppins, sans-serif",
          fontWeight: 700,
          fontSize: 64,
          lineHeight: 1.15,
          color: "#F5EBDD",
          opacity: interpolate(frame, [1.6 * fps, 1.9 * fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          scale: interpolate(frame, [1.6 * fps, 2 * fps], [0.6, 1], {
            easing: Easing.spring({ damping: 12 }),
            output: "perceptual-scale",
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        <Check />
        Precios accesibles
      </Interactive.Div>
    </>
  );
};

export const Benefits = Interactive.create({
  Component: BenefitsInner,
  layout: "absolute-fill",
  schema: {
    ...Interactive.backgroundSchema,
  },
});
