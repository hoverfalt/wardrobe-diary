import { describe, expect, it } from "vitest";
import { clampFrame, DEFAULT_FRAME, fitFrame, frameScale, isStandardUnchanged, maskBounds, MAX_ZOOM, MIN_ZOOM, zoomAround } from "./photoFrame";

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

  it("finds the bounding box of a selection", () => {
    const mask = new Uint8Array(10 * 8);
    for (const [x, y] of [[2, 1], [5, 2], [3, 6]]) mask[y * 10 + x] = 1;
    expect(maskBounds(mask, 10, 8)).toEqual({ x0: 2, y0: 1, x1: 5, y1: 6 });
    expect(maskBounds(new Uint8Array(80), 10, 8)).toBeNull();
  });

  it("fits a selected garment centred in the circle", () => {
    const dims = { width: 400, height: 300 };
    // A 120 × 160 garment in the middle: no offset, its diagonal (200 px) spans 92 % of the circle.
    const mid = fitFrame({ x0: 140, y0: 70, x1: 259, y1: 229 }, dims);
    expect(mid.x).toBeCloseTo(0);
    expect(mid.y).toBeCloseTo(0);
    expect(200 * frameScale(dims, mid.zoom)).toBeCloseTo(0.92 * 228);
    // The same garment at the left edge: the photo moves right by its distance from the centre, scaled.
    const left = fitFrame({ x0: 0, y0: 70, x1: 119, y1: 229 }, dims);
    expect(left.x).toBeCloseTo(140 * frameScale(dims, left.zoom));
    expect(left.zoom).toBeCloseTo(mid.zoom);
  });
});
