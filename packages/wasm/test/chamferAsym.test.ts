// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { readFileSync } from "node:fs";
import path from "node:path";
import { type ISolid, Plane, ShapeTypes } from "@chili3d/core";
import { initWasm, ShapeFactory } from "@chili3d/wasm";
import { describe, expect, test } from "@rstest/core";

const WASM_BINARY = readFileSync(path.join(process.cwd(), "packages/wasm/lib/chili-wasm.wasm"));

// Backs the Two-Distance Chamfer: an asymmetric chamfer of a single box edge removes a right-triangle
// cross-section (legs distance1, distance2) along the edge → volume distance1·distance2/2 · length.
describe("asymmetric chamfer", () => {
    test("a 20mm cube edge chamfered 2×4 removes a triangular prism of volume 80", async () => {
        await initWasm({ wasmBinary: WASM_BINARY });
        const factory = new ShapeFactory();
        const box = factory.box(Plane.XY, 20, 20, 20);
        expect(box.isOk).toBe(true);

        const chamfered = factory.chamferAsym(box.value, [0], 2, 4);
        expect(chamfered.isOk).toBe(true);
        const volume = (chamfered.value.findSubShapes(ShapeTypes.solid) as ISolid[]).reduce(
            (sum, s) => sum + s.volume(),
            0,
        );
        // Cube 8000 minus the triangular prism (½·2·4·20 = 80).
        expect(volume).toBeCloseTo(8000 - 80, 2);
    });
});
