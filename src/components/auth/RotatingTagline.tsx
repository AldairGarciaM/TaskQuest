"use client";

import { useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";

const TAGLINES: { lead: string; highlight: string }[] = [
  { lead: "Tu lista de pendientes,", highlight: "convertida en aventura." },
  { lead: "Cada tarea completada", highlight: "suma XP a tu leyenda." },
  { lead: "Sube de nivel", highlight: "una misión a la vez." },
  { lead: "Mantén tu racha,", highlight: "conquista tu semana." },
  { lead: "Haz equipo,", highlight: "comparte la victoria." },
  { lead: "Menos procrastinar,", highlight: "más subir de nivel." },
];

const fullText = (i: number) => `${TAGLINES[i].lead} ${TAGLINES[i].highlight}`;

/** Milliseconds per keystroke, with a little jitter so it reads like a person typing. */
function typingDelay(typed: string): number {
  const last = typed.at(-1);
  if (last === "," || last === ".") return 320;
  if (last === " ") return 110;
  return 45 + Math.random() * 55;
}
const DELETE_DELAY = 22;
const HOLD_MS = 2400;
const BEFORE_NEXT_MS = 450;

type Phase = "typing" | "holding" | "deleting";

function Tagline({ index, typed, blink }: { index: number; typed: number; blink: boolean }) {
  const { lead } = TAGLINES[index];
  const text = fullText(index);
  const split = lead.length + 1;
  const leadEnd = Math.min(typed, split);
  const highlightEnd = Math.max(typed, split);
  // Untyped characters stay in the layout (invisible) so lines break where the finished phrase will.
  // Zero-width anchor: the caret never pushes text around. Solid while typing, blinks while idle.
  const caret = (
    <span className="relative">
      <span
        className={`absolute -top-[0.05em] left-0.5 h-[1.05em] w-[3px] rounded-full bg-yellow-300 ${blink ? "animate-caret-blink motion-reduce:animate-none" : ""}`}
      />
    </span>
  );

  return (
    <>
      {text.slice(0, leadEnd)}
      {typed < split && caret}
      <span className="invisible">{text.slice(leadEnd, split)}</span>
      <span className="text-yellow-300">{text.slice(split, highlightEnd)}</span>
      {typed >= split && caret}
      <span className="invisible">{text.slice(highlightEnd)}</span>
    </>
  );
}

/**
 * Brand headline typed out like on a keyboard: types a tagline, holds it, deletes it and moves on.
 * With reduced motion it just shows the first tagline.
 */
export default function RotatingTagline() {
  const reduceMotion = useReducedMotion();
  const [state, setState] = useState<{ index: number; typed: number; phase: Phase }>({
    index: 0,
    typed: 0,
    phase: "typing",
  });

  useEffect(() => {
    if (reduceMotion) return;
    const { index, typed, phase } = state;
    const text = fullText(index);

    let delay: number;
    let next: typeof state;
    if (phase === "typing") {
      delay = typed === 0 ? BEFORE_NEXT_MS : typingDelay(text.slice(0, typed));
      next = typed + 1 >= text.length ? { index, typed: text.length, phase: "holding" } : { index, typed: typed + 1, phase };
    } else if (phase === "holding") {
      delay = HOLD_MS;
      next = { index, typed, phase: "deleting" };
    } else {
      delay = DELETE_DELAY;
      next =
        typed <= 1
          ? { index: (index + 1) % TAGLINES.length, typed: 0, phase: "typing" }
          : { index, typed: typed - 1, phase };
    }

    const id = setTimeout(() => {
      // Wait while the tab is hidden instead of typing to nobody.
      if (document.visibilityState === "visible") setState(next);
      else setState({ ...state });
    }, delay);
    return () => clearTimeout(id);
  }, [state, reduceMotion]);

  const index = reduceMotion ? 0 : state.index;
  const typed = reduceMotion ? fullText(0).length : state.typed;

  return (
    <h2 className="text-4xl leading-tight font-bold text-balance">
      {/* Screen readers get one stable headline instead of a stream of letters. */}
      <span className="sr-only">{fullText(0)}</span>
      <span aria-hidden className="grid">
        {/* Every tagline sits in the same cell so the tallest one sets the height: no layout jump. */}
        {TAGLINES.map((_, i) => (
          <span key={i} className="invisible [grid-area:1/1]">
            {fullText(i)}
          </span>
        ))}
        <span className="[grid-area:1/1]">
          <Tagline index={index} typed={typed} blink={reduceMotion || state.phase === "holding"} />
        </span>
      </span>
    </h2>
  );
}
