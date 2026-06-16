// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { readFileSync } from "node:fs";
import path from "node:path";
import { type IShape, type ISolid, Plane, ShapeTypes } from "@chili3d/core";
import { initWasm, ShapeFactory } from "@chili3d/wasm";
import { describe, expect, test } from "@rstest/core";

const WASM_BINARY = readFileSync(path.join(process.cwd(), "packages/wasm/lib/chili-wasm.wasm"));

// Reproduces the Hole command's countersink composition (makeHole, then booleanCut a cone wide at the
// surface narrowing to the bore) in the kernel, verified by volume.
describe("Countersink hole (headless)", () => {
    test("bore r3×10 + countersink r6→r3 over 4mm removes ~138·π from a 20³ box", async () => {
        await initWasm({ wasmBinary: WASM_BINARY });

        const factory = new ShapeFactory();
        const box = factory.box(Plane.XY, 20, 20, 20);
        const holed = factory.makeHole(box.value, { x: 10, y: 10, z: 20 }, { x: 0, y: 0, z: -1 }, 3, 10);
        expect(holed.isOk).toBe(true);

        const eps = 0.01;
        const cone = factory.cone({ x: 0, y: 0, z: -1 }, { x: 10, y: 10, z: 20 + eps }, 6, 3, 4 + eps);
        expect(cone.isOk).toBe(true);
        const result = factory.booleanCut([holed.value as IShape], [cone.value as IShape]);
        expect(result.isOk).toBe(true);

        const solids = result.value.findSubShapes(ShapeTypes.solid) as ISolid[];
        const volume = solids.reduce((sum, s) => sum + s.volume(), 0);

        // Removed = cone frustum (r6→r3, h4) ∪ bore (r3) below it:
        //   (π·4/3)(36+18+9) + π·9·6 = 84π + 54π = 138·π ≈ 433.5 mm³ (within ~0.1% with the eps shift).
        const removed = 8000 - volume;
        expect(Math.abs(removed - 138 * Math.PI)).toBeLessThan(138 * Math.PI * 0.02);
    });
});
