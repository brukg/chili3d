// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { readFileSync } from "node:fs";
import path from "node:path";
import { type ISolid, Plane, ShapeTypes } from "@chili3d/core";
import { initWasm, ShapeFactory } from "@chili3d/wasm";
import { describe, expect, test } from "@rstest/core";

const WASM_BINARY = readFileSync(path.join(process.cwd(), "packages/wasm/lib/chili-wasm.wasm"));

// Backs the Distance-Angle Chamfer. At 45° the bevel is symmetric (the second setback = distance·tan45
// = distance), so a 20mm cube edge chamfered at distance 4 / 45° removes ½·4·4·20 = 160 — independent
// of which face the angle is measured from.
describe("distance-angle chamfer", () => {
    test("a 20mm cube edge at distance 4 / 45° removes volume 160", async () => {
        await initWasm({ wasmBinary: WASM_BINARY });
        const factory = new ShapeFactory();
        const box = factory.box(Plane.XY, 20, 20, 20);
        const chamfered = factory.chamferDA(box.value, [0], 4, Math.PI / 4);
        expect(chamfered.isOk).toBe(true);
        const volume = (chamfered.value.findSubShapes(ShapeTypes.solid) as ISolid[]).reduce(
            (sum, s) => sum + s.volume(),
            0,
        );
        expect(volume).toBeCloseTo(8000 - 160, 2);
    });
});
