// "Describe an item" on the Log page (R-44): type or dictate (the iPhone keyboard's microphone) a description such
// as "black Diesel boxers" or "Jockey white number four"; the best matching garment is shown with alternatives and
// is logged only when tapped. Each description, the proposals and the choice are recorded (owner-only) to measure
// how well matching works.
import { useMemo, useRef, useState } from "react";
import { logVoiceQuery, recordVoiceChoice } from "../data/repo";
import { photoUrl } from "../firebase";
import { lastWornBefore, matchGarment, type MatchResult } from "../lib/voiceMatch";
import type { Day, Garment, IsoDate } from "../types";

export const MATCHER = "voiceMatch v1.2 (words + browse by type + rotation series, no AI)";

export function VoiceFind({ uid, date, candidates, days, recent, rotation, onAdd }: {
  uid: string;
  date: IsoDate;
  /** Garments that can be logged now: active on the day, not yet logged, within the Log filters. */
  candidates: Garment[];
  days: Day[];
  recent: Map<string, number>;
  /** Garments of marked rotation series → place in line (0 = next), from lib/rotation.ts. */
  rotation: Map<string, number>;
  onAdd: (garmentId: string) => void;
}) {
  const [text, setText] = useState("");
  const [result, setResult] = useState<(MatchResult & { query: string; logId: string }) | null>(null);
  const [added, setAdded] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const lastWorn = useMemo(() => lastWornBefore(days, date), [days, date]);

  const find = (e: React.FormEvent) => {
    e.preventDefault();
    const query = text.trim();
    if (!query) return;
    const r = matchGarment(query, candidates, lastWorn, recent, rotation);
    const logId = logVoiceQuery(uid, { at: new Date().toISOString(), date, text: query, proposals: r.candidates.map((c) => c.garment.id), mode: r.mode, matcher: MATCHER });
    setResult({ ...r, query, logId });
    setAdded(null);
    input.current?.blur(); // hide the keyboard so the match is visible
  };
  const add = (g: Garment, rank: number) => {
    if (result) recordVoiceChoice(uid, result.logId, g.id, rank);
    onAdd(g.id);
    setAdded(g.item);
    setResult(null);
    setText("");
  };
  const clear = () => {
    setResult(null);
    setText("");
    input.current?.focus();
  };

  const [best, ...alternatives] = result?.candidates ?? [];
  return (
    <div className="voice-find">
      <form onSubmit={find} className="voice-form">
        <input
          ref={input}
          type="text"
          inputMode="text"
          enterKeyHint="search"
          autoComplete="off"
          autoCorrect="off"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Describe an item, e.g. black Diesel boxers"
          aria-label="Describe an item to log"
        />
        <button type="submit" disabled={!text.trim()}>Find</button>
      </form>
      {added && !result && <p className="voice-added">✓ Added {added}. Describe the next item, or tap 🎤 on the keyboard.</p>}
      {result && (
        <div className="voice-result" aria-live="polite">
          {result.mode === "browse" && result.candidates.length > 0 ? (
            <>
              <p className="muted voice-browse-note">
                {result.unplaced.length > 0 && <>Couldn't place “{result.unplaced.join(" ")}”. </>}
                Most worn lately first; tap the one you wore.
              </p>
              <div className="voice-grid">
                {result.candidates.map((c, i) => (
                  <button key={c.garment.id} className="tile" onClick={() => add(c.garment, i)}>
                    {photoUrl(c.garment) && <img src={photoUrl(c.garment)!} alt="" loading="lazy" />}
                    <span>{c.garment.item}</span>
                    {c.groupSize > 1 && <small className="muted">1 of {c.groupSize} identical</small>}
                  </button>
                ))}
              </div>
            </>
          ) : best ? (
            <>
              <div className="voice-best">
                {photoUrl(best.garment) && <img src={photoUrl(best.garment)!} alt="" />}
                <div>
                  <strong>{best.garment.item}</strong>
                  <span className="muted">
                    {best.garment.category}
                    {best.groupSize > 1 && ` · 1 of ${best.groupSize} identical, ${rotation.has(best.garment.id) ? "next in rotation" : "worn longest ago"}`}
                  </span>
                </div>
                <button className="primary" onClick={() => add(best.garment, 0)}>Add</button>
              </div>
              {alternatives.length > 0 && (
                <div className="voice-alternatives">
                  <span className="muted">Or:</span>
                  {alternatives.map((c, i) => (
                    <button key={c.garment.id} className="chip" onClick={() => add(c.garment, i + 1)}>
                      {photoUrl(c.garment) && <img src={photoUrl(c.garment)!} alt="" />}
                      <span>{c.garment.item}</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <p className="muted">No match for “{result.query}”. Try a brand, a colour or the type of garment.</p>
          )}
          <button className="link-button" onClick={clear}>Clear</button>
        </div>
      )}
    </div>
  );
}
