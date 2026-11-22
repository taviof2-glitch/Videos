import type { Caption } from "@remotion/captions";
import {
  Easing,
  Interactive,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import "../fonts";

type Page = {
  readonly startMs: number;
  readonly endMs: number;
  readonly words: Caption[];
};

// Agrupa las palabras en "páginas" usando pageBreakAfter.
const toPages = (captions: Caption[]): Page[] => {
  const pages: Page[] = [];
  let current: Caption[] = [];
  for (const c of captions) {
    current.push(c);
    if (c.pageBreakAfter) {
      pages.push({
        startMs: current[0].startMs,
        endMs: c.endMs,
        words: current,
      });
      current = [];
    }
  }
  if (current.length > 0) {
    pages.push({
      startMs: current[0].startMs,
      endMs: current[current.length - 1].endMs,
      words: current,
    });
  }
  return pages;
};

// Subtítulos estilo TikTok: grupos de 1–3 palabras, la palabra que se dice resaltada.
const ReelCaptionsInner = ({
  captions,
  style,
}: {
  readonly captions: Caption[];
  readonly style?: React.CSSProperties;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ms = (frame / fps) * 1000;
  const pages = toPages(captions);

  // La página visible se queda hasta que empieza la siguiente.
  const index = pages.findIndex(
    (p, i) =>
      ms >= p.startMs - 80 &&
      (i === pages.length - 1
        ? ms <= p.endMs + 400
        : ms < pages[i + 1].startMs - 80),
  );
  const page = index === -1 ? null : pages[index];
  if (!page) {
    return null;
  }

  const pageFrame = ((ms - page.startMs + 80) / 1000) * fps;
  const pop = interpolate(pageFrame, [0, 6], [0.82, 1], {
    easing: Easing.out(Easing.back(2.2)),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        fontFamily: "Poppins, sans-serif",
        fontWeight: 800,
        fontSize: 84,
        lineHeight: 1.1,
        textTransform: "uppercase",
        textAlign: "center",
        color: "#FFFFFF",
        WebkitTextStroke: "3px #1A120C",
        paintOrder: "stroke fill",
        textShadow: "0 8px 24px rgba(0,0,0,0.65)",
        scale: String(pop),
        ...style,
      }}
    >
      {page.words.map((w) => {
        const active = ms >= w.startMs - 40 && ms <= w.endMs + 60;
        return (
          <span
            key={`${w.startMs}-${w.text}`}
            style={{
              color: active ? "#FFB347" : "#FFFFFF",
              whiteSpace: "pre-wrap",
            }}
          >
            {w.text}
          </span>
        );
      })}
    </div>
  );
};

export const ReelCaptions = Interactive.create({
  Component: ReelCaptionsInner,
  layout: "none",
  schema: {
    ...Interactive.captionsSchema,
  },
});
