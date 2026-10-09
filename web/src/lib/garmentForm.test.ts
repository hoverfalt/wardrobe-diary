import { describe, expect, it } from "vitest";
import { changedFields, checkPhoto, nextPhotoId, parseGarmentForm, toForm, type GarmentFields } from "./garmentForm";

const vest: GarmentFields = {
  category: "Jackets and hoodies",
  item: "North Bend black vest",
  details: "",
  photo: "Jackets_and_hoodies-006",
  price: 50,
  purchased: "2017-07-01",
  divested: null,
  timesUsedInit: 2,
  materials: "Shell: 100% polyamide",
  weightG: 305,
};

describe("garment form", () => {
  it("round-trips a garment unchanged", () => {
    const r = parseGarmentForm(toForm(vest), vest.photo);
    expect(r).toEqual({ ok: true, fields: vest });
  });

  it("normalises Finnish decimals, whitespace and empty values", () => {
    const r = parseGarmentForm(
      { ...toForm(vest), item: "  Vest ", price: "49,905", weightG: "", timesUsedInit: "", divested: "2026-10-09" },
      vest.photo,
    );
    expect(r.ok && r.fields).toMatchObject({ item: "Vest", price: 49.91, weightG: null, timesUsedInit: 0, divested: "2026-10-09" });
  });

  it("reports invalid values", () => {
    const r = parseGarmentForm(
      { ...toForm(vest), item: " ", category: "Hats", price: "abc", divested: "2017-01-01", timesUsedInit: "1,5", weightG: "-3" },
      vest.photo,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(["category", "divested", "item", "price", "timesUsedInit", "weightG"]);
  });

  it("lists changed fields", () => {
    expect(changedFields(vest, { ...vest, price: 55, divested: "2026-10-09" })).toEqual(["price", "divested"]);
  });
});

describe("new garment photos", () => {
  it("picks the next free Photo id in the category", () => {
    const ids = ["Jackets_and_hoodies-006", "Jackets_and_hoodies-034", "Socks-146", "T-shirts_and_tanks-017"];
    expect(nextPhotoId("Jackets and hoodies", ids)).toBe("Jackets_and_hoodies-035");
    expect(nextPhotoId("T-shirts and tanks", ids)).toBe("T-shirts_and_tanks-018");
    expect(nextPhotoId("Knits", ids)).toBe("Knits-001");
  });

  it("matches the Photo id pattern the Storage rules accept", () => {
    expect(`${nextPhotoId("T-shirts and tanks", [])}.png`).toMatch(/^[A-Za-z_-]+-[0-9]{3}[.]png$/);
  });

  it("checks type and size, and warns about non-standard dimensions", () => {
    expect(checkPhoto({ type: "image/png", size: 70_000 }, { width: 228, height: 228 })).toEqual({ errors: [], warnings: [] });
    const r = checkPhoto({ type: "image/jpeg", size: 6 * 1024 * 1024 }, { width: 400, height: 300 });
    expect(r.errors).toHaveLength(2);
    expect(r.warnings[0]).toContain("cropped");
  });
});
