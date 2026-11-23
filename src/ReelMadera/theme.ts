import { loadFont as loadAnton } from "@remotion/google-fonts/Anton";
import { loadFont as loadMontserrat } from "@remotion/google-fonts/Montserrat";

export const { fontFamily: displayFont } = loadAnton("normal", {
  weights: ["400"],
  subsets: ["latin"],
});

export const { fontFamily: bodyFont } = loadMontserrat("normal", {
  weights: ["600", "800"],
  subsets: ["latin"],
});

// Colores provisionales (los colores de marca de House Lite están pendientes).
export const colors = {
  bg: "#1a120b",
  bgSoft: "#2a1d12",
  cream: "#f7ead2",
  accent: "#ff8a3d",
  yes: "#5ee08a",
  no: "#ff6b6b",
  wood: "#b9814a",
  woodDark: "#7a4f2a",
  woodLight: "#e2b47c",
  mdf: "#a8835a",
  white: "#ffffff",
};
