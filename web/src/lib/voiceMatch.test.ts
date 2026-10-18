import { describe, expect, it } from "vitest";
import type { Garment } from "../types";
import { lastWornBefore, matchGarment, normalise, spokenNumbers } from "./voiceMatch";

let n = 0;
const g = (item: string, category: string, details = ""): Garment => ({
  id: `g${++n}`, category, item, details, photo: "", price: 10, purchased: "2020-01-01", divested: null, timesUsedInit: 0, materials: "", weightG: null,
});
const W = [
  g("Haglöfs LIM GTX Jacket", "Jackets and hoodies"),
  g("Helly Hansen Ervik black", "Jackets and hoodies"),
  g("Crivit black hoodie", "Jackets and hoodies"),
  g("H&M steel gray college", "Jackets and hoodies"),
  g("Diesel black 05", "Underwear boxers"),
  g("Diesel blue 02", "Underwear boxers"),
  g("Jack & Jones 5ER Red", "Underwear boxers"),
  g("Diesel black blank", "Belts"),
  g("SOC run vest black S", "Sportswear"),
  g("SOC U 4P Black 02 (39-42)", "Socks"),
  g("Oliver Cabell Low 1 White sneakers", "Shoes"),
  g("Hugo Boss Mirage white sneakers", "Shoes"),
  g("Nike M Tanjun black 2", "Shoes"),
  g("Tiger of Sweden Jeans black", "Pants"),
  g("Tiger of Sweden Jeans black 02", "Pants"),
  g("G Star Raw black", "Pants"),
  g("Fred Perry dark blue piqué", "T-shirts and tanks"),
  g("Rip Curl gray tank", "T-shirts and tanks"),
  ...Array.from({ length: 6 }, (_, i) => g(`Jockey white ${String(i + 1).padStart(2, "0")}`, "Underwear shirts")),
];
const byName = (name: string) => W.find((x) => x.item === name)!;
// Jockey 03 was worn longest ago (2026-01-05); 01 most recently.
const days = [
  { date: "2026-01-05", worn: [byName("Jockey white 03").id] },
  { date: "2026-02-01", worn: [byName("Jockey white 02").id, byName("Jockey white 04").id, byName("Jockey white 05").id, byName("Jockey white 06").id] },
  { date: "2026-03-01", worn: [byName("Jockey white 01").id] },
];
const last = lastWornBefore(days, "2026-10-18");
const top = (text: string) => matchGarment(text, W, last).candidates[0]?.garment.item;

describe("voice matching", () => {
  it("normalises spoken forms, brands and plurals", () => {
    expect(normalise("Haglöfs T-shirts")).toEqual(["haglof", "tshirt"]);
    expect(normalise("H and M grey tee")).toEqual(["hm", "gray", "tshirt"]);
    expect(normalise("Jack & Jones boxers")).toEqual(["jackjone", "boxer"]);
    expect(spokenNumbers(normalise("jockey white zero four"))).toEqual([4]);
    expect(spokenNumbers(normalise("jockey white number 4"))).toEqual([4]);
  });

  it("finds garments from brand, colour and type", () => {
    expect(top("my Haglöfs jacket")).toBe("Haglöfs LIM GTX Jacket");
    expect(top("haglofs gore-tex jacket")).toBe("Haglöfs LIM GTX Jacket");
    expect(top("black Diesel boxers")).toBe("Diesel black 05");
    expect(top("the Oliver Cabell sneakers")).toBe("Oliver Cabell Low 1 White sneakers");
    expect(top("Hugo Boss white trainers")).toBe("Hugo Boss Mirage white sneakers");
    expect(top("H and M grey college")).toBe("H&M steel gray college");
    expect(top("Fred Perry polo tee")).toBe("Fred Perry dark blue piqué");
    expect(top("Jack and Jones red boxers")).toBe("Jack & Jones 5ER Red");
    expect(top("Crivit hoody")).toBe("Crivit black hoodie");
  });

  it("lets the spoken garment type decide, and never fuzzy-matches a word that exists exactly", () => {
    expect(top("black Diesel boxers")).toBe("Diesel black 05"); // not the belt "Diesel black blank"
    expect(top("SOC black socks")).toBe("SOC U 4P Black 02 (39-42)"); // "socks" is not the brand "SOC"
    expect(top("Diesel belt")).toBe("Diesel black blank");
  });

  it("keeps to the spoken type when the obvious garment is already logged", () => {
    const withoutBlack05 = W.filter((x) => x.item !== "Diesel black 05");
    const r = matchGarment("black Diesel boxers", withoutBlack05, last);
    expect(r.candidates[0].garment.category).toBe("Underwear boxers");
    expect(r.candidates.every((c) => c.garment.category !== "Belts")).toBe(true);
  });

  it("tolerates small dictation errors", () => {
    expect(top("Helly Hansen Ervic")).toBe("Helly Hansen Ervik black");
    expect(top("Tanjune shoes")).toBe("Nike M Tanjun black 2");
  });

  it("uses a spoken number to pick one of identical garments", () => {
    expect(top("Jockey white 04")).toBe("Jockey white 04");
    expect(top("jockey white number four")).toBe("Jockey white 04");
    expect(top("jockey white zero two")).toBe("Jockey white 02");
    expect(top("Tiger jeans black two")).toBe("Tiger of Sweden Jeans black 02");
  });

  it("otherwise picks the identical garment worn longest ago, and counts the group", () => {
    const r = matchGarment("white Jockey undershirt", W, last);
    expect(r.candidates[0].garment.item).toBe("Jockey white 03");
    expect(r.candidates[0].groupSize).toBe(6);
  });

  it("keeps the rotation even when the latest one was worn more often lately", () => {
    const recent = new Map([[byName("Jockey white 01").id, 30]]);
    expect(matchGarment("jockey white", W, last, recent).candidates[0].garment.item).toBe("Jockey white 03");
  });

  it("offers alternatives and nothing for unrelated words", () => {
    const r = matchGarment("black jeans", W, last);
    expect(r.candidates.length).toBeGreaterThan(1);
    expect(r.candidates[0].garment.category).toBe("Pants");
    expect(matchGarment("umbrella", W, last).candidates).toEqual([]);
    expect(matchGarment("", W, last).candidates).toEqual([]);
  });
});
