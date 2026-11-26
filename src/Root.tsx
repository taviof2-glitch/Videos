import { Composition } from "remotion";
import { MyComposition } from "./Composition";
import { LOGO_VIDEO_SECONDS, LogoHouseLite } from "./LogoHouseLite";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <MyComposition />
      <Composition
        id="LogoHouseLite"
        component={LogoHouseLite}
        durationInFrames={LOGO_VIDEO_SECONDS * 30}
        fps={30}
        width={1080}
        height={1920}
      />
    </>
  );
};
