import { Composition, Folder } from "remotion";
import { HouseLitePromo } from "./HouseLite/HouseLitePromo";
import { HouseLiteReel } from "./HouseLite/Reel/HouseLiteReel";
import { Benefits } from "./HouseLite/scenes/Benefits";
import { Brand } from "./HouseLite/scenes/Brand";
import { CallToAction } from "./HouseLite/scenes/CallToAction";
import { Hook } from "./HouseLite/scenes/Hook";
import { Laser } from "./HouseLite/scenes/Laser";
import { Services } from "./HouseLite/scenes/Services";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Folder name="HouseLite">
        <Composition
          id="HouseLiteReel"
          component={HouseLiteReel}
          durationInFrames={885}
          fps={30}
          width={1080}
          height={1920}
        />
        <Composition
          id="HouseLitePromo"
          component={HouseLitePromo}
          durationInFrames={744}
          fps={30}
          width={1080}
          height={1920}
        />
        <Folder name="Escenas">
          <Composition
            id="Gancho"
            component={Hook}
            durationInFrames={126}
            fps={30}
            width={1080}
            height={1920}
            defaultProps={{
              style: {
                backgroundColor: "#2B1D14",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
              },
            }}
          />
          <Composition
            id="Marca"
            component={Brand}
            durationInFrames={96}
            fps={30}
            width={1080}
            height={1920}
            defaultProps={{
              style: {
                backgroundColor: "#3A2618",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
              },
            }}
          />
          <Composition
            id="Servicios"
            component={Services}
            durationInFrames={138}
            fps={30}
            width={1080}
            height={1920}
            defaultProps={{
              style: {
                backgroundColor: "#D9B98F",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
              },
            }}
          />
          <Composition
            id="GrabadoLaser"
            component={Laser}
            durationInFrames={132}
            fps={30}
            width={1080}
            height={1920}
            defaultProps={{
              style: {
                backgroundColor: "#1F1510",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
              },
            }}
          />
          <Composition
            id="Ventajas"
            component={Benefits}
            durationInFrames={132}
            fps={30}
            width={1080}
            height={1920}
            defaultProps={{
              style: {
                backgroundColor: "#3A2618",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
              },
            }}
          />
          <Composition
            id="CierreWhatsApp"
            component={CallToAction}
            durationInFrames={195}
            fps={30}
            width={1080}
            height={1920}
            defaultProps={{
              style: {
                backgroundColor: "#2B1D14",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
              },
            }}
          />
        </Folder>
      </Folder>
    </>
  );
};
