// "As of" date with play/pause for the animated charts (the live site's GIFs, made interactive).
import { useEffect, useState, type ReactNode } from "react";
import { addDays, dayIndex, formatFi } from "../lib/dates";
import type { DateRange } from "../lib/metrics";

const STEP_DAYS = 7;
const FRAME_MS = 60;

/** An "as of" date within the range, starting at its end, plus its control (play button + slider). */
export function useAsOf(range: DateRange): { asOf: string; control: ReactNode } {
  const span = Math.max(0, dayIndex(range.from, range.to));
  const [step, setStep] = useState(span);
  const [playing, setPlaying] = useState(false);
  const at = Math.min(step, span);
  const asOf = addDays(range.from, at);

  useEffect(() => setStep((s) => Math.min(s, span)), [span]);
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => {
      setStep((s) => {
        if (s >= span) {
          setPlaying(false);
          return span;
        }
        return Math.min(span, s + STEP_DAYS);
      });
    }, FRAME_MS);
    return () => clearInterval(timer);
  }, [playing, span]);

  const control = (
    <div className="as-of">
      <button
        onClick={() => {
          if (!playing && at >= span) setStep(0);
          setPlaying(!playing);
        }}
        aria-label={playing ? "Pause" : "Play"}
      >
        {playing ? "❚❚ Pause" : "▶ Play"}
      </button>
      <label>
        As of <strong>{formatFi(asOf)}</strong>
        <input type="range" min={0} max={span} value={at} aria-valuetext={formatFi(asOf)}
          onChange={(e) => {
            setPlaying(false);
            setStep(Number(e.target.value));
          }} />
      </label>
    </div>
  );
  return { asOf, control };
}
