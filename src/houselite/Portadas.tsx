import React from "react";
import { AbsoluteFill } from "remotion";
import { C, fontFamily } from "./ui";
import { Room, TV_HIGH } from "./VideoTV";
import { Messy } from "./VideoCloset";
import { Kind, Swatch } from "./VideoMateriales";

/** Portada estilo miniatura: texto enorme + ilustración del video. */
const Portada: React.FC<{
  n: number;
  top: string;
  red: string;
  band: string;
  children: React.ReactNode;
}> = ({ n, top, red, band, children }) => (
  <AbsoluteFill
    style={{
      backgroundColor: C.bg,
      fontFamily,
      alignItems: "center",
      color: C.dark,
    }}
  >
    <div
      style={{
        position: "absolute",
        top: 110,
        fontWeight: 800,
        fontSize: 40,
        letterSpacing: 4,
        color: C.white,
        backgroundColor: C.dark,
        padding: "10px 30px",
        borderRadius: 40,
      }}
    >
      ANTES DE PEDIR TU MUEBLE · {n}/3
    </div>
    <div
      style={{
        position: "absolute",
        top: 240,
        width: 1040,
        textAlign: "center",
        fontWeight: 900,
        lineHeight: 1,
        textTransform: "uppercase",
      }}
    >
      <div style={{ fontSize: 140 }}>{top}</div>
      <div style={{ fontSize: 160, color: C.red }}>{red}</div>
      <div
        style={{
          display: "inline-block",
          marginTop: 20,
          fontSize: 130,
          backgroundColor: "#FFD43B",
          padding: "8px 34px",
          rotate: "-2deg",
          boxShadow: "0 12px 0 rgba(0,0,0,0.15)",
        }}
      >
        {band}
      </div>
    </div>
    <div
      style={{
        position: "absolute",
        top: 880,
        width: 900,
        height: 640,
        backgroundColor: C.panel,
        overflow: "hidden",
        borderRadius: 30,
        scale: "1.1",
      }}
    >
      {children}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          width: "100%",
          height: 30,
          backgroundColor: C.floor,
        }}
      />
    </div>
  </AbsoluteFill>
);

const BigX: React.FC<{ left: number; top: number }> = ({ left, top }) => (
  <div
    style={{
      position: "absolute",
      left,
      top,
      width: 150,
      height: 150,
      borderRadius: 150,
      backgroundColor: C.red,
      border: "8px solid #fff",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}
  >
    <svg width={80} height={80} viewBox="0 0 24 24">
      <path
        d="M5 5l14 14M19 5L5 19"
        stroke="#fff"
        strokeWidth={4}
        strokeLinecap="round"
      />
    </svg>
  </div>
);

export const PortadaTV: React.FC = () => (
  <Portada n={1} top="Tu tele" red="está mal" band="puesta">
    <Room tvTop={TV_HIGH} sight="bad" />
    <BigX left={590} top={60} />
  </Portada>
);

export const PortadaCloset: React.FC = () => (
  <Portada n={2} top="Tu closet" red="está mal" band="dividido">
    <Messy />
    <BigX left={720} top={40} />
  </Portada>
);

export const PortadaMateriales: React.FC = () => (
  <Portada n={3} top="¿Melamina," red="MDF" band="o madera?">
    {(["melamina", "mdf", "madera"] as Kind[]).map((k, i) => (
      <div
        key={k}
        style={{ position: "absolute", left: 50 + i * 280, top: 70 }}
      >
        <Swatch kind={k} w={240} h={420} />
      </div>
    ))}
  </Portada>
);
