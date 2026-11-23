import { Composition } from "remotion";
import { MyComposition } from "./Composition";
import { REEL_DURATION, ReelMadera } from "./ReelMadera/ReelMadera";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <MyComposition />
      <Composition
        id="ReelMadera"
        component={ReelMadera}
        durationInFrames={REEL_DURATION}
        fps={30}
        width={1080}
        height={1920}
      />
    </>
  );
};
