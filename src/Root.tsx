import { Composition, Folder, Still } from "remotion";
import {
  PortadaCloset,
  PortadaMateriales,
  PortadaTV,
} from "./houselite/Portadas";
import { MyComposition } from "./Composition";
import { TV_DURATION, VideoTV } from "./houselite/VideoTV";
import { CLOSET_DURATION, VideoCloset } from "./houselite/VideoCloset";
import {
  MATERIALES_DURATION,
  VideoMateriales,
} from "./houselite/VideoMateriales";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <MyComposition />
      <Folder name="HouseLite-Serie-Antes-de-pedir">
        <Composition
          id="HL-TV-Altura"
          component={VideoTV}
          durationInFrames={Math.round(TV_DURATION * 30)}
          fps={30}
          width={1080}
          height={1920}
        />
        <Composition
          id="HL-Closet-Zonas"
          component={VideoCloset}
          durationInFrames={Math.round(CLOSET_DURATION * 30)}
          fps={30}
          width={1080}
          height={1920}
        />
        <Composition
          id="HL-Materiales"
          component={VideoMateriales}
          durationInFrames={Math.round(MATERIALES_DURATION * 30)}
          fps={30}
          width={1080}
          height={1920}
        />
        <Still
          id="Portada-TV"
          component={PortadaTV}
          width={1080}
          height={1920}
        />
        <Still
          id="Portada-Closet"
          component={PortadaCloset}
          width={1080}
          height={1920}
        />
        <Still
          id="Portada-Materiales"
          component={PortadaMateriales}
          width={1080}
          height={1920}
        />
      </Folder>
    </>
  );
};
