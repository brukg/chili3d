// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { readFileSync } from "node:fs";
import path from "node:path";
import { type ISolid, Plane } from "@chili3d/core";
import { initWasm, ShapeFactory } from "@chili3d/wasm";
import { describe, expect, test } from "@rstest/core";

const WASM_BINARY = readFileSync(path.join(process.cwd(), "packages/wasm/lib/chili-wasm.wasm"));

describe("Variable fillet (headless)", () => {
    test("rounds a box edge with a transitioning radius, reducing volume", async () => {
        await initWasm({ wasmBinary: WASM_BINARY });

        const factory = new ShapeFactory();
        const box = factory.box(Plane.XY, 20, 20, 20);
        expect(box.isOk).toBe(true);
        const before = (box.value as ISolid).volume();

        // Fillet edge 0 with radius transitioning 2mm -> 4mm along the edge.
        const filleted = factory.variableFillet(box.value, [0], 2, 4);
        expect(filleted.isOk).toBe(true);

        const after = (filleted.value as ISolid).volume();
        // a convex box edge fillet removes material
        expect(after).toBeLessThan(before);
    });
});
