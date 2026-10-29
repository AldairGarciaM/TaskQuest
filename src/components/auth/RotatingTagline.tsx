"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";

const TAGLINES: { lead: string; highlight: string }[] = [
  { lead: "Tu lista de pendientes,", highlight: "convertida en aventura." },
  { lead: "Cada tarea completada", highlight: "suma XP a tu leyenda." },
  { lead: "Sube de nivel", highlight: "una misión a la vez." },
  { lead: "Mantén tu racha,", highlight: "conquista tu semana." },
  { lead: "Haz equipo,", highlight: "comparte la victoria." },
  { lead: "Menos procrastinar,", highlight: "más subir de nivel." },
];

const INTERVAL_MS = 4500;
const EASE_OUT = [0.23, 1, 0.32, 1] as const;

function Tagline({ index }: { index: number }) {
  const { lead, highlight } = TAGLINES[index];
  return (
    <>
      {lead} <span className="text-yellow-300">{highlight}</span>
    </>
  );
}

/** Brand headline that cycles through taglines; stays on the first one with reduced motion. */
export default function RotatingTagline() {
  const reduceMotion = useReducedMotion();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (reduceMotion) return;
    const id = setInterval(() => {
      // Don't burn through taglines while nobody is looking.
      if (document.visibilityState === "visible") setIndex((i) => (i + 1) % TAGLINES.length);
    }, INTERVAL_MS);
    return () => clearInterval(id);
  }, [reduceMotion]);

  return (
    <h2 className="text-4xl leading-tight font-bold text-balance">
      {/* Screen readers get one stable headline instead of a changing one. */}
      <span className="sr-only">
        <Tagline index={0} />
      </span>
      <span aria-hidden className="grid">
        {/* Every tagline sits in the same cell so the tallest one sets the height: no layout jump. */}
        {TAGLINES.map((_, i) => (
          <span key={i} className="invisible [grid-area:1/1]">
            <Tagline index={i} />
          </span>
        ))}
        <AnimatePresence initial={false}>
          <motion.span
            key={reduceMotion ? 0 : index}
            className="[grid-area:1/1]"
            initial={{ opacity: 0, y: 12, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -12, filter: "blur(4px)" }}
            transition={{ duration: 0.5, ease: EASE_OUT }}
          >
            <Tagline index={reduceMotion ? 0 : index} />
          </motion.span>
        </AnimatePresence>
      </span>
    </h2>
  );
}
