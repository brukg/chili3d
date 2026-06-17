// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { readFileSync } from "node:fs";
import path from "node:path";
import { type ISolid, Plane, ShapeTypes } from "@chili3d/core";
import { initWasm, ShapeFactory } from "@chili3d/wasm";
import { describe, expect, test } from "@rstest/core";

// Under Node there is no fetch for the .wasm; read it from disk (tests run from
// the repo root) and hand the bytes to Emscripten via Module.wasmBinary.
const WASM_BINARY = readFileSync(path.join(process.cwd(), "packages/wasm/lib/chili-wasm.wasm"));

describe("Hole feature (headless)", () => {
    test("drills a blind hole into a box, reducing its volume", async () => {
        await initWasm({ wasmBinary: WASM_BINARY });

        const factory = new ShapeFactory();
        const box = factory.box(Plane.XY, 20, 20, 20);
        expect(box.isOk).toBe(true);
        const before = (box.value as ISolid).volume();

        // Drill from the top face centre (10,10,20) downward (0,0,-1),
        // radius 3, depth 10.
        const holed = factory.makeHole(box.value, { x: 10, y: 10, z: 20 }, { x: 0, y: 0, z: -1 }, 3, 10);
        expect(holed.isOk).toBe(true);

        const after = (holed.value as ISolid).volume();
        expect(after).toBeLessThan(before);
        // a 3mm-radius, 10mm-deep hole removes ~282.7 mm^3
        expect(before - after).toBeGreaterThan(200);
    });

    test("Through All cuts a full-length cylinder (makeHole is blind-only)", async () => {
        await initWasm({ wasmBinary: WASM_BINARY });

        const factory = new ShapeFactory();
        const box = factory.box(Plane.XY, 20, 20, 20);
        // makeHole fails once the depth reaches the far face, so Through All cuts a long cylinder with
        // booleanCut instead (as the Hole command now does): a clean through-hole.
        const eps = 0.01;
        const bore = factory.cylinder({ x: 0, y: 0, z: -1 }, { x: 10, y: 10, z: 20 + eps }, 3, 30);
        expect(bore.isOk).toBe(true);
        const cut = factory.booleanCut([box.value], [bore.value]);
        expect(cut.isOk).toBe(true);
        const solids = cut.value.findSubShapes(ShapeTypes.solid) as ISolid[];
        const removed = 8000 - solids.reduce((s, x) => s + x.volume(), 0);
        // π·3²·20 ≈ 565.5 mm³ removed through the full 20mm thickness.
        expect(removed).toBeCloseTo(Math.PI * 9 * 20, 1);
    });
});
