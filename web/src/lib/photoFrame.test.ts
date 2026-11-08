import { describe, expect, it } from "vitest";
import { clampFrame, DEFAULT_FRAME, frameScale, isStandardUnchanged, MAX_ZOOM, MIN_ZOOM, zoomAround } from "./photoFrame";

const phone = { width: 3024, height: 4032 };

describe("photo framing", () => {
  it("zoom 1 makes the shorter side span the square", () => {
    expect(frameScale(phone, 1) * phone.width).toBeCloseTo(228);
    expect(frameScale({ width: 228, height: 228 }, 1)).toBe(1);
    expect(frameScale(phone, 2) * phone.width).toBeCloseTo(456);
  });

  it("keeps the zoom in bounds, the photo in view and the turn within ±180°", () => {
    expect(clampFrame({ x: 0, y: 0, zoom: 100, rotation: 0 }, phone).zoom).toBe(MAX_ZOOM);
    expect(clampFrame({ x: 0, y: 0, zoom: 0, rotation: 0 }, phone).zoom).toBe(MIN_ZOOM);
    // At zoom 1 the photo is 228 × 304 px: its centre may move up to 152 px.
    expect(clampFrame({ x: 1000, y: -1000, zoom: 1, rotation: 0 }, phone)).toMatchObject({ x: 152, y: -152 });
    expect(clampFrame({ ...DEFAULT_FRAME, rotation: 270 }, phone).rotation).toBe(-90);
    expect(clampFrame({ ...DEFAULT_FRAME, rotation: -190 }, phone).rotation).toBe(170);
    expect(clampFrame({ ...DEFAULT_FRAME, rotation: 90 }, phone).rotation).toBe(90);
  });

  it("zooms around a point, which stays in place", () => {
    const f = zoomAround({ x: 10, y: 0, zoom: 1, rotation: 0 }, 2, { x: 50, y: 0 }, phone);
    expect(f).toMatchObject({ zoom: 2, x: -30, y: 0 });
    // The photo point under (50, 0) was 40 px right of its centre at zoom 1, 80 px at zoom 2: -30 + 80 = 50.
    expect(zoomAround(DEFAULT_FRAME, 1000, { x: 0, y: 0 }, phone).zoom).toBe(MAX_ZOOM);
  });

  it("passes an untouched standard photo through unchanged", () => {
    const std = { width: 228, height: 228 };
    expect(isStandardUnchanged("image/png", std, DEFAULT_FRAME)).toBe(true);
    expect(isStandardUnchanged("image/png", std, { ...DEFAULT_FRAME, zoom: 1.1 })).toBe(false);
    expect(isStandardUnchanged("image/jpeg", std, DEFAULT_FRAME)).toBe(false);
    expect(isStandardUnchanged("image/png", phone, DEFAULT_FRAME)).toBe(false);
  });
});
