import {
  calculateMasonryLayout,
  getImageColumnSpan,
  getResponsiveColumnCount,
  type MasonryItem
} from "@/lib/images/masonry";

const square: MasonryItem = { id: "square", width: 1000, height: 1000 };
const wide: MasonryItem = { id: "wide", width: 1500, height: 1000 };

describe("getImageColumnSpan", () => {
  it("uses two columns for images at or above the wide threshold", () => {
    expect(getImageColumnSpan(wide, 5)).toBe(2);
    expect(getImageColumnSpan({ ...wide, width: 1499 }, 5)).toBe(1);
  });

  it("clamps wide images to one column in a single-column layout", () => {
    expect(getImageColumnSpan(wide, 1)).toBe(1);
    expect(getImageColumnSpan({ id: "unknown", width: null, height: null }, 5)).toBe(1);
  });
});

describe("getResponsiveColumnCount", () => {
  it("matches the five existing desktop size stages and responsive caps", () => {
    expect(getResponsiveColumnCount("xlarge", 1440)).toBe(3);
    expect(getResponsiveColumnCount("xsmall", 1440)).toBe(8);
    expect(getResponsiveColumnCount("medium", 1000)).toBe(3);
    expect(getResponsiveColumnCount("large", 600)).toBe(1);
    expect(getResponsiveColumnCount("xsmall", 600)).toBe(2);
  });
});

describe("calculateMasonryLayout", () => {
  it("gives wide images the width of two columns plus the gap", () => {
    const layout = calculateMasonryLayout([square, wide], 500, 3, 10);
    const [squarePlacement, widePlacement] = layout.placements;

    expect(squarePlacement.width).toBeCloseTo(160);
    expect(widePlacement.columnSpan).toBe(2);
    expect(widePlacement.width).toBeCloseTo(330);
    expect(widePlacement.height).toBeCloseTo(220);
  });

  it("places each source item in the shortest available contiguous columns", () => {
    const items = [
      { id: "portrait", width: 500, height: 1000 },
      { id: "first-square", width: 1000, height: 1000 },
      { id: "second-square", width: 1000, height: 1000 },
      { id: "next", width: 1000, height: 1000 }
    ];
    const layout = calculateMasonryLayout(items, 320, 3, 10);

    expect(layout.placements.map((placement) => placement.id)).toEqual(items.map((item) => item.id));
    expect(layout.placements[3].x).toBeCloseTo(110);
    expect(layout.placements[3].y).toBeCloseTo(110);
    expect(layout.height).toBeCloseTo(210);
  });

  it("does not overlap cards or place them outside the container", () => {
    const layout = calculateMasonryLayout(
      [square, wide, { id: "portrait", width: 800, height: 1600 }, square],
      700,
      4,
      14
    );

    for (const placement of layout.placements) {
      expect(placement.x).toBeGreaterThanOrEqual(0);
      expect(placement.x + placement.width).toBeLessThanOrEqual(700.0001);
    }

    for (let firstIndex = 0; firstIndex < layout.placements.length; firstIndex += 1) {
      for (let secondIndex = firstIndex + 1; secondIndex < layout.placements.length; secondIndex += 1) {
        const first = layout.placements[firstIndex];
        const second = layout.placements[secondIndex];
        const separated =
          first.x + first.width <= second.x ||
          second.x + second.width <= first.x ||
          first.y + first.height <= second.y ||
          second.y + second.height <= first.y;
        expect(separated).toBe(true);
      }
    }
  });
});
