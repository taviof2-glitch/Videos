import {
  AbsoluteFill,
  CalculateMetadataFunction,
  Composition,
  Easing,
  Interactive,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

type Props = {};

const calculateMetadata: CalculateMetadataFunction<Props> = () => {
  return {};
};

export const MyComposition = () => {
  return (
    <Composition
      id="MyComp"
      component={MyComponent}
      durationInFrames={120}
      fps={30}
      width={1280}
      height={720}
      calculateMetadata={calculateMetadata}
    />
  );
};

const ease = Easing.bezier(0.16, 1, 0.3, 1);

const AccentBar: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <Interactive.Div
      name="Accent bar"
      style={{
        height: 8,
        borderRadius: 4,
        backgroundColor: "#7c5cff",
        width: interpolate(frame, [0, 0.8 * fps], [0, 160], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: ease,
        }),
      }}
    />
  );
};

const Title: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <Interactive.Div
      name="Title"
      style={{
        fontSize: 96,
        fontWeight: 800,
        letterSpacing: -2,
        color: "#ffffff",
        opacity: interpolate(frame, [0.3 * fps, 1.1 * fps], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: ease,
        }),
        translate: interpolate(
          frame,
          [0.3 * fps, 1.1 * fps],
          ["0px 40px", "0px 0px"],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease },
        ),
      }}
    >
      Your video starts here
    </Interactive.Div>
  );
};

const Subtitle: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <Interactive.Div
      name="Subtitle"
      style={{
        fontSize: 36,
        fontWeight: 400,
        color: "#a8a8b8",
        opacity: interpolate(frame, [0.8 * fps, 1.6 * fps], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: ease,
        }),
        translate: interpolate(
          frame,
          [0.8 * fps, 1.6 * fps],
          ["0px 24px", "0px 0px"],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease },
        ),
      }}
    >
      Made with Remotion
    </Interactive.Div>
  );
};

export const MyComponent: React.FC<Props> = () => {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#0b0b12",
        justifyContent: "center",
        padding: 120,
        gap: 28,
        fontFamily: "Inter, Helvetica, Arial, sans-serif",
      }}
    >
      <AccentBar />
      <Title />
      <Subtitle />
    </AbsoluteFill>
  );
};
