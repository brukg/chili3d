// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { readFileSync } from "node:fs";
import path from "node:path";
import { type IShape, type ISolid, Plane, ShapeTypes } from "@chili3d/core";
import { initWasm, ShapeFactory } from "@chili3d/wasm";
import { describe, expect, test } from "@rstest/core";

const WASM_BINARY = readFileSync(path.join(process.cwd(), "packages/wasm/lib/chili-wasm.wasm"));

// Reproduces the Hole command's counterbore composition (makeHole, then booleanCut a wider, shallow
// cylinder at the entry) entirely in the kernel, so the geometry is verified by exact volume.
describe("Counterbore hole (headless)", () => {
    test("bore r3×10 + counterbore r6×4 removes exactly 198·π from a 20³ box", async () => {
        await initWasm({ wasmBinary: WASM_BINARY });

        const factory = new ShapeFactory();
        const box = factory.box(Plane.XY, 20, 20, 20);
        expect(box.isOk).toBe(true);

        // Bore from the top-face centre (10,10,20) straight down.
        const holed = factory.makeHole(box.value, { x: 10, y: 10, z: 20 }, { x: 0, y: 0, z: -1 }, 3, 10);
        expect(holed.isOk).toBe(true);

        // Counterbore: wider cylinder starting a hair above the surface (as the command does).
        const eps = 0.01;
        const cb = factory.cylinder({ x: 0, y: 0, z: -1 }, { x: 10, y: 10, z: 20 + eps }, 6, 4 + eps);
        expect(cb.isOk).toBe(true);
        const result = factory.booleanCut([holed.value as IShape], [cb.value as IShape]);
        expect(result.isOk).toBe(true);

        // booleanCut returns a generic shape; sum the volume of its solid sub-shape(s).
        const solids = result.value.findSubShapes(ShapeTypes.solid) as ISolid[];
        const volume = solids.reduce((sum, s) => sum + s.volume(), 0);

        // Removed = bore cyl(r3, h10) unioned with counterbore cyl(r6, h4):
        //   top 4 mm at r6 + next 6 mm at r3 = π·6²·4 + π·3²·6 = 198·π ≈ 622.04 mm³.
        const removed = 8000 - volume;
        expect(removed).toBeCloseTo(198 * Math.PI, 1);
    });
});
