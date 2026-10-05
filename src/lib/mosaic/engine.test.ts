import { describe, expect, it } from "vitest";
import { colorCounts, generateMosaic } from "./engine";
import { getPalette } from "./palettes";

function solid(w: number, h: number, rgb: [number, number, number]) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) data.set([...rgb, 255], i * 4);
  return { data, width: w, height: h };
}

describe("mosaic engine", () => {
  it("maps a solid colour to the nearest palette colour", () => {
    const m = generateMosaic(solid(40, 40, [200, 30, 15]), { width: 8, height: 8, paletteId: "classic", dithering: false });
    expect(m.indices.length).toBe(64);
    const [top] = colorCounts(m);
    expect(getPalette("classic").colors[top.index].id).toBe("red");
    expect(top.count).toBe(64);
  });

  it("averages in linear light (black/white checkerboard is not dark gray)", () => {
    const w = 16, h = 16;
    const data = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const v = (x + y) % 2 ? 255 : 0;
      data.set([v, v, v, 255], (y * w + x) * 4);
    }
    const m = generateMosaic({ data, width: w, height: h }, { width: 2, height: 2, paletteId: "mono", dithering: false });
    const id = getPalette("mono").colors[m.indices[0]].id;
    expect(id).toBe("light-gray");
  });

  it("dithering mixes colours for an in-between shade", () => {
    const m = generateMosaic(solid(64, 64, [128, 128, 128]), { width: 16, height: 16, paletteId: "mono", dithering: true });
    expect(colorCounts(m).length).toBeGreaterThan(1);
  });
});

describe("auto palette", () => {
  it("picks the picture's own colours", () => {
    const w = 32, h = 32;
    const data = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data.set(x < 16 ? [20, 90, 200, 255] : [230, 200, 40, 255], (y * w + x) * 4);
    const m = generateMosaic({ data, width: w, height: h }, { width: 8, height: 8, paletteId: "auto", colorCount: 4, dithering: false });
    expect(m.colors).toBeDefined();
    const used = colorCounts(m).map((c) => m.colors![c.index].toLowerCase());
    expect(used).toEqual(expect.arrayContaining(["#145ac8", "#e6c828"]));
    expect(used.length).toBe(2);
  });
});
