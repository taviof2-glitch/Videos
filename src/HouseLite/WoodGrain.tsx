import { AbsoluteFill } from "remotion";

// Textura decorativa de veta de madera + viñeta. No es editable a propósito.
export const WoodGrain: React.FC<{ readonly opacity?: number }> = ({
  opacity = 1,
}) => {
  return (
    <AbsoluteFill style={{ opacity, pointerEvents: "none" }}>
      <AbsoluteFill
        style={{
          backgroundImage:
            "repeating-linear-gradient(92deg, rgba(255,255,255,0.035) 0px, rgba(255,255,255,0.035) 2px, transparent 2px, transparent 11px), repeating-linear-gradient(88deg, rgba(0,0,0,0.08) 0px, rgba(0,0,0,0.08) 3px, transparent 3px, transparent 37px)",
        }}
      />
      <AbsoluteFill
        style={{
          backgroundImage:
            "radial-gradient(ellipse at 50% 45%, transparent 35%, rgba(0,0,0,0.55) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};
