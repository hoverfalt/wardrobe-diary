import { describe, expect, it } from "vitest";
import { categoryFromSlug, categorySlug } from "./categories";
import { parseRoute, routePath } from "./route";

describe("routes", () => {
  it("parses and builds paths", () => {
    expect(parseRoute("/")).toEqual({ page: "dashboard" });
    expect(parseRoute("/log")).toEqual({ page: "log" });
    expect(parseRoute("/category/jackets-and-hoodies")).toEqual({ page: "category", slug: "jackets-and-hoodies" });
    expect(routePath({ page: "category", slug: "socks" })).toBe("/category/socks");
    expect(parseRoute("/manage")).toEqual({ page: "manage" });
    expect(parseRoute("/manage/Socks-012")).toEqual({ page: "manage", id: "Socks-012" });
    expect(routePath({ page: "manage", id: "Socks-012" })).toBe("/manage/Socks-012");
    expect(parseRoute("/garment/Shirts-031")).toEqual({ page: "garment", id: "Shirts-031" });
    expect(parseRoute("/materials")).toEqual({ page: "materials" });
  });

  it("maps categories to slugs and back", () => {
    expect(categorySlug("T-shirts and tanks")).toBe("t-shirts-and-tanks");
    expect(categoryFromSlug("t-shirts-and-tanks")).toBe("T-shirts and tanks");
    expect(categoryFromSlug("nope")).toBeNull();
  });
});
