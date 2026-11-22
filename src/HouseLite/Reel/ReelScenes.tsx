import { Video } from "@remotion/media";
import {
  AbsoluteFill,
  Easing,
  Interactive,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import "../fonts";
import { WoodGrain } from "../WoodGrain";
import {
  CheckIcon,
  Chip,
  IllustrativeTag,
  Shade,
  WhatsAppIcon,
} from "./ReelParts";

// Las tomas de video se generaron con IA (ElevenLabs / Kling 2.5) y no tienen audio.

// 1. Gancho: sierra de mesa con zoom de impacto.
const HookInner = () => {
  const frame = useCurrentFrame();
  return (
    <>
      <AbsoluteFill
        style={{
          scale: String(
            interpolate(frame, [0, 10], [1.3, 1.06], {
              easing: Easing.out(Easing.cubic),
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          ),
        }}
      >
        <Video
          name="Toma sierra"
          src={staticFile("reel/toma-sierra.mp4")}
          volume={0}
          objectFit="cover"
          style={{ width: "100%", height: "100%" }}
        />
      </AbsoluteFill>
      <Shade />
    </>
  );
};

export const ReelHook = Interactive.create({
  Component: HookInner,
  layout: "absolute-fill",
  schema: { ...Interactive.backgroundSchema },
});

// 2. Taller: lijado + marca.
const WorkshopInner = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <>
      <Video
        name="Toma lijado"
        src={staticFile("reel/toma-lijado.mp4")}
        volume={0}
        playbackRate={0.86}
        objectFit="cover"
        style={{ width: "100%", height: "100%" }}
      />
      <Shade />
      <Interactive.Div
        name="Logotipo"
        style={{
          position: "absolute",
          top: 150,
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: "Poppins, sans-serif",
          fontWeight: 800,
          fontSize: 128,
          letterSpacing: 6,
          lineHeight: 1,
          color: "#FFFFFF",
          textShadow: "0 10px 30px rgba(0,0,0,0.6)",
          opacity: interpolate(frame, [0.15 * fps, 0.4 * fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          scale: interpolate(frame, [0.15 * fps, 0.6 * fps], [0.8, 1], {
            easing: Easing.out(Easing.back(1.8)),
            output: "perceptual-scale",
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        HOUSE <span style={{ color: "#FFB347" }}>LITE</span>
      </Interactive.Div>
      <Interactive.Div
        name="Giro"
        style={{
          position: "absolute",
          top: 300,
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: "Poppins, sans-serif",
          fontWeight: 700,
          fontSize: 46,
          letterSpacing: 8,
          color: "#F5EBDD",
          textShadow: "0 6px 20px rgba(0,0,0,0.7)",
          opacity: interpolate(frame, [0.5 * fps, 0.8 * fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        CARPINTERÍA Y MUEBLES
      </Interactive.Div>
      <Chip
        name="Taller propio"
        from={4.3 * fps}
        style={{ position: "absolute", top: 420, left: 80 }}
      >
        Taller propio en Tepatitlán
      </Chip>
    </>
  );
};

export const ReelWorkshop = Interactive.create({
  Component: WorkshopInner,
  layout: "absolute-fill",
  schema: { ...Interactive.backgroundSchema },
});

// 3. Servicios: cocina (ilustrativa) + etiquetas al ritmo de la voz.
const ServicesInner = () => {
  const { fps } = useVideoConfig();
  return (
    <>
      <Video
        name="Toma cocina"
        src={staticFile("reel/toma-cocina.mp4")}
        volume={0}
        objectFit="cover"
        style={{ width: "100%", height: "100%" }}
      />
      <Shade />
      <IllustrativeTag />
      <Chip
        name="Cocinas integrales"
        from={0}
        style={{ position: "absolute", top: 170, left: 80 }}
      >
        Cocinas integrales
      </Chip>
      <Chip
        name="Closets"
        from={1.28 * fps}
        style={{ position: "absolute", top: 320, left: 80 }}
      >
        Closets
      </Chip>
      <Chip
        name="Muebles de TV"
        from={2.08 * fps}
        style={{ position: "absolute", top: 470, left: 80 }}
      >
        Muebles de TV
      </Chip>
      <Chip
        name="Mostradores"
        from={3.04 * fps}
        style={{ position: "absolute", top: 620, left: 80 }}
      >
        Mostradores para negocio
      </Chip>
    </>
  );
};

export const ReelServices = Interactive.create({
  Component: ServicesInner,
  layout: "absolute-fill",
  schema: { ...Interactive.backgroundSchema },
});

// 4. Grabado láser.
const LaserInner = () => {
  const { fps } = useVideoConfig();
  return (
    <>
      <Video
        name="Toma láser"
        src={staticFile("reel/toma-laser.mp4")}
        volume={0}
        objectFit="cover"
        style={{ width: "100%", height: "100%" }}
      />
      <Shade />
      <IllustrativeTag />
      <Chip
        name="Grabado láser"
        from={2.2 * fps}
        style={{
          position: "absolute",
          top: 200,
          left: 80,
          fontSize: 54,
          backgroundColor: "rgba(255,90,54,0.9)",
          borderLeft: "14px solid #FFFFFF",
        }}
      >
        Grabado láser personalizado
      </Chip>
      <Chip
        name="Productos láser"
        from={2.9 * fps}
        style={{ position: "absolute", top: 360, left: 80 }}
      >
        Cajas · Regalos · Souvenirs
      </Chip>
    </>
  );
};

export const ReelLaser = Interactive.create({
  Component: LaserInner,
  layout: "absolute-fill",
  schema: { ...Interactive.backgroundSchema },
});

// 5. Ventajas sobre la toma de la sierra, oscurecida.
const BenefitsInner = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <>
      <AbsoluteFill
        style={{ filter: "blur(10px) brightness(0.35)", scale: "1.1" }}
      >
        <Video
          name="Fondo ventajas"
          src={staticFile("reel/toma-lijado.mp4")}
          volume={0}
          objectFit="cover"
          style={{ width: "100%", height: "100%" }}
        />
      </AbsoluteFill>
      <Interactive.Div
        name="Título ventajas"
        style={{
          fontFamily: "Poppins, sans-serif",
          fontWeight: 800,
          fontSize: 96,
          lineHeight: 1.05,
          color: "#FFFFFF",
          textAlign: "center",
          marginBottom: 90,
          opacity: interpolate(frame, [0, 0.25 * fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        ¿Por qué <span style={{ color: "#FFB347" }}>House Lite</span>?
      </Interactive.Div>
      <Interactive.Div
        name="Envío gratis"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 36,
          width: 920,
          marginBottom: 60,
          fontFamily: "Poppins, sans-serif",
          fontWeight: 800,
          fontSize: 70,
          lineHeight: 1.1,
          color: "#FFFFFF",
          opacity: interpolate(frame, [0.08 * fps, 0.3 * fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          scale: interpolate(frame, [0.08 * fps, 0.45 * fps], [0.6, 1], {
            easing: Easing.out(Easing.back(2)),
            output: "perceptual-scale",
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        <CheckIcon />
        Envío GRATIS en Tepa
      </Interactive.Div>
      <Interactive.Div
        name="Garantía"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 36,
          width: 920,
          marginBottom: 60,
          fontFamily: "Poppins, sans-serif",
          fontWeight: 800,
          fontSize: 70,
          lineHeight: 1.1,
          color: "#FFFFFF",
          opacity: interpolate(frame, [1.6 * fps, 1.82 * fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          scale: interpolate(frame, [1.6 * fps, 1.97 * fps], [0.6, 1], {
            easing: Easing.out(Easing.back(2)),
            output: "perceptual-scale",
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        <CheckIcon />
        Producto garantizado
      </Interactive.Div>
      <Interactive.Div
        name="Precios"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 36,
          width: 920,
          fontFamily: "Poppins, sans-serif",
          fontWeight: 800,
          fontSize: 70,
          lineHeight: 1.1,
          color: "#FFFFFF",
          opacity: interpolate(frame, [2.9 * fps, 3.12 * fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          scale: interpolate(frame, [2.9 * fps, 3.27 * fps], [0.6, 1], {
            easing: Easing.out(Easing.back(2)),
            output: "perceptual-scale",
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        <CheckIcon />
        Precios accesibles
      </Interactive.Div>
    </>
  );
};

export const ReelBenefits = Interactive.create({
  Component: BenefitsInner,
  layout: "absolute-fill",
  schema: { ...Interactive.backgroundSchema },
});

// 6. Cierre: llamada a la acción por WhatsApp.
const CallToActionInner = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <>
      <WoodGrain />
      <Interactive.Div
        name="Cotiza hoy"
        style={{
          fontFamily: "Poppins, sans-serif",
          fontWeight: 800,
          fontSize: 132,
          lineHeight: 1,
          color: "#FFFFFF",
          textAlign: "center",
          opacity: interpolate(frame, [0, 0.2 * fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          scale: interpolate(frame, [0, 0.45 * fps], [1.4, 1], {
            easing: Easing.out(Easing.cubic),
            output: "perceptual-scale",
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        ¡Cotiza hoy!
      </Interactive.Div>
      <Interactive.Div
        name="Por WhatsApp"
        style={{
          fontFamily: "Poppins, sans-serif",
          fontWeight: 700,
          fontSize: 66,
          color: "#FFB347",
          textAlign: "center",
          marginTop: 16,
          marginBottom: 60,
          opacity: interpolate(frame, [0.6 * fps, 0.9 * fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        por WhatsApp
      </Interactive.Div>
      <Interactive.Div
        name="Botón WhatsApp"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 28,
          fontFamily: "Poppins, sans-serif",
          fontWeight: 800,
          fontSize: 104,
          letterSpacing: 1,
          color: "#FFFFFF",
          backgroundColor: "#25D366",
          borderRadius: 999,
          padding: "30px 60px 30px 44px",
          boxShadow: "0 24px 60px rgba(37,211,102,0.45)",
          scale: interpolate(
            frame,
            [
              1.4 * fps,
              1.8 * fps,
              3.6 * fps,
              3.85 * fps,
              4.1 * fps,
              5.4 * fps,
              5.65 * fps,
              5.9 * fps,
            ],
            [0, 1, 1, 1.07, 1, 1, 1.07, 1],
            {
              easing: Easing.out(Easing.back(1.6)),
              output: "perceptual-scale",
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            },
          ),
        }}
      >
        <WhatsAppIcon size={104} />
        378 170 8278
      </Interactive.Div>
      <Interactive.Div
        name="Horario"
        style={{
          fontFamily: "Poppins, sans-serif",
          fontWeight: 600,
          fontSize: 48,
          color: "#F5EBDD",
          textAlign: "center",
          marginTop: 60,
          opacity: interpolate(frame, [2.2 * fps, 2.5 * fps], [0, 1], {
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
          fontFamily: "Poppins, sans-serif",
          fontWeight: 800,
          fontSize: 60,
          letterSpacing: 4,
          color: "#FFFFFF",
          textAlign: "center",
          marginTop: 90,
          opacity: interpolate(frame, [2.6 * fps, 2.9 * fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        HOUSE <span style={{ color: "#FFB347" }}>LITE</span>
        <div
          style={{
            fontSize: 34,
            fontWeight: 600,
            letterSpacing: 6,
            color: "#E7D3BB",
            marginTop: 8,
          }}
        >
          CARPINTERÍA Y MUEBLES · TEPATITLÁN
        </div>
      </Interactive.Div>
    </>
  );
};

export const ReelCallToAction = Interactive.create({
  Component: CallToActionInner,
  layout: "absolute-fill",
  schema: { ...Interactive.backgroundSchema },
});
