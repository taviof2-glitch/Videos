import { loadFont } from "@remotion/google-fonts/Poppins";

// Se importa desde cada escena para que también carguen solas en Studio.
loadFont("normal", {
  weights: ["500", "700", "800"],
  subsets: ["latin"],
});
