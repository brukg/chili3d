// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { readFileSync } from "node:fs";
import path from "node:path";
import { type ISolid, Plane } from "@chili3d/core";
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
});
