import {
  AbsoluteFill,
  Easing,
  Interactive,
  interpolate,
  useCurrentFrame,
} from "remotion";
import "../fonts";

// Degradado oscuro arriba y abajo para que el texto se lea sobre el video.
export const Shade: React.FC<{ readonly strength?: number }> = ({
  strength = 1,
}) => (
  <AbsoluteFill
    style={{
      pointerEvents: "none",
      opacity: strength,
      backgroundImage:
        "linear-gradient(180deg, rgba(10,6,3,0.75) 0%, rgba(10,6,3,0) 28%, rgba(10,6,3,0) 48%, rgba(10,6,3,0.7) 78%, rgba(10,6,3,0.85) 100%)",
    }}
  />
);

// Etiqueta tipo "píldora" que entra deslizándose. Su inicio se ajusta con `from`.
const ChipInner = ({
  children,
  style,
}: {
  readonly children: React.ReactNode;
  readonly style?: React.CSSProperties;
}) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        display: "inline-block",
        whiteSpace: "nowrap",
        fontFamily: "Poppins, sans-serif",
        fontWeight: 700,
        fontSize: 58,
        color: "#FFFFFF",
        backgroundColor: "rgba(26,18,12,0.82)",
        borderLeft: "14px solid #FFB347",
        borderRadius: 22,
        padding: "22px 40px",
        boxShadow: "0 16px 40px rgba(0,0,0,0.45)",
        opacity: interpolate(frame, [0, 4], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }),
        translate: `${interpolate(frame, [0, 8], [-140, 0], {
          easing: Easing.out(Easing.cubic),
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })}px 0px`,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

export const Chip = Interactive.create({
  Component: ChipInner,
  layout: "none",
  schema: {
    ...Interactive.textSchema,
    ...Interactive.backgroundSchema,
    ...Interactive.childrenSchema,
  },
});

// Aviso pequeño para tomas generadas con IA.
export const IllustrativeTag: React.FC = () => (
  <div
    style={{
      position: "absolute",
      top: 70,
      right: 60,
      fontFamily: "Poppins, sans-serif",
      fontWeight: 500,
      fontSize: 28,
      color: "rgba(255,255,255,0.75)",
      backgroundColor: "rgba(0,0,0,0.35)",
      padding: "6px 16px",
      borderRadius: 10,
    }}
  >
    Imagen ilustrativa
  </div>
);

export const CheckIcon: React.FC<{ readonly size?: number }> = ({
  size = 96,
}) => (
  <svg width={size} height={size} viewBox="0 0 88 88" style={{ flexShrink: 0 }}>
    <circle cx={44} cy={44} r={44} fill="#FFB347" />
    <path
      d="M 24 45 L 38 59 L 64 31"
      fill="none"
      stroke="#1A120C"
      strokeWidth={9}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const WhatsAppIcon: React.FC<{ readonly size?: number }> = ({
  size = 96,
}) => (
  <svg width={size} height={size} viewBox="0 0 32 32" style={{ flexShrink: 0 }}>
    <path
      fill="#FFFFFF"
      d="M16 3C8.8 3 3 8.7 3 15.8c0 2.5.7 4.9 2.1 7L3 29l6.4-2c2 1.1 4.3 1.7 6.6 1.7 7.2 0 13-5.7 13-12.8S23.2 3 16 3zm0 23.4c-2.1 0-4.1-.6-5.9-1.6l-.4-.2-3.8 1.2 1.2-3.7-.3-.4c-1.2-1.8-1.8-3.8-1.8-5.9C5 9.8 9.9 5.1 16 5.1s11 4.7 11 10.7-4.9 10.6-11 10.6zm6-7.9c-.3-.2-2-1-2.3-1.1-.3-.1-.5-.2-.8.2-.2.3-.9 1.1-1.1 1.3-.2.2-.4.3-.7.1-.3-.2-1.4-.5-2.7-1.6-1-.9-1.7-2-1.9-2.3-.2-.3 0-.5.1-.7l.5-.6c.2-.2.2-.4.3-.6.1-.2.1-.4 0-.6l-1-2.5c-.3-.7-.6-.6-.8-.6h-.7c-.2 0-.6.1-.9.4-.3.3-1.2 1.1-1.2 2.7s1.2 3.2 1.4 3.4c.2.2 2.4 3.6 5.8 5 .8.3 1.5.6 2 .7.8.3 1.6.2 2.2.1.7-.1 2-.8 2.3-1.6.3-.8.3-1.5.2-1.6-.1-.1-.3-.2-.7-.4z"
    />
  </svg>
);
